import type { OpenDocument, RecentFile } from "./types";
import type { WorkspaceSessionController } from "./workspace-session-controller";
import { translate, type Locale, type MessageKey } from "./i18n";
import { isPathWithin, normalizePathKey } from "./path-key";
import { isPathWithinEntry, rebaseWorkspacePath, workspaceEntryAbsolutePath } from "./workspace-entry";

export type WorkspaceEntryKind = "file" | "folder";
export type WorkspaceTransferMode = "copy" | "move";

type CurrentDocument = Pick<OpenDocument, "path" | "modified">;

export type WorkspaceEntryOperationsOptions = {
  isNative: () => boolean;
  getLocale: () => Locale;
  getWorkspacePath: () => string | null;
  getCurrentDocument: () => CurrentDocument | null;
  getOpenTabs: () => RecentFile[];
  prompt: (message: string, value: string) => string | null;
  confirm: (message: string) => boolean;
  saveDocument: () => Promise<boolean>;
  openPath: (path: string, preserveMode: boolean) => Promise<boolean>;
  renameEntry: (root: string, entryPath: string, name: string) => Promise<string>;
  deleteEntry: (root: string, entryPath: string) => Promise<void>;
  moveEntry: (root: string, entryPath: string, destinationParentPath: string) => Promise<string>;
  copyEntry: (root: string, entryPath: string, destinationParentPath: string) => Promise<string>;
  replaceOpenTabs: (tabs: RecentFile[]) => void;
  updateRecentFiles: (update: (files: RecentFile[]) => RecentFile[]) => void;
  invalidateDocumentCache: (paths: string[]) => void;
  releaseDocumentResources: (path: string) => void;
  clearCurrentDocument: () => void;
  refreshWorkspaceChanges: (root: string, paths: string[]) => Promise<void>;
  session: Pick<WorkspaceSessionController, "getCachedWorkspace" | "updateCachedWorkspace" | "persistWorkspaceSession">;
  setError: (message: string | null) => void;
  notify: (message: string) => void;
};

export type WorkspaceEntryOperationsController = {
  rename: (entryPath: string, kind: WorkspaceEntryKind) => Promise<boolean>;
  remove: (entryPath: string, kind: WorkspaceEntryKind) => Promise<boolean>;
  transfer: (
    entryPath: string,
    destinationParentPath: string,
    mode: WorkspaceTransferMode,
    kind: WorkspaceEntryKind,
  ) => Promise<boolean>;
};

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function samePath(left: string, right: string): boolean {
  return normalizePathKey(left) === normalizePathKey(right);
}

function updateFilePath(file: RecentFile, oldPath: string, nextPath: string): RecentFile {
  const path = rebaseWorkspacePath(file.path, oldPath, nextPath);
  return path === file.path ? file : { ...file, path, name: fileNameFromPath(path) };
}

export function createWorkspaceEntryOperationsController(
  options: WorkspaceEntryOperationsOptions,
): WorkspaceEntryOperationsController {
  let busy = false;
  const message = (key: MessageKey, values: Record<string, string> = {}): string =>
    translate(options.getLocale(), key).replace(
      /\{(\w+)\}/g,
      (placeholder, name: string) => values[name] ?? placeholder,
    );
  const kindLabel = (kind: WorkspaceEntryKind): string =>
    message(kind === "folder" ? "workspaceEntry.kindFolder" : "workspaceEntry.kindFile");
  const isCurrentRoot = (root: string): boolean => samePath(options.getWorkspacePath() ?? "", root);
  const reportError = (root: string, message: string): void => {
    if (isCurrentRoot(root)) options.setError(message);
    else options.notify(message);
  };

  const run = async (operation: () => Promise<boolean>): Promise<boolean> => {
    if (busy) {
      options.setError(message("workspaceEntry.busy"));
      return false;
    }
    busy = true;
    try {
      return await operation();
    } finally {
      busy = false;
    }
  };

  const currentRoot = (action: string, entryPath: string): string | null => {
    const root = options.getWorkspacePath();
    if (root && options.isNative() && entryPath.trim()) return root;
    options.setError(message("workspaceEntry.requireWorkspace", { action }));
    return null;
  };

  const confirmCurrentSave = async (entryAbsolutePath: string, action: string): Promise<boolean> => {
    const current = options.getCurrentDocument();
    if (!current?.modified || !isPathWithinEntry(current.path, entryAbsolutePath)) return true;
    return options.confirm(message("workspaceEntry.confirmDirty", { action })) && (await options.saveDocument());
  };

  const updateSession = (root: string, oldPath: string, nextPath: string | null, tabs: RecentFile[]): void => {
    const cached = options.session.getCachedWorkspace(root);
    if (!cached) return;
    const nextTabs = tabs.filter((tab) => !tab.path.startsWith("browser://") && isPathWithin(tab.path, root));
    const activeDocumentPath = cached.activeDocumentPath
      ? nextPath
        ? rebaseWorkspacePath(cached.activeDocumentPath, oldPath, nextPath)
        : isPathWithinEntry(cached.activeDocumentPath, oldPath)
          ? null
          : cached.activeDocumentPath
      : null;
    options.session.updateCachedWorkspace(root, { tabs: nextTabs, activeDocumentPath });
    options.session.persistWorkspaceSession(root);
  };

  const commitPaths = (
    root: string,
    oldPath: string,
    nextPath: string | null,
  ): { nextTab: RecentFile | null; current: CurrentDocument | null } => {
    const active = isCurrentRoot(root);
    const cached = options.session.getCachedWorkspace(root);
    const tabs = active ? options.getOpenTabs() : (cached?.tabs ?? []);
    const current = active ? options.getCurrentDocument() : null;
    const currentIndex = current ? tabs.findIndex((tab) => samePath(tab.path, current.path)) : -1;
    const nextTabs = nextPath
      ? tabs.map((tab) => updateFilePath(tab, oldPath, nextPath))
      : tabs.filter((tab) => !isPathWithinEntry(tab.path, oldPath));

    if (!nextPath) {
      for (const tab of tabs) {
        if (isPathWithinEntry(tab.path, oldPath) && (!current || !samePath(tab.path, current.path))) {
          options.releaseDocumentResources(tab.path);
        }
      }
    }
    options.invalidateDocumentCache(nextPath ? [oldPath, nextPath] : [oldPath]);
    if (active) options.replaceOpenTabs(nextTabs);
    options.updateRecentFiles((files) =>
      nextPath
        ? files.map((file) => updateFilePath(file, oldPath, nextPath))
        : files.filter((file) => !isPathWithinEntry(file.path, oldPath)),
    );
    updateSession(root, oldPath, nextPath, nextTabs);
    return { nextTab: nextTabs[currentIndex] ?? nextTabs[currentIndex - 1] ?? null, current };
  };

  const finish = async (
    root: string,
    oldPath: string,
    nextPath: string | null,
    initialCurrentPath: string | null,
    notice: string,
    reopenFailure: string,
  ): Promise<void> => {
    const { nextTab, current } = commitPaths(root, oldPath, nextPath);
    let warning: string | null = null;
    if (current && isPathWithinEntry(current.path, oldPath)) {
      if (!initialCurrentPath || !samePath(current.path, initialCurrentPath) || current.modified) {
        warning = message("workspaceEntry.staleEdits");
      } else {
        options.releaseDocumentResources(current.path);
        options.clearCurrentDocument();
        const target = nextPath ? rebaseWorkspacePath(current.path, oldPath, nextPath) : nextTab?.path;
        if (target) {
          try {
            if (!(await options.openPath(target, true))) warning = reopenFailure;
          } catch {
            warning = reopenFailure;
          }
        }
      }
    }
    try {
      await options.refreshWorkspaceChanges(root, nextPath ? [oldPath, nextPath] : [oldPath]);
    } catch {
      warning ??= message("workspaceEntry.refreshFailure");
    }
    options.notify(notice);
    if (isCurrentRoot(root)) options.setError(warning);
    else if (warning) options.notify(warning);
  };

  const rename = (entryPath: string, kind: WorkspaceEntryKind): Promise<boolean> =>
    run(async () => {
      const root = currentRoot(message("workspaceEntry.actionRename"), entryPath);
      if (!root) return false;
      const oldPath = workspaceEntryAbsolutePath(root, entryPath);
      const oldName = fileNameFromPath(entryPath);
      const name = options
        .prompt(message(kind === "folder" ? "workspaceEntry.renameFolder" : "workspaceEntry.renameFile"), oldName)
        ?.trim();
      if (!name || name === oldName) return false;
      if (!(await confirmCurrentSave(oldPath, message("workspaceEntry.actionRename"))) || !isCurrentRoot(root))
        return false;
      const initialCurrentPath = options.getCurrentDocument()?.path ?? null;
      let nextPath: string;
      try {
        nextPath = await options.renameEntry(root, entryPath, name);
      } catch (cause) {
        reportError(root, cause instanceof Error ? cause.message : message("workspaceEntry.renameFailure"));
        return false;
      }
      await finish(
        root,
        oldPath,
        nextPath,
        initialCurrentPath,
        message("workspaceEntry.renamed", { kind: kindLabel(kind), name }),
        message("workspaceEntry.renameReopenFailure"),
      );
      return true;
    });

  const remove = (entryPath: string, kind: WorkspaceEntryKind): Promise<boolean> =>
    run(async () => {
      const root = currentRoot(message("workspaceEntry.actionDelete"), entryPath);
      if (!root) return false;
      const oldPath = workspaceEntryAbsolutePath(root, entryPath);
      const label = fileNameFromPath(entryPath);
      const confirmation = message(
        kind === "folder" ? "workspaceEntry.confirmDeleteFolder" : "workspaceEntry.confirmDeleteFile",
        { name: label },
      );
      if (!options.confirm(confirmation)) return false;
      if (!(await confirmCurrentSave(oldPath, message("workspaceEntry.actionDelete"))) || !isCurrentRoot(root))
        return false;
      const initialCurrentPath = options.getCurrentDocument()?.path ?? null;
      try {
        await options.deleteEntry(root, entryPath);
      } catch (cause) {
        reportError(root, cause instanceof Error ? cause.message : message("workspaceEntry.deleteFailure"));
        return false;
      }
      await finish(
        root,
        oldPath,
        null,
        initialCurrentPath,
        message(kind === "folder" ? "workspaceEntry.deletedFolder" : "workspaceEntry.deletedFile", { name: label }),
        message("workspaceEntry.deleteReopenFailure"),
      );
      return true;
    });

  const transfer = (
    entryPath: string,
    destinationParentPath: string,
    mode: WorkspaceTransferMode,
    kind: WorkspaceEntryKind,
  ): Promise<boolean> =>
    run(async () => {
      const action = message(mode === "move" ? "workspaceEntry.actionMove" : "workspaceEntry.actionCopy");
      const root = currentRoot(action, entryPath);
      if (!root) return false;
      const oldPath = workspaceEntryAbsolutePath(root, entryPath);
      if (!(await confirmCurrentSave(oldPath, action)) || !isCurrentRoot(root)) return false;
      const initialCurrentPath = options.getCurrentDocument()?.path ?? null;
      let nextPath: string;
      try {
        nextPath =
          mode === "move"
            ? await options.moveEntry(root, entryPath, destinationParentPath)
            : await options.copyEntry(root, entryPath, destinationParentPath);
      } catch (cause) {
        reportError(
          root,
          cause instanceof Error ? cause.message : message("workspaceEntry.transferFailure", { action }),
        );
        return false;
      }
      if (mode === "move") {
        await finish(
          root,
          oldPath,
          nextPath,
          initialCurrentPath,
          message("workspaceEntry.moved", { kind: kindLabel(kind), name: fileNameFromPath(nextPath) }),
          message("workspaceEntry.moveReopenFailure"),
        );
      } else {
        options.invalidateDocumentCache([nextPath]);
        try {
          await options.refreshWorkspaceChanges(root, [nextPath]);
          if (isCurrentRoot(root)) options.setError(null);
        } catch {
          reportError(root, message("workspaceEntry.copyRefreshFailure"));
        }
        options.notify(message("workspaceEntry.copied", { kind: kindLabel(kind), name: fileNameFromPath(nextPath) }));
      }
      return true;
    });

  return { rename, remove, transfer };
}
