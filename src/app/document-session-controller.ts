import { clearDraftSnapshot, saveDraftSnapshot, type DraftSaveResult, type DraftSnapshot } from "./draft-recovery";
import {
  formatTransitionConfirmation,
  isSameDocumentPath,
  shouldConfirmDocumentReplacement,
  shouldConfirmWorkspaceSwitch,
} from "./document-transition";
import { normalizePathKey } from "./path-key";
import { isEditableDocument } from "../lib/document-adapters";
import type { OpenDocument, RenderedMarkdown } from "./types";

export type DocumentOpenNavigation = "sync" | "push" | "back" | "forward";

export type DraftFlushOutcome = "not-needed" | "saved" | "unavailable" | "failed";

export type DocumentSaveCommit = {
  path: string;
  draft: string;
  rendered: RenderedMarkdown;
  snapshots: DraftSnapshot[];
};

export type DocumentSessionControllerOptions = {
  getCurrentDocument: () => OpenDocument | null;
  getSourceDraft: () => string;
  getWorkspacePath: () => string | null;
  isNative: boolean;
  readTextFile: (path: string) => Promise<string>;
  writeTextFile: (path: string, contents: string) => Promise<void>;
  renderSource: (path: string, source: string) => Promise<RenderedMarkdown>;
  downloadText: (name: string, contents: string) => void;
  loadDocument: (path: string, preserveMode: boolean) => Promise<boolean>;
  commitNavigation: (path: string, navigation: DocumentOpenNavigation, previousPath: string | null) => void;
  onDraftSaved?: (result: DraftSaveResult) => boolean;
  onSaveCommitted: (commit: DocumentSaveCommit) => void;
  onSaveConflict: (path: string) => void;
  onExternalChangePath: (path: string | null) => void;
  onError: (message: string) => void;
  invalidateCache?: (path: string) => void;
  selfWritingPaths?: Set<string>;
  selfWrittenPaths?: Map<string, number>;
  getSelfWritingPaths?: () => Set<string>;
  getSelfWrittenPaths?: () => Map<string, number>;
  clearDraft?: (path: string) => DraftSnapshot[];
  saveDraft?: (snapshot: DraftSnapshot) => DraftSaveResult;
  confirm?: (message: string) => boolean;
  now?: () => number;
};

export type DocumentSessionController = {
  flushDraft: () => DraftFlushOutcome;
  confirmDocumentReplacement: (nextPaths: readonly string[], action: string) => boolean;
  confirmWorkspaceSwitch: (nextWorkspacePath: string, action: string) => boolean;
  openPath: (path: string, preserveMode?: boolean, navigation?: DocumentOpenNavigation) => Promise<boolean>;
  reloadExternalChange: (externalChangePath: string | null) => Promise<void>;
  resolveDraftRecovery: (snapshot: DraftSnapshot) => string | null;
  saveDocument: (allowExternalOverwrite?: boolean) => Promise<boolean>;
  beginCloseOperation: () => number;
  cancelCloseOperation: () => void;
  isCurrentCloseOperation: (operation: number) => boolean;
  dispose: () => void;
};

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

function comparablePath(path: string): string {
  return normalizePathKey(path);
}

export function createDocumentSessionController(options: DocumentSessionControllerOptions): DocumentSessionController {
  const saveDraft = options.saveDraft ?? saveDraftSnapshot;
  const clearDraft = options.clearDraft ?? clearDraftSnapshot;
  const onDraftSaved = options.onDraftSaved ?? ((result) => result.ok);
  const confirm =
    options.confirm ?? ((message: string) => (typeof window === "undefined" ? false : window.confirm(message)));
  const now = options.now ?? Date.now;
  const fallbackSelfWritingPaths = options.selfWritingPaths ?? new Set<string>();
  const fallbackSelfWrittenPaths = options.selfWrittenPaths ?? new Map<string, number>();
  const getSelfWritingPaths = options.getSelfWritingPaths ?? (() => fallbackSelfWritingPaths);
  const getSelfWrittenPaths = options.getSelfWrittenPaths ?? (() => fallbackSelfWrittenPaths);
  let closeOperation = 0;

  const saveCurrentDraft = (): DraftSaveResult | null => {
    const current = options.getCurrentDocument();
    if (!current?.modified || !isEditableDocument(current.kind)) return null;

    return saveDraft({
      path: current.path,
      draft: options.getSourceDraft(),
      baseSource: current.source,
      savedAt: now(),
    });
  };

  const flushDraft = (): DraftFlushOutcome => {
    const current = options.getCurrentDocument();
    if (!current?.modified || !isEditableDocument(current.kind)) return "not-needed";
    if (current.path.startsWith("browser://")) return "unavailable";

    const result = saveCurrentDraft();
    if (!result) return "not-needed";
    return onDraftSaved(result) ? "saved" : "failed";
  };

  const confirmDocumentReplacement = (nextPaths: readonly string[], action: string): boolean => {
    if (!shouldConfirmDocumentReplacement(options.getCurrentDocument(), nextPaths)) return true;
    const outcome = flushDraft();
    if (outcome === "failed") return false;
    return confirm(formatTransitionConfirmation(action, outcome === "saved"));
  };

  const confirmWorkspaceSwitch = (nextWorkspacePath: string, action: string): boolean => {
    const current = options.getCurrentDocument();
    if (!shouldConfirmWorkspaceSwitch(Boolean(current?.modified), options.getWorkspacePath(), nextWorkspacePath)) {
      return true;
    }
    const outcome = flushDraft();
    if (outcome === "failed") return false;
    return confirm(formatTransitionConfirmation(action, outcome === "saved"));
  };

  const openPath = async (
    path: string,
    preserveMode = false,
    navigation: DocumentOpenNavigation = "sync",
  ): Promise<boolean> => {
    const previousPath = options.getCurrentDocument()?.path ?? null;
    try {
      const opened = await options.loadDocument(path, preserveMode);
      if (opened) options.commitNavigation(path, navigation, previousPath);
      return opened;
    } catch (cause) {
      options.onError(errorMessage(cause, "文件打开失败。"));
      return false;
    }
  };

  const reloadExternalChange = async (externalChangePath: string | null): Promise<void> => {
    const current = options.getCurrentDocument();
    if (!current || !externalChangePath || !isSameDocumentPath(current.path, externalChangePath)) return;

    if (current.modified) {
      const result = saveCurrentDraft();
      if (result && !onDraftSaved(result)) return;
      if (!confirm("重新载入会覆盖当前未保存修改，已先保留一份草稿恢复副本。继续吗？")) return;
    }

    options.onExternalChangePath(null);
    const opened = await openPath(current.path, true);
    const latest = options.getCurrentDocument();
    if (!opened && latest && isSameDocumentPath(latest.path, current.path)) {
      options.onExternalChangePath(current.path);
    }
  };

  const resolveDraftRecovery = (snapshot: DraftSnapshot): string | null => {
    const current = options.getCurrentDocument();
    if (!current || !isSameDocumentPath(current.path, snapshot.path)) return null;
    return snapshot.draft;
  };

  const saveDocument = async (allowExternalOverwrite = false): Promise<boolean> => {
    const current = options.getCurrentDocument();
    const draft = options.getSourceDraft();
    if (!current || !current.modified || !isEditableDocument(current.kind)) return false;

    if (current.externallyModified && !allowExternalOverwrite) {
      options.onExternalChangePath(current.path);
      options.onError("文件已被其他程序修改，请先选择重新载入、覆盖保存或另存为。");
      return false;
    }

    const path = current.path;
    const pathKey = comparablePath(path);
    const selfWritingPaths = getSelfWritingPaths();
    const selfWrittenPaths = getSelfWrittenPaths();
    let writeCompleted = false;
    try {
      if (options.isNative) {
        if (!allowExternalOverwrite) {
          const diskSource = await options.readTextFile(path);
          if (diskSource !== current.source) {
            options.onSaveConflict(path);
            options.onExternalChangePath(path);
            options.onError("文件在保存前已被其他程序修改，请先选择处理方式。");
            return false;
          }
        }
        selfWritingPaths.add(pathKey);
        try {
          await options.writeTextFile(path, draft);
        } finally {
          selfWritingPaths.delete(pathKey);
        }
        writeCompleted = true;
        selfWrittenPaths.set(pathKey, now() + 1_500);
        options.invalidateCache?.(path);
      } else {
        options.downloadText(current.name, draft);
      }

      const rendered = await options.renderSource(path, draft);
      const snapshots = clearDraft(path);
      options.onSaveCommitted({ path, draft, rendered, snapshots });
      options.onExternalChangePath(null);
      return true;
    } catch (cause) {
      selfWritingPaths.delete(pathKey);
      if (!writeCompleted) selfWrittenPaths.delete(pathKey);
      options.onError(errorMessage(cause, "保存失败。"));
      return false;
    }
  };

  return {
    flushDraft,
    confirmDocumentReplacement,
    confirmWorkspaceSwitch,
    openPath,
    reloadExternalChange,
    resolveDraftRecovery,
    saveDocument,
    beginCloseOperation: () => ++closeOperation,
    cancelCloseOperation: () => {
      closeOperation += 1;
    },
    isCurrentCloseOperation: (operation) => operation === closeOperation,
    dispose: () => {
      closeOperation += 1;
    },
  };
}
