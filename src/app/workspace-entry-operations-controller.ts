import type { OpenDocument, RecentFile } from "./types";
import type { WorkspaceSessionController } from "./workspace-session-controller";
import { translate, type Locale, type MessageKey } from "./i18n";
import { isPathWithin, normalizePathKey } from "./path-key";
import { isPathWithinEntry, rebaseWorkspacePath, workspaceEntryAbsolutePath } from "./workspace-entry";
import type { WorkspaceNameInput } from "./workspace-name-input";
import { workspaceNameText } from "./workspace-name-copy";
import { AppError, ERROR_CODES } from "./error-contract";

export type WorkspaceEntryKind = "file" | "folder";
export type WorkspaceTransferMode = "copy" | "move";
export type WorkspaceEntryAction = "rename" | "delete" | "move" | "copy";
export type WorkspaceEntryConfirmationRequest =
  | { type: "delete"; path: string; kind: WorkspaceEntryKind }
  | { type: "save"; path: string; action: WorkspaceEntryAction };

type CurrentDocument = Pick<OpenDocument, "path" | "modified">;

export type WorkspaceEntryOperationsOptions = {
  isNative: () => boolean;
  getLocale: () => Locale;
  getWorkspacePath: () => string | null;
  getCurrentDocument: () => CurrentDocument | null;
  getOpenTabs: () => RecentFile[];
  requestName: WorkspaceNameInput;
  confirmDocumentReplacement: () => Promise<boolean>;
  createNote: (root: string, parentPath: string, name: string) => Promise<string>;
  createFolder: (root: string, parentPath: string, name: string) => Promise<string>;
  confirm: (request: WorkspaceEntryConfirmationRequest) => boolean | Promise<boolean>;
  saveDocument: () => Promise<boolean>;
  openPath: (path: string, preserveMode: boolean) => Promise<boolean>;
  renameEntry: (root: string, entryPath: string, name: string) => Promise<string>;
  deleteEntry: (root: string, entryPath: string) => Promise<void>;
  moveEntry: (root: string, entryPath: string, destinationParentPath: string) => Promise<string>;
  copyEntry: (root: string, entryPath: string, destinationParentPath: string) => Promise<string>;
  duplicateEntry: (root: string, entryPath: string, name: string) => Promise<string>;
  replaceOpenTabs: (tabs: RecentFile[]) => void;
  updateRecentFiles: (update: (files: RecentFile[]) => RecentFile[]) => void;
  invalidateDocumentCache: (paths: string[]) => void;
  releaseDocumentResources: (path: string) => void;
  clearCurrentDocument: () => void;
  refreshWorkspaceChanges: (root: string, paths: string[], rejectOnFailure?: boolean) => Promise<void>;
  session: Pick<WorkspaceSessionController, "getCachedWorkspace" | "updateCachedWorkspace" | "persistWorkspaceSession">;
  setError: (message: string | null) => void;
  notify: (message: string) => void;
};

export type WorkspaceEntryOperationsController = {
  createNote: (parentPath: string) => Promise<boolean>;
  createFolder: (parentPath: string) => Promise<boolean>;
  dispose: () => void;
  duplicate: (entryPath: string, kind: WorkspaceEntryKind) => Promise<boolean>;
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
  let disposed = false;
  const message = (key: MessageKey, values: Record<string, string> = {}): string =>
    translate(options.getLocale(), key).replace(
      /\{(\w+)\}/g,
      (placeholder, name: string) => values[name] ?? placeholder,
    );
  const kindLabel = (kind: WorkspaceEntryKind): string =>
    message(kind === "folder" ? "workspaceEntry.kindFolder" : "workspaceEntry.kindFile");
  const isCurrentRoot = (root: string): boolean => !disposed && samePath(options.getWorkspacePath() ?? "", root);
  const reportError = (root: string, message: string): void => {
    if (isCurrentRoot(root)) options.setError(message);
    else options.notify(message);
  };

  const run = async (operation: () => Promise<boolean>): Promise<boolean> => {
    if (disposed) return false;
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

  const confirmCurrentSave = async (
    root: string,
    entryAbsolutePath: string,
    action: WorkspaceEntryAction,
  ): Promise<"ready" | "cancelled" | "failed"> => {
    if (!isCurrentRoot(root)) return "cancelled";
    const current = options.getCurrentDocument();
    if (!current?.modified || !isPathWithinEntry(current.path, entryAbsolutePath)) return "ready";
    if (!(await options.confirm({ type: "save", path: current.path, action }))) return "cancelled";
    // An application modal yields to other events, unlike window.confirm.
    // Never save a different document or continue an old workspace operation.
    if (!isCurrentRoot(root) || !samePath(options.getCurrentDocument()?.path ?? "", current.path)) return "cancelled";
    if (!(await options.saveDocument())) return "failed";
    return isCurrentRoot(root) && samePath(options.getCurrentDocument()?.path ?? "", current.path)
      ? "ready"
      : "cancelled";
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
      const initialDocument = options.getCurrentDocument();
      return options.requestName(
        {
          action: "rename",
          kind,
          root,
          parentPath: entryPath.replace(/\\/g, "/").split("/").slice(0, -1).join("/"),
          initialName: oldName,
          currentName: oldName,
        },
        async (name) => {
          if (!isCurrentRoot(root) || options.getCurrentDocument() !== initialDocument || !name || name === oldName)
            return "cancelled";
          const saved = await confirmCurrentSave(root, oldPath, "rename");
          if (saved === "failed") throw new AppError(ERROR_CODES.FILE_WRITE_FAILED, "Save preceding rename failed");
          if (saved !== "ready" || !isCurrentRoot(root)) return "cancelled";
          const initialCurrentPath = options.getCurrentDocument()?.path ?? null;
          const nextPath = await options.renameEntry(root, entryPath, name);
          await finish(
            root,
            oldPath,
            nextPath,
            initialCurrentPath,
            message("workspaceEntry.renamed", { kind: kindLabel(kind), name }),
            message("workspaceEntry.renameReopenFailure"),
          );
          return "done";
        },
      );
    });

  const duplicate = (entryPath: string, kind: WorkspaceEntryKind): Promise<boolean> =>
    run(async () => {
      const root = currentRoot(message("workspaceEntry.actionCopy"), entryPath);
      if (!root) return false;
      const text = (key: Parameters<typeof workspaceNameText>[1], values?: Record<string, string>) =>
        workspaceNameText(options.getLocale(), key, values);
      const currentName = fileNameFromPath(entryPath);
      const extensionIndex = kind === "file" ? currentName.lastIndexOf(".") : -1;
      const initialName =
        extensionIndex > 0
          ? `${currentName.slice(0, extensionIndex)}${text("copySuffix")}${currentName.slice(extensionIndex)}`
          : `${currentName}${text("copySuffix")}`;
      const initialDocument = options.getCurrentDocument();
      return options.requestName(
        {
          action: "duplicate",
          kind,
          root,
          currentName,
          initialName,
          sourcePath: workspaceEntryAbsolutePath(root, entryPath),
          parentPath: entryPath.replace(/\\/g, "/").split("/").slice(0, -1).join("/"),
        },
        async (name) => {
          if (!isCurrentRoot(root)) return "cancelled";
          // Duplicate the saved disk content without saving or replacing the editor.
          const path = await options.duplicateEntry(root, entryPath, name);
          if (disposed) return "done";
          options.invalidateDocumentCache([path]);
          let warning: string | null = null;
          try {
            await options.refreshWorkspaceChanges(root, [path], true);
          } catch {
            warning = text("copyRefreshFailed");
          }
          if (!disposed) {
            options.notify(text("copyCreated", { name: fileNameFromPath(path) }));
            if (isCurrentRoot(root) && options.getCurrentDocument() === initialDocument) options.setError(warning);
            else if (warning) options.notify(warning);
          }
          return "done";
        },
      );
    });

  const remove = (entryPath: string, kind: WorkspaceEntryKind): Promise<boolean> =>
    run(async () => {
      const root = currentRoot(message("workspaceEntry.actionDelete"), entryPath);
      if (!root) return false;
      const oldPath = workspaceEntryAbsolutePath(root, entryPath);
      const label = fileNameFromPath(entryPath);
      if (!(await options.confirm({ type: "delete", path: oldPath, kind })) || !isCurrentRoot(root)) return false;
      if ((await confirmCurrentSave(root, oldPath, "delete")) !== "ready" || !isCurrentRoot(root)) return false;
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
      if ((await confirmCurrentSave(root, oldPath, mode)) !== "ready" || !isCurrentRoot(root)) return false;
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

  const create = (parentPath: string, note: boolean): Promise<boolean> =>
    run(async () => {
      const text = (key: Parameters<typeof workspaceNameText>[1], values?: Record<string, string>) =>
        workspaceNameText(options.getLocale(), key, values);
      const root = options.getWorkspacePath();
      if (!root || !options.isNative()) {
        options.setError(text("requireWorkspace"));
        return false;
      }
      const initialDocument = options.getCurrentDocument();
      return options.requestName(
        {
          action: note ? "create-note" : "create-folder",
          kind: note ? "file" : "folder",
          root,
          parentPath,
          initialName: text(note ? "untitledNote" : "untitledFolder"),
        },
        async (name) => {
          const valid = () => isCurrentRoot(root) && options.getCurrentDocument() === initialDocument;
          if (!valid()) return "cancelled";
          if (note && (!(await options.confirmDocumentReplacement()) || !valid())) return "cancelled";
          const path = await (note ? options.createNote : options.createFolder)(root, parentPath, name);
          // The disk operation has succeeded. Refresh/open failures must not invite
          // another create, and a changed workspace/document must retain its view.
          let warning: string | null = null;
          try {
            await options.refreshWorkspaceChanges(root, [path]);
          } catch {
            warning = text("refreshFailed");
          }
          if (note && valid()) {
            try {
              if (!(await options.openPath(path, false))) warning ??= text("openFailed");
            } catch {
              warning ??= text("openFailed");
            }
          }
          if (!disposed) {
            options.notify(text("created", { name: fileNameFromPath(path) }));
            if (isCurrentRoot(root) && (valid() || samePath(options.getCurrentDocument()?.path ?? "", path)))
              options.setError(warning);
            else if (warning) options.notify(warning);
          }
          return "done";
        },
      );
    });
  return {
    rename,
    duplicate,
    remove,
    transfer,
    createNote: (parent) => create(parent, true),
    createFolder: (parent) => create(parent, false),
    dispose: () => {
      disposed = true;
    },
  };
}
