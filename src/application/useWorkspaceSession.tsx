import { useCallback, useRef } from "react";
import { createRefreshQueue } from "../features/workspace/refresh-queue";
import {
  applyWorkspaceFileDelta,
  applyWorkspaceFolderDelta,
  applyWorkspaceIndexDelta,
  isCurrentWorkspaceLoad,
} from "../features/workspace/workspace-refresh";
import {
  authorizeStoredPath,
  chooseWorkspacePath,
  indexWorkspace,
  isTauriRuntime,
  listWorkspaceDirectories,
  listWorkspaceFiles,
  refreshWorkspace,
} from "../platform/bridge";
import {
  forgetWorkspaceSession,
  loadMountedWorkspaces,
  loadWorkspaceSessions,
  MAX_MOUNTED_WORKSPACES,
  rememberMountedWorkspace,
  rememberRecentWorkspace,
  saveMountedWorkspaces,
  saveWorkspacePath,
} from "../platform/storage";
import {
  comparablePath,
  fileNameFromPath,
  pathBelongsToWorkspace,
  persistCachedWorkspaceSession,
  pruneWorkspaceCache,
  updateCachedWorkspace,
} from "./support";
import type { useDocumentTransitions } from "./useDocumentTransitions";
import type { useReaderState } from "./useReaderState";
type Input = Pick<
  ReturnType<typeof useReaderState>,
  | "workspaceRefreshRequestRef"
  | "setWorkspaceIndexLoading"
  | "workspacePathRef"
  | "setWorkspaceFiles"
  | "mountedWorkspaceCacheRef"
  | "setWorkspaceFolders"
  | "setWorkspaceIndex"
  | "setWorkspaceRevision"
  | "setWorkspaceWatchError"
  | "pendingWorkspaceMountsRef"
  | "setError"
  | "workspaceRestorePendingRef"
  | "documentStateRef"
  | "openTabsRef"
  | "workspaceLoadRequestRef"
  | "setWorkspaceLoading"
  | "setWorkspacePath"
  | "setWorkspaceQuery"
  | "setSelectedTag"
  | "setSelectedFileKind"
  | "setWorkspaceResults"
  | "setOpenTabs"
  | "setRecentWorkspaces"
  | "setMountedWorkspaces"
  | "documentCacheRef"
> &
  Pick<ReturnType<typeof useDocumentTransitions>, "confirmWorkspaceSwitch">;
export function useWorkspaceSession({
  workspaceRefreshRequestRef,
  setWorkspaceIndexLoading,
  workspacePathRef,
  setWorkspaceFiles,
  mountedWorkspaceCacheRef,
  setWorkspaceFolders,
  setWorkspaceIndex,
  setWorkspaceRevision,
  setWorkspaceWatchError,
  pendingWorkspaceMountsRef,
  setError,
  workspaceRestorePendingRef,
  documentStateRef,
  openTabsRef,
  workspaceLoadRequestRef,
  setWorkspaceLoading,
  setWorkspacePath,
  setWorkspaceQuery,
  setSelectedTag,
  setSelectedFileKind,
  setWorkspaceResults,
  setOpenTabs,
  setRecentWorkspaces,
  setMountedWorkspaces,
  confirmWorkspaceSwitch,
  documentCacheRef,
}: Input) {
  const refreshQueueRef = useRef<{ root: string; epoch: number; run: ReturnType<typeof createRefreshQueue> } | null>(
    null,
  );
  const applyWorkspaceChanges = useCallback(
    async (root: string, paths: string[]) => {
      if (!isTauriRuntime() || paths.length === 0) return;

      const requestId = ++workspaceRefreshRequestRef.current;
      setWorkspaceIndexLoading(true);
      try {
        const delta = await refreshWorkspace(root, paths);
        if (
          requestId !== workspaceRefreshRequestRef.current ||
          comparablePath(workspacePathRef.current ?? "") !== comparablePath(root)
        ) {
          return;
        }
        setWorkspaceFiles((current) => {
          const next = applyWorkspaceFileDelta(current, delta);
          updateCachedWorkspace(mountedWorkspaceCacheRef.current, root, { files: next });
          return next;
        });
        setWorkspaceFolders((current) => {
          const next = applyWorkspaceFolderDelta(current, delta);
          updateCachedWorkspace(mountedWorkspaceCacheRef.current, root, { folders: next });
          return next;
        });
        setWorkspaceIndex((current) => {
          const next = applyWorkspaceIndexDelta(current, delta);
          updateCachedWorkspace(mountedWorkspaceCacheRef.current, root, { index: next });
          return next;
        });
        setWorkspaceRevision((current) => {
          const next = current + 1;
          updateCachedWorkspace(mountedWorkspaceCacheRef.current, root, { revision: next });
          return next;
        });
      } catch {
        if (requestId === workspaceRefreshRequestRef.current) {
          setWorkspaceWatchError("工作区增量刷新失败，目录仍可手动刷新。");
        }
      } finally {
        if (requestId === workspaceRefreshRequestRef.current) setWorkspaceIndexLoading(false);
      }
    },
    [
      mountedWorkspaceCacheRef,
      setWorkspaceFiles,
      setWorkspaceFolders,
      setWorkspaceIndex,
      setWorkspaceIndexLoading,
      setWorkspaceRevision,
      setWorkspaceWatchError,
      workspacePathRef,
      workspaceRefreshRequestRef,
    ],
  );

  const refreshWorkspaceChanges = useCallback(
    (root: string, paths: string[]) => {
      const epoch = workspaceLoadRequestRef.current;
      if (
        !refreshQueueRef.current ||
        refreshQueueRef.current.root !== root ||
        refreshQueueRef.current.epoch !== epoch
      ) {
        refreshQueueRef.current = {
          root,
          epoch,
          run: createRefreshQueue(async (batch) => {
            if (
              workspaceLoadRequestRef.current !== epoch ||
              comparablePath(workspacePathRef.current ?? "") !== comparablePath(root)
            )
              return;
            await applyWorkspaceChanges(root, batch);
          }),
        };
      }
      return refreshQueueRef.current.run(paths);
    },
    [applyWorkspaceChanges, workspaceLoadRequestRef, workspacePathRef],
  );

  const loadWorkspace = useCallback(
    async (root: string, silent = false) => {
      if (!isTauriRuntime()) return;

      const mounted = loadMountedWorkspaces();
      const rootKey = comparablePath(root);
      const alreadyMounted = mounted.some((workspace) => comparablePath(workspace.path) === rootKey);
      const alreadyPending = pendingWorkspaceMountsRef.current.has(rootKey);
      if (
        !alreadyMounted &&
        !alreadyPending &&
        mounted.length + pendingWorkspaceMountsRef.current.size >= MAX_MOUNTED_WORKSPACES
      ) {
        setError(`最多同时挂载 ${MAX_MOUNTED_WORKSPACES} 个阅读库，请先从切换菜单移除一个。`);
        return;
      }
      const ownsPendingMount = !alreadyMounted && !alreadyPending;
      if (ownsPendingMount) pendingWorkspaceMountsRef.current.add(rootKey);

      const previousWorkspacePath = workspacePathRef.current;
      const storedSession = loadWorkspaceSessions().find(
        (session) => comparablePath(session.path) === comparablePath(root),
      );
      const switchedWorkspace =
        comparablePath(previousWorkspacePath ?? "") !== comparablePath(root) && Boolean(previousWorkspacePath);
      if (switchedWorkspace || (storedSession && !previousWorkspacePath)) {
        workspaceRestorePendingRef.current = true;
      }
      if (switchedWorkspace && previousWorkspacePath) {
        const currentDocument = documentStateRef.current;
        updateCachedWorkspace(mountedWorkspaceCacheRef.current, previousWorkspacePath, {
          tabs: openTabsRef.current.filter(
            (tab) => !tab.path.startsWith("browser://") && pathBelongsToWorkspace(tab.path, previousWorkspacePath),
          ),
          activeDocumentPath:
            currentDocument && pathBelongsToWorkspace(currentDocument.path, previousWorkspacePath)
              ? currentDocument.path
              : null,
        });
        persistCachedWorkspaceSession(mountedWorkspaceCacheRef.current, previousWorkspacePath);
      }

      const requestId = ++workspaceLoadRequestRef.current;
      workspaceRefreshRequestRef.current += 1;
      setWorkspaceLoading(true);
      setWorkspaceIndexLoading(true);
      try {
        const cached = mountedWorkspaceCacheRef.current.get(comparablePath(root));
        if (cached) {
          const switchedWorkspace = comparablePath(workspacePathRef.current ?? "") !== comparablePath(cached.path);
          workspacePathRef.current = cached.path;
          setWorkspacePath(cached.path);
          setWorkspaceFiles(cached.files);
          setWorkspaceFolders(cached.folders);
          setWorkspaceIndex(cached.index);
          setWorkspaceRevision(cached.revision);
          setWorkspaceQuery(cached.searchQuery);
          setSelectedTag(cached.selectedTag);
          setSelectedFileKind(cached.selectedFileKind);
          if (switchedWorkspace) {
            setWorkspaceResults([]);
            setOpenTabs(cached.tabs ?? []);
          }
          saveWorkspacePath(cached.path);
          setRecentWorkspaces(
            rememberRecentWorkspace({
              path: cached.path,
              name: cached.name,
            }),
          );
          const nextMountedWorkspaces = rememberMountedWorkspace({
            path: cached.path,
            name: cached.name,
          });
          pruneWorkspaceCache(mountedWorkspaceCacheRef.current, nextMountedWorkspaces);
          setMountedWorkspaces(nextMountedWorkspaces);
          if (!silent) setError(null);
          setWorkspaceLoading(false);

          void (async () => {
            try {
              const [files, folders] = await Promise.all([
                listWorkspaceFiles(cached.path),
                listWorkspaceDirectories(cached.path),
              ]);
              if (
                !isCurrentWorkspaceLoad(
                  requestId,
                  workspaceLoadRequestRef.current,
                  cached.path,
                  workspacePathRef.current,
                )
              ) {
                return;
              }
              setWorkspaceFiles(files);
              setWorkspaceFolders(folders);
              updateCachedWorkspace(mountedWorkspaceCacheRef.current, cached.path, { files, folders });
              setWorkspaceRevision((current) => {
                const next = current + 1;
                updateCachedWorkspace(mountedWorkspaceCacheRef.current, cached.path, { revision: next });
                return next;
              });
              const index = await indexWorkspace(cached.path);
              if (
                !isCurrentWorkspaceLoad(
                  requestId,
                  workspaceLoadRequestRef.current,
                  cached.path,
                  workspacePathRef.current,
                )
              ) {
                return;
              }
              setWorkspaceIndex(index);
              updateCachedWorkspace(mountedWorkspaceCacheRef.current, cached.path, { index });
            } catch (cause) {
              if (requestId === workspaceLoadRequestRef.current && !silent) {
                setError(cause instanceof Error ? cause.message : "工作区刷新失败。");
              }
            } finally {
              if (requestId === workspaceLoadRequestRef.current) setWorkspaceIndexLoading(false);
            }
          })();
          return;
        }

        const [files, folders] = await Promise.all([listWorkspaceFiles(root), listWorkspaceDirectories(root)]);
        if (requestId !== workspaceLoadRequestRef.current) return;

        const switchedWorkspace = comparablePath(workspacePathRef.current ?? "") !== comparablePath(root);
        const workspaceRecord = {
          path: root,
          name: fileNameFromPath(root.replace(/[\\/]+$/, "")) || root,
        };
        mountedWorkspaceCacheRef.current.set(comparablePath(root), {
          ...workspaceRecord,
          files,
          folders,
          index: [],
          revision: 0,
          selectedTag: null,
          selectedFileKind: "all",
          searchQuery: "",
          tabs: storedSession?.tabs ?? [],
          activeDocumentPath: storedSession?.activeDocumentPath ?? null,
        });
        workspacePathRef.current = root;
        setWorkspacePath(root);
        setWorkspaceFiles(files);
        setWorkspaceFolders(folders);
        if (switchedWorkspace || !previousWorkspacePath) {
          setWorkspaceIndex([]);
          setWorkspaceResults([]);
          setWorkspaceQuery("");
          setSelectedTag(null);
          setSelectedFileKind("all");
          setOpenTabs(storedSession?.tabs ?? []);
        }
        setWorkspaceRevision((current) => {
          const next = current + 1;
          updateCachedWorkspace(mountedWorkspaceCacheRef.current, root, { revision: next });
          return next;
        });
        saveWorkspacePath(root);
        setRecentWorkspaces(rememberRecentWorkspace(workspaceRecord));
        const nextMountedWorkspaces = rememberMountedWorkspace(workspaceRecord);
        pruneWorkspaceCache(mountedWorkspaceCacheRef.current, nextMountedWorkspaces);
        setMountedWorkspaces(nextMountedWorkspaces);
        if (!silent) setError(null);
        setWorkspaceLoading(false);

        void indexWorkspace(root)
          .then((index) => {
            if (!isCurrentWorkspaceLoad(requestId, workspaceLoadRequestRef.current, root, workspacePathRef.current))
              return;
            setWorkspaceIndex(index);
            updateCachedWorkspace(mountedWorkspaceCacheRef.current, root, { index });
          })
          .catch((cause) => {
            if (requestId !== workspaceLoadRequestRef.current) return;
            setWorkspaceIndex([]);
            if (!silent) {
              setError(cause instanceof Error ? cause.message : "工作区索引失败。");
            }
          })
          .finally(() => {
            if (requestId === workspaceLoadRequestRef.current) setWorkspaceIndexLoading(false);
          });
      } catch (cause) {
        if (requestId !== workspaceLoadRequestRef.current) return;
        setWorkspaceLoading(false);
        setWorkspaceIndexLoading(false);
        if (silent) {
          setWorkspacePath(null);
          workspacePathRef.current = null;
          setWorkspaceFiles([]);
          setWorkspaceFolders([]);
          setWorkspaceIndex([]);
          saveWorkspacePath(null);
          mountedWorkspaceCacheRef.current.delete(comparablePath(root));
          forgetWorkspaceSession(root);
          setMountedWorkspaces((current) => {
            const next = current.filter((workspace) => comparablePath(workspace.path) !== comparablePath(root));
            saveMountedWorkspaces(next);
            return next;
          });
        } else {
          setError(cause instanceof Error ? cause.message : "工作区读取失败。");
        }
      } finally {
        if (ownsPendingMount) pendingWorkspaceMountsRef.current.delete(rootKey);
      }
    },
    [
      documentStateRef,
      mountedWorkspaceCacheRef,
      openTabsRef,
      pendingWorkspaceMountsRef,
      setError,
      setMountedWorkspaces,
      setOpenTabs,
      setRecentWorkspaces,
      setSelectedFileKind,
      setSelectedTag,
      setWorkspaceFiles,
      setWorkspaceFolders,
      setWorkspaceIndex,
      setWorkspaceIndexLoading,
      setWorkspaceLoading,
      setWorkspacePath,
      setWorkspaceQuery,
      setWorkspaceResults,
      setWorkspaceRevision,
      workspaceLoadRequestRef,
      workspacePathRef,
      workspaceRefreshRequestRef,
      workspaceRestorePendingRef,
    ],
  );

  const handleChooseWorkspace = useCallback(async () => {
    if (loadMountedWorkspaces().length + pendingWorkspaceMountsRef.current.size >= MAX_MOUNTED_WORKSPACES) {
      setError(`最多同时挂载 ${MAX_MOUNTED_WORKSPACES} 个阅读库，请先从切换菜单移除一个。`);
      return;
    }
    const selected = await chooseWorkspacePath();
    if (selected && confirmWorkspaceSwitch(selected, "切换阅读库")) {
      await loadWorkspace(selected);
    }
  }, [confirmWorkspaceSwitch, loadWorkspace, pendingWorkspaceMountsRef, setError]);

  const handleOpenRecentWorkspace = useCallback(
    async (path: string) => {
      try {
        const authorizedPath = await authorizeStoredPath(path, true);
        if (!confirmWorkspaceSwitch(authorizedPath, "切换阅读库")) {
          return;
        }
        await loadWorkspace(authorizedPath);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "最近阅读库无法打开，请重新选择文件夹。");
      }
    },
    [confirmWorkspaceSwitch, loadWorkspace, setError],
  );

  const handleRemoveMountedWorkspace = useCallback(
    (path: string) => {
      if (comparablePath(path) === comparablePath(workspacePathRef.current ?? "")) return;
      mountedWorkspaceCacheRef.current.delete(comparablePath(path));
      documentCacheRef.current.invalidate([path]);
      forgetWorkspaceSession(path);
      setMountedWorkspaces((current) => {
        const next = current.filter((workspace) => comparablePath(workspace.path) !== comparablePath(path));
        saveMountedWorkspaces(next);
        return next;
      });
    },
    [documentCacheRef, mountedWorkspaceCacheRef, setMountedWorkspaces, workspacePathRef],
  );
  return {
    refreshWorkspaceChanges,
    loadWorkspace,
    handleChooseWorkspace,
    handleOpenRecentWorkspace,
    handleRemoveMountedWorkspace,
  };
}
