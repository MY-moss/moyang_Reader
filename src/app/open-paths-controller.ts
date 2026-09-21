import type { OpenDocument, OpenPath } from "./types";
import { normalizePathKey } from "./path-key";
import { isSameDocumentPath, shouldConfirmWorkspaceSwitch } from "./document-transition";

export type OpenPathsOutcome = {
  openedCount: number;
  failedCount: number;
  duplicateCount: number;
  cancelled: boolean;
};

export type OpenPathsControllerOptions = {
  getCurrentDocument: () => Pick<OpenDocument, "path" | "modified"> | null;
  getWorkspacePath: () => string | null;
  isNative: () => boolean;
  authorizeStoredPath: (path: string, workspace: boolean) => Promise<string>;
  confirmWorkspaceSwitch: (nextWorkspacePath: string, action: string) => boolean;
  confirmDocumentReplacement: (nextPaths: readonly string[], action: string) => boolean;
  loadWorkspace: (path: string) => Promise<boolean>;
  openPath: (path: string) => Promise<boolean>;
  setError: (message: string | null) => void;
};

export type OpenPathsController = {
  handleOpenPaths: (paths: OpenPath[]) => Promise<OpenPathsOutcome>;
};

function cancelledOutcome(): OpenPathsOutcome {
  return {
    openedCount: 0,
    failedCount: 0,
    duplicateCount: 0,
    cancelled: true,
  };
}

export function createOpenPathsController(options: OpenPathsControllerOptions): OpenPathsController {
  const handleOpenPaths = async (paths: OpenPath[]): Promise<OpenPathsOutcome> => {
    const currentDocument = options.getCurrentDocument();
    const workspacePath = options.getWorkspacePath();
    const workspacePaths = paths.filter((entry) => entry.kind === "workspace").map((entry) => entry.path);
    const workspacePathToConfirm = workspacePaths.find((path) =>
      shouldConfirmWorkspaceSwitch(Boolean(currentDocument?.modified), workspacePath, path),
    );
    if (workspacePathToConfirm && !options.confirmWorkspaceSwitch(workspacePathToConfirm, "切换阅读库")) {
      return cancelledOutcome();
    }

    const currentModifiedPath = currentDocument?.modified ? currentDocument.path : null;
    const pathsToProcess = currentModifiedPath
      ? paths.filter((entry) => entry.kind !== "document" || !isSameDocumentPath(entry.path, currentModifiedPath))
      : paths;
    const documentPaths = pathsToProcess.filter((entry) => entry.kind === "document").map((entry) => entry.path);
    if (!options.confirmDocumentReplacement(documentPaths, "打开新文档")) {
      return cancelledOutcome();
    }

    const seen = new Set<string>();
    let openedCount = 0;
    let failedCount = 0;
    let duplicateCount = 0;
    for (const entry of pathsToProcess) {
      const key = `${entry.kind}:${normalizePathKey(entry.path)}`;
      if (seen.has(key)) {
        duplicateCount += 1;
        continue;
      }
      seen.add(key);

      try {
        const authorizedPath = options.isNative()
          ? await options.authorizeStoredPath(entry.path, entry.kind === "workspace")
          : entry.path;
        if (entry.kind === "workspace") {
          await options.loadWorkspace(authorizedPath);
          openedCount += 1;
        } else if (await options.openPath(authorizedPath)) {
          openedCount += 1;
        } else {
          failedCount += 1;
        }
      } catch (cause) {
        failedCount += 1;
        options.setError(cause instanceof Error ? cause.message : "无法打开传入的路径。");
      }
    }

    return { openedCount, failedCount, duplicateCount, cancelled: false };
  };

  return { handleOpenPaths };
}
