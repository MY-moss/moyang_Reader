import { clearDraftSnapshot, saveDraftSnapshot, type DraftSaveResult, type DraftSnapshot } from "./draft-recovery";
import {
  isSameDocumentPath,
  shouldConfirmDocumentReplacement,
  shouldConfirmWorkspaceSwitch,
} from "./document-transition";
import { normalizePathKey } from "./path-key";
import { classifySaveFailure, formatSaveFailure, type SaveFailureKind } from "./save-failure";
import { isEditableDocument } from "../lib/document-adapters";
import type { OpenDocument, RenderedMarkdown } from "./types";

export type DocumentOpenNavigation = "sync" | "push" | "back" | "forward";

export type DraftFlushOutcome = "not-needed" | "saved" | "unavailable" | "failed";

export type DocumentTransitionAction =
  "open" | "switch" | "back" | "new-document" | "open-draft" | "close-tabs" | "switch-workspace" | "reload";

export type DocumentTransitionConfirmationRequest = {
  action: DocumentTransitionAction;
  path: string;
  draftSaved: boolean;
  targets: readonly string[];
};

export type DocumentSaveCommit = {
  path: string;
  draft: string;
  rendered: RenderedMarkdown;
  snapshots: DraftSnapshot[];
};

export type DocumentSaveFailure = {
  kind: SaveFailureKind;
  draftSaved: boolean;
  snapshot: DraftSnapshot | null;
};

export type DocumentSessionControllerOptions = {
  getCurrentDocument: () => OpenDocument | null;
  getSourceDraft: () => string;
  getWorkspacePath: () => string | null;
  isNative: boolean;
  readTextFile: (path: string) => Promise<string>;
  writeTextFile: (path: string, contents: string) => Promise<void>;
  renderSource: (path: string, source: string) => Promise<RenderedMarkdown>;
  shouldRenderOnSave?: (document: OpenDocument) => boolean;
  downloadText: (name: string, contents: string) => void;
  loadDocument: (path: string, preserveMode: boolean) => Promise<boolean>;
  commitNavigation: (path: string, navigation: DocumentOpenNavigation, previousPath: string | null) => void;
  onDraftSaved?: (result: DraftSaveResult) => boolean;
  onSaveCommitted: (commit: DocumentSaveCommit) => void;
  onSaveConflict: (path: string) => void;
  onSaveFailure?: (failure: DocumentSaveFailure) => void;
  onExternalChangePath: (path: string | null) => void;
  onError: (message: string) => void;
  invalidateCache?: (path: string) => void;
  selfWritingPaths?: Set<string>;
  selfWrittenPaths?: Map<string, number>;
  getSelfWritingPaths?: () => Set<string>;
  getSelfWrittenPaths?: () => Map<string, number>;
  clearDraft?: (path: string) => DraftSnapshot[];
  saveDraft?: (snapshot: DraftSnapshot) => DraftSaveResult;
  confirm?: (request: DocumentTransitionConfirmationRequest) => boolean | Promise<boolean>;
  now?: () => number;
};

export type DocumentSessionController = {
  flushDraft: () => DraftFlushOutcome;
  confirmTransition: (action: DocumentTransitionAction, targets?: readonly string[]) => Promise<boolean>;
  confirmDocumentReplacement: (nextPaths: readonly string[], action: DocumentTransitionAction) => Promise<boolean>;
  confirmWorkspaceSwitch: (nextWorkspacePath: string, action: DocumentTransitionAction) => Promise<boolean>;
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
  const confirm = options.confirm ?? (() => false);
  const now = options.now ?? Date.now;
  const fallbackSelfWritingPaths = options.selfWritingPaths ?? new Set<string>();
  const fallbackSelfWrittenPaths = options.selfWrittenPaths ?? new Map<string, number>();
  const getSelfWritingPaths = options.getSelfWritingPaths ?? (() => fallbackSelfWritingPaths);
  const getSelfWrittenPaths = options.getSelfWrittenPaths ?? (() => fallbackSelfWrittenPaths);
  let closeOperation = 0;
  let disposed = false;
  let confirmationPending = false;

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

  const preserveDraftAfterSaveFailure = (): { draftSaved: boolean; snapshot: DraftSnapshot | null } => {
    const current = options.getCurrentDocument();
    const snapshot =
      current?.modified && isEditableDocument(current.kind)
        ? {
            path: current.path,
            draft: options.getSourceDraft(),
            baseSource: current.source,
            savedAt: now(),
          }
        : null;
    if (!snapshot) return { draftSaved: false, snapshot: null };

    try {
      const result = saveDraft(snapshot);
      return {
        draftSaved: result.ok && onDraftSaved(result),
        snapshot: result.ok ? snapshot : null,
      };
    } catch {
      return { draftSaved: false, snapshot: null };
    }
  };

  const reportSaveFailure = (cause: unknown): void => {
    const recovery = preserveDraftAfterSaveFailure();
    options.onSaveFailure?.({
      kind: classifySaveFailure(cause),
      draftSaved: recovery.draftSaved,
      snapshot: recovery.snapshot,
    });
    options.onError(formatSaveFailure(cause, recovery.draftSaved));
  };

  const flushDraft = (): DraftFlushOutcome => {
    const current = options.getCurrentDocument();
    if (!current?.modified || !isEditableDocument(current.kind)) return "not-needed";
    if (current.path.startsWith("browser://")) return "unavailable";

    const result = saveCurrentDraft();
    if (!result) return "not-needed";
    return onDraftSaved(result) ? "saved" : "failed";
  };

  const confirmTransition = async (
    action: DocumentTransitionAction,
    targets: readonly string[] = [],
  ): Promise<boolean> => {
    if (disposed || confirmationPending) return false;
    const current = options.getCurrentDocument();
    if (!current?.modified) return true;
    const workspace = options.getWorkspacePath();
    const draft = options.getSourceDraft();
    confirmationPending = true;
    try {
      // Reload has historically preserved browser drafts too; other browser transitions warn of loss.
      const result = action === "reload" ? saveCurrentDraft() : null;
      const outcome = action === "reload" ? (result && onDraftSaved(result) ? "saved" : "failed") : flushDraft();
      if (outcome === "failed") return false;
      const accepted = await confirm({
        action,
        path: current.path,
        draftSaved: outcome === "saved",
        targets: [...targets],
      });
      const latest = options.getCurrentDocument();
      return Boolean(
        accepted &&
        !disposed &&
        latest &&
        isSameDocumentPath(latest.path, current.path) &&
        latest.source === current.source &&
        latest.modified === current.modified &&
        latest.externallyModified === current.externallyModified &&
        options.getSourceDraft() === draft &&
        options.getWorkspacePath() === workspace,
      );
    } finally {
      confirmationPending = false;
    }
  };

  const confirmDocumentReplacement = async (
    nextPaths: readonly string[],
    action: DocumentTransitionAction,
  ): Promise<boolean> => {
    if (disposed || confirmationPending) return false;
    if (!shouldConfirmDocumentReplacement(options.getCurrentDocument(), nextPaths)) return true;
    return confirmTransition(action, nextPaths);
  };

  const confirmWorkspaceSwitch = async (
    nextWorkspacePath: string,
    action: DocumentTransitionAction,
  ): Promise<boolean> => {
    if (disposed || confirmationPending) return false;
    const current = options.getCurrentDocument();
    if (!shouldConfirmWorkspaceSwitch(Boolean(current?.modified), options.getWorkspacePath(), nextWorkspacePath)) {
      return true;
    }
    return confirmTransition(action, [nextWorkspacePath]);
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
      if (!(await confirmTransition("reload"))) return;
    }

    if (disposed || confirmationPending) return;

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
      reportSaveFailure({ code: "FILE_CONFLICT", message: "文件已被其他程序修改" });
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
            reportSaveFailure({ code: "FILE_CONFLICT", message: "文件在保存前已被其他程序修改" });
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

      const rendered =
        options.shouldRenderOnSave?.(current) === false ? current.rendered : await options.renderSource(path, draft);
      const snapshots = clearDraft(path);
      options.onSaveCommitted({ path, draft, rendered, snapshots });
      options.onExternalChangePath(null);
      return true;
    } catch (cause) {
      selfWritingPaths.delete(pathKey);
      if (!writeCompleted) selfWrittenPaths.delete(pathKey);
      reportSaveFailure(cause);
      return false;
    }
  };

  return {
    flushDraft,
    confirmTransition,
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
      disposed = true;
      closeOperation += 1;
    },
  };
}
