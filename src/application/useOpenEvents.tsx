import { useCallback, useEffect } from "react";
import { recordDesktopTestEvent } from "../platform/test-diagnostics";
import { isSameDocumentPath } from "../features/recovery/document-transition";
import { resolveExternalChangeAction } from "../features/recovery/external-change";
import { markGettingStartedSeen } from "../features/settings/onboarding";
import {
  authorizeStoredPath,
  chooseDocumentPaths,
  initialPaths,
  isTauriRuntime,
  resolveOpenPaths,
  searchWorkspace,
  subscribeToFileDrop,
  subscribeToOpenPaths,
  subscribeToWorkspaceChanges,
} from "../platform/bridge";
import {
  loadLastDocumentPath,
  loadMountedWorkspaces,
  loadOpenTabs,
  loadWorkspacePath,
  loadWorkspaceSessions,
  saveLastDocumentPath,
  saveMountedWorkspaces,
  saveWorkspacePath,
} from "../platform/storage";
import type { RecentFile, RecentWorkspace } from "../shared/types";
import { comparablePath, fileNameFromPath } from "./support";
import type { useDocumentSession } from "./useDocumentSession";
import type { useReaderState } from "./useReaderState";
import type { useWorkspaceSession } from "./useWorkspaceSession";
type Input = Pick<ReturnType<typeof useDocumentSession>, "handleOpenPaths" | "saveDocument" | "openPath"> &
  Pick<
    ReturnType<typeof useReaderState>,
    | "inputRef"
    | "setGuideOpen"
    | "documentStateRef"
    | "setExternalOverwriteConfirmationOpen"
    | "setMountedWorkspaces"
    | "workspacePathRef"
    | "setWorkspacePath"
    | "setWorkspaceFiles"
    | "setWorkspaceFolders"
    | "setWorkspaceIndex"
    | "setOpenTabs"
    | "setTabSessionReady"
    | "setError"
    | "workspacePath"
    | "pendingWorkspacePathsRef"
    | "setWorkspaceWatchError"
    | "documentCacheRef"
    | "workspaceReloadTimerRef"
    | "selfWrittenPathsRef"
    | "selfWritingPathsRef"
    | "setExternalChangePath"
    | "setDocumentState"
    | "workspaceQuery"
    | "setWorkspaceResults"
    | "setWorkspaceSearchLoading"
    | "workspaceRevision"
  > &
  Pick<ReturnType<typeof useWorkspaceSession>, "handleChooseWorkspace" | "loadWorkspace" | "refreshWorkspaceChanges">;
export function useOpenEvents({
  handleOpenPaths,
  inputRef,
  setGuideOpen,
  handleChooseWorkspace,
  documentStateRef,
  setExternalOverwriteConfirmationOpen,
  saveDocument,
  setMountedWorkspaces,
  loadWorkspace,
  workspacePathRef,
  setWorkspacePath,
  setWorkspaceFiles,
  setWorkspaceFolders,
  setWorkspaceIndex,
  setOpenTabs,
  openPath,
  setTabSessionReady,
  setError,
  workspacePath,
  pendingWorkspacePathsRef,
  setWorkspaceWatchError,
  documentCacheRef,
  workspaceReloadTimerRef,
  refreshWorkspaceChanges,
  selfWrittenPathsRef,
  selfWritingPathsRef,
  setExternalChangePath,
  setDocumentState,
  workspaceQuery,
  setWorkspaceResults,
  setWorkspaceSearchLoading,
  workspaceRevision,
}: Input) {
  const openSelectedFile = useCallback(async () => {
    const nativePaths = await chooseDocumentPaths();
    if (isTauriRuntime()) {
      if (nativePaths.length > 0) {
        await handleOpenPaths(nativePaths.map((path) => ({ path, kind: "document" as const })));
      }
      return;
    }
    inputRef.current?.click();
  }, [handleOpenPaths, inputRef]);

  const closeGettingStarted = useCallback(() => {
    markGettingStartedSeen();
    setGuideOpen(false);
  }, [setGuideOpen]);

  const openDocumentFromGuide = useCallback(() => {
    closeGettingStarted();
    void openSelectedFile();
  }, [closeGettingStarted, openSelectedFile]);

  const addWorkspaceFromGuide = useCallback(() => {
    closeGettingStarted();
    void handleChooseWorkspace();
  }, [closeGettingStarted, handleChooseWorkspace]);

  const overwriteExternalChange = useCallback(() => {
    const current = documentStateRef.current;
    if (!current?.externallyModified) return;
    setExternalOverwriteConfirmationOpen(true);
  }, [documentStateRef, setExternalOverwriteConfirmationOpen]);

  const cancelExternalOverwrite = useCallback(() => {
    setExternalOverwriteConfirmationOpen(false);
  }, [setExternalOverwriteConfirmationOpen]);

  const confirmExternalOverwrite = useCallback(() => {
    setExternalOverwriteConfirmationOpen(false);
    void saveDocument(true);
  }, [saveDocument, setExternalOverwriteConfirmationOpen]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let active = true;

    void (async () => {
      const paths = await initialPaths();
      if (isTauriRuntime()) {
        const hasStartupWorkspace = paths.some((entry) => entry.kind === "workspace");
        const savedWorkspace = loadWorkspacePath();
        if (!hasStartupWorkspace) {
          const candidates = [
            ...(savedWorkspace
              ? [
                  {
                    path: savedWorkspace,
                    name: fileNameFromPath(savedWorkspace.replace(/[\\/]+$/, "")) || savedWorkspace,
                  },
                ]
              : []),
            ...loadMountedWorkspaces(),
          ];
          const authorizedMounts: RecentWorkspace[] = [];
          const seen = new Set<string>();
          for (const candidate of candidates) {
            const candidateKey = comparablePath(candidate.path);
            if (!candidateKey || seen.has(candidateKey)) continue;
            seen.add(candidateKey);
            try {
              const authorizedWorkspace = await authorizeStoredPath(candidate.path, true);
              if (!active) return;
              authorizedMounts.push({
                path: authorizedWorkspace,
                name: fileNameFromPath(authorizedWorkspace.replace(/[\\/]+$/, "")) || candidate.name,
              });
            } catch {
              // Stale mounted workspaces are discarded without blocking launch.
            }
          }
          if (!active) return;
          setMountedWorkspaces(authorizedMounts);
          saveMountedWorkspaces(authorizedMounts);
          const activeWorkspace =
            authorizedMounts.find(
              (workspace) => comparablePath(workspace.path) === comparablePath(savedWorkspace ?? ""),
            ) ?? authorizedMounts[0];
          if (activeWorkspace) {
            await loadWorkspace(activeWorkspace.path, true);
          } else if (candidates.length > 0) {
            saveWorkspacePath(null);
            workspacePathRef.current = null;
            setWorkspacePath(null);
            setWorkspaceFiles([]);
            setWorkspaceFolders([]);
            setWorkspaceIndex([]);
          }
        }

        if (paths.length === 0) {
          const activeWorkspacePath = loadWorkspacePath();
          const workspaceSession = activeWorkspacePath
            ? loadWorkspaceSessions().find(
                (session) => comparablePath(session.path) === comparablePath(activeWorkspacePath),
              )
            : undefined;
          const restoredTabs: RecentFile[] = [];
          for (const tab of workspaceSession?.tabs ?? loadOpenTabs()) {
            try {
              const authorizedDocument = await authorizeStoredPath(tab.path, false);
              if (!active) return;
              restoredTabs.push({ path: authorizedDocument, name: fileNameFromPath(authorizedDocument) });
            } catch {
              // Stale tabs are discarded without blocking the next launch.
            }
          }
          if (!active) return;
          setOpenTabs(restoredTabs);

          if (!workspaceSession) {
            const lastDocument = loadLastDocumentPath();
            const activeTab =
              restoredTabs.find((tab) => comparablePath(tab.path) === comparablePath(lastDocument ?? "")) ??
              restoredTabs[restoredTabs.length - 1];
            if (activeTab) {
              await openPath(activeTab.path);
            } else if (lastDocument) {
              try {
                const authorizedDocument = await authorizeStoredPath(lastDocument, false);
                if (!active) return;
                await openPath(authorizedDocument);
              } catch {
                if (active) saveLastDocumentPath(null);
              }
            }
          }
        }
      }

      if (active) await handleOpenPaths(paths);
      if (active) setTabSessionReady(true);
      const dispose = await subscribeToOpenPaths((nextPaths) => void handleOpenPaths(nextPaths));
      if (active) unlisten = dispose;
      else dispose?.();
    })();

    return () => {
      active = false;
      unlisten?.();
    };
  }, [
    handleOpenPaths,
    loadWorkspace,
    openPath,
    setMountedWorkspaces,
    setOpenTabs,
    setTabSessionReady,
    setWorkspaceFiles,
    setWorkspaceFolders,
    setWorkspaceIndex,
    setWorkspacePath,
    workspacePathRef,
  ]);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let active = true;
    let unlisten: (() => void) | null = null;
    void subscribeToFileDrop((paths) => {
      if (!active) return;
      void resolveOpenPaths(paths)
        .then((entries) => {
          if (active) return handleOpenPaths(entries);
          return undefined;
        })
        .catch((cause) => {
          if (active) setError(cause instanceof Error ? cause.message : "无法打开拖入的路径。");
        });
    }).then((dispose) => {
      if (active) unlisten = dispose;
      else dispose?.();
    });

    return () => {
      active = false;
      unlisten?.();
    };
  }, [handleOpenPaths, setError]);

  useEffect(() => {
    if (!workspacePath || !isTauriRuntime()) return;

    let active = true;
    let unwatch: (() => void) | null = null;
    const pendingWorkspacePaths = pendingWorkspacePathsRef.current;
    setWorkspaceWatchError(null);

    void subscribeToWorkspaceChanges(workspacePath, (paths) => {
      recordDesktopTestEvent("workspace-event", paths);
      if (!active) return;

      documentCacheRef.current.invalidate(paths);
      for (const path of paths) pendingWorkspacePaths.add(path);
      if (workspaceReloadTimerRef.current !== null) {
        window.clearTimeout(workspaceReloadTimerRef.current);
      }
      workspaceReloadTimerRef.current = window.setTimeout(() => {
        workspaceReloadTimerRef.current = null;
        const changedPaths = [...pendingWorkspacePaths];
        pendingWorkspacePaths.clear();
        void refreshWorkspaceChanges(workspacePath, changedPaths);
      }, 280);

      const current = documentStateRef.current;
      if (!current || current.path.startsWith("browser://")) return;

      const currentPath = comparablePath(current.path);
      const writtenUntil = selfWrittenPathsRef.current.get(currentPath);
      const action = resolveExternalChangeAction({
        changedPaths: paths,
        currentPath: current.path,
        modified: current.modified,
        selfWriting: selfWritingPathsRef.current.has(currentPath),
        selfWrittenUntil: writtenUntil,
        now: Date.now(),
      });
      if (action === "ignore") return;
      if (writtenUntil !== undefined) {
        selfWrittenPathsRef.current.delete(currentPath);
      }

      if (action === "notify") {
        setExternalChangePath(current.path);
        setDocumentState((latest) =>
          latest && isSameDocumentPath(latest.path, current.path) ? { ...latest, externallyModified: true } : latest,
        );
      } else {
        void openPath(current.path, true);
      }
    })
      .then((dispose) => {
        if (!active) {
          dispose?.();
        } else {
          unwatch = dispose;
        }
      })
      .catch(() => {
        if (active) setWorkspaceWatchError("文件监听不可用，目录仍可手动刷新。");
      });

    return () => {
      active = false;
      if (workspaceReloadTimerRef.current !== null) {
        window.clearTimeout(workspaceReloadTimerRef.current);
        workspaceReloadTimerRef.current = null;
      }
      pendingWorkspacePaths.clear();
      unwatch?.();
    };
  }, [
    documentCacheRef,
    documentStateRef,
    openPath,
    pendingWorkspacePathsRef,
    refreshWorkspaceChanges,
    selfWritingPathsRef,
    selfWrittenPathsRef,
    setDocumentState,
    setExternalChangePath,
    setWorkspaceWatchError,
    workspacePath,
    workspaceReloadTimerRef,
  ]);

  useEffect(() => {
    const query = workspaceQuery.trim();
    if (!workspacePath || !isTauriRuntime() || query.length < 2) {
      setWorkspaceResults([]);
      setWorkspaceSearchLoading(false);
      return;
    }

    let active = true;
    setWorkspaceSearchLoading(true);
    const timer = window.setTimeout(() => {
      void searchWorkspace(workspacePath, query)
        .then((results) => {
          if (active) setWorkspaceResults(results);
        })
        .catch((cause) => {
          if (active) {
            setWorkspaceResults([]);
            setError(cause instanceof Error ? cause.message : "工作区搜索失败。");
          }
        })
        .finally(() => {
          if (active) setWorkspaceSearchLoading(false);
        });
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [setError, setWorkspaceResults, setWorkspaceSearchLoading, workspacePath, workspaceQuery, workspaceRevision]);
  return {
    openSelectedFile,
    closeGettingStarted,
    openDocumentFromGuide,
    addWorkspaceFromGuide,
    overwriteExternalChange,
    cancelExternalOverwrite,
    confirmExternalOverwrite,
  };
}
