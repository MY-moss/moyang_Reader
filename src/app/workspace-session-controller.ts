import type {
  OpenDocument,
  RecentFile,
  RecentWorkspace,
  WorkspaceDirectory,
  WorkspaceFile,
  WorkspaceIndexEntry,
  WorkspaceListing,
  WorkspaceListingStatus,
  WorkspaceRefreshResult,
} from "./types";
import type { WorkspaceKindFilter } from "./workspace-filter";
import type { WorkspaceSession } from "./storage";
import { isPathWithin, normalizePathKey } from "./path-key";
import {
  applyWorkspaceFileDelta,
  applyWorkspaceFolderDelta,
  applyWorkspaceIndexDelta,
  isCurrentWorkspaceLoad,
  workspaceFilesMatch,
  workspaceFoldersMatch,
} from "./workspace-refresh";

export type CachedWorkspace = {
  path: string;
  name: string;
  files: WorkspaceFile[];
  folders: WorkspaceDirectory[];
  index: WorkspaceIndexEntry[];
  listingStatus: WorkspaceListingStatus;
  indexReady: boolean;
  revision: number;
  selectedTag: string | null;
  selectedFileKind: WorkspaceKindFilter;
  searchQuery: string;
  tabs: RecentFile[];
  activeDocumentPath: string | null;
};

type StateSetter<T> = (next: T | ((current: T) => T)) => void;

export type WorkspaceSessionRuntime = {
  getWorkspacePath: () => string | null;
  setWorkspacePath: (path: string | null) => void;
  getOpenTabs: () => RecentFile[];
  getCurrentDocument: () => OpenDocument | null;
  invalidateDocumentCache: (paths: string[]) => void;
  markWorkspaceRestorePending: () => void;
};

export type WorkspaceSessionView = {
  setWorkspaceFiles: StateSetter<WorkspaceFile[]>;
  setWorkspaceFolders: StateSetter<WorkspaceDirectory[]>;
  setWorkspaceListingStatus: StateSetter<WorkspaceListingStatus>;
  setWorkspaceIndex: StateSetter<WorkspaceIndexEntry[]>;
  setWorkspaceLoading: (loading: boolean) => void;
  setWorkspaceIndexLoading: (loading: boolean) => void;
  setWorkspaceRevision: StateSetter<number>;
  setWorkspaceWatchError: (message: string | null) => void;
  setRecentWorkspaces: (workspaces: RecentWorkspace[]) => void;
  setMountedWorkspaces: StateSetter<RecentWorkspace[]>;
  setWorkspaceQuery: (query: string) => void;
  setSelectedTag: (tag: string | null) => void;
  setSelectedFileKind: (kind: WorkspaceKindFilter) => void;
  setOpenTabs: (tabs: RecentFile[]) => void;
  clearWorkspaceResults: () => void;
  setError: (message: string | null) => void;
};

export type WorkspaceSessionControllerOptions = {
  isNative: boolean;
  maxMountedWorkspaces: number;
  view: WorkspaceSessionView;
  runtime: WorkspaceSessionRuntime;
  loadMountedWorkspaces: () => RecentWorkspace[];
  loadWorkspaceSessions: () => WorkspaceSession[];
  listWorkspaceEntries: (root: string) => Promise<WorkspaceListing>;
  indexWorkspace: (root: string) => Promise<WorkspaceIndexEntry[]>;
  refreshWorkspace: (root: string, paths: string[]) => Promise<WorkspaceRefreshResult>;
  subscribeToWorkspaceChanges: (
    root: string,
    onChange: (paths: string[]) => void,
  ) => Promise<(() => void) | null | undefined>;
  rememberRecentWorkspace: (workspace: RecentWorkspace) => RecentWorkspace[];
  rememberMountedWorkspace: (workspace: RecentWorkspace) => RecentWorkspace[];
  saveMountedWorkspaces: (workspaces: RecentWorkspace[]) => void;
  saveWorkspacePath: (path: string | null) => void;
  saveWorkspaceSession: (session: WorkspaceSession) => void;
  forgetWorkspaceSession: (path: string) => void;
};

export type WorkspaceSessionController = {
  loadWorkspace: (root: string, silent?: boolean) => Promise<boolean>;
  refreshWorkspaceChanges: (root: string, paths: string[]) => Promise<void>;
  watchWorkspace: (root: string, onDocumentPathsChanged: (paths: string[]) => void) => () => void;
  removeMountedWorkspace: (path: string) => boolean;
  clearActiveWorkspace: () => void;
  getCachedWorkspace: (root: string) => CachedWorkspace | null;
  getActiveDocumentPath: (root: string) => string | null;
  updateCachedWorkspace: (root: string, changes: Partial<Omit<CachedWorkspace, "path">>) => void;
  persistWorkspaceSession: (root: string) => void;
  syncSelection: (
    root: string,
    selection: Pick<CachedWorkspace, "selectedTag" | "selectedFileKind" | "searchQuery">,
  ) => void;
  syncOpenTabs: (root: string, tabs: RecentFile[]) => void;
  syncActiveDocument: (root: string, path: string | null) => void;
  clearActiveDocumentPath: (root: string) => void;
  setRuntime: (runtime: WorkspaceSessionRuntime) => void;
  dispose: () => void;
};

function comparablePath(path: string): string {
  return normalizePathKey(path);
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function updateCachedWorkspace(
  cache: Map<string, CachedWorkspace>,
  root: string,
  changes: Partial<Omit<CachedWorkspace, "path">>,
): void {
  const key = comparablePath(root);
  const current = cache.get(key);
  if (!current) return;
  cache.set(key, { ...current, ...changes });
}

function persistCachedWorkspaceSession(
  cache: Map<string, CachedWorkspace>,
  saveWorkspaceSession: (session: WorkspaceSession) => void,
  root: string,
): void {
  const cached = cache.get(comparablePath(root));
  if (!cached) return;
  saveWorkspaceSession({
    path: cached.path,
    tabs: cached.tabs,
    activeDocumentPath: cached.activeDocumentPath,
  });
}

function pruneWorkspaceCache(cache: Map<string, CachedWorkspace>, mounted: RecentWorkspace[]): void {
  const mountedKeys = new Set(mounted.map((workspace) => comparablePath(workspace.path)));
  for (const key of cache.keys()) {
    if (!mountedKeys.has(key)) cache.delete(key);
  }
}

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

export function createWorkspaceSessionController(
  options: WorkspaceSessionControllerOptions,
): WorkspaceSessionController {
  const cache = new Map<string, CachedWorkspace>();
  const pendingMounts = new Set<string>();
  const pendingWorkspacePaths = new Set<string>();
  let runtime = options.runtime;
  let activePath = runtime.getWorkspacePath();
  let loadRequestId = 0;
  let refreshQueue = Promise.resolve();
  let watcherDispose: (() => void) | null = null;
  let watcherTimer: ReturnType<typeof setTimeout> | null = null;
  let watcherRoot: string | null = null;
  let disposed = false;

  const setActivePath = (path: string | null): void => {
    activePath = path;
    runtime.setWorkspacePath(path);
  };

  const isActiveWorkspace = (requestId: number, root: string): boolean =>
    !disposed && isCurrentWorkspaceLoad(requestId, loadRequestId, root, activePath);

  const isCurrentRequest = (requestId: number): boolean => !disposed && requestId === loadRequestId;

  const commitWorkspaceLists = (workspace: RecentWorkspace, silent: boolean): void => {
    options.saveWorkspacePath(workspace.path);
    options.view.setRecentWorkspaces(options.rememberRecentWorkspace(workspace));
    const nextMountedWorkspaces = options.rememberMountedWorkspace(workspace);
    pruneWorkspaceCache(cache, nextMountedWorkspaces);
    options.view.setMountedWorkspaces(nextMountedWorkspaces);
    if (!silent) options.view.setError(null);
  };

  const setListingState = (listing: WorkspaceListing): void => {
    options.view.setWorkspaceFiles(listing.files);
    options.view.setWorkspaceFolders(listing.folders);
    options.view.setWorkspaceListingStatus({
      truncated: listing.truncated,
      scannedTotal: listing.scannedTotal,
    });
  };

  const activateCachedWorkspace = (cached: CachedWorkspace, switchedWorkspace: boolean, silent: boolean): void => {
    setActivePath(cached.path);
    options.view.setWorkspaceFiles(cached.files);
    options.view.setWorkspaceFolders(cached.folders);
    options.view.setWorkspaceListingStatus(cached.listingStatus);
    options.view.setWorkspaceIndex(cached.index);
    options.view.setWorkspaceRevision(cached.revision);
    options.view.setWorkspaceQuery(cached.searchQuery);
    options.view.setSelectedTag(cached.selectedTag);
    options.view.setSelectedFileKind(cached.selectedFileKind);
    if (switchedWorkspace) {
      options.view.clearWorkspaceResults();
      options.view.setOpenTabs(cached.tabs ?? []);
    }
    commitWorkspaceLists({ path: cached.path, name: cached.name }, silent);
  };

  const clearActiveWorkspace = (): void => {
    loadRequestId += 1;
    setActivePath(null);
    options.view.setWorkspaceFiles([]);
    options.view.setWorkspaceFolders([]);
    options.view.setWorkspaceListingStatus({ truncated: false, scannedTotal: 0 });
    options.view.setWorkspaceIndex([]);
    options.view.setWorkspaceLoading(false);
    options.view.setWorkspaceIndexLoading(false);
    options.view.setWorkspaceWatchError(null);
    options.view.clearWorkspaceResults();
    options.saveWorkspacePath(null);
  };

  const refreshWorkspaceChanges = (root: string, paths: string[]): Promise<void> => {
    if (disposed || !options.isNative || paths.length === 0) return Promise.resolve();

    const requestId = loadRequestId;
    const refresh = refreshQueue.then(async () => {
      if (!isActiveWorkspace(requestId, root)) return;

      options.view.setWorkspaceIndexLoading(true);
      try {
        const delta = await options.refreshWorkspace(root, paths);
        if (!isActiveWorkspace(requestId, root)) return;

        if (delta.truncated) {
          options.view.setWorkspaceListingStatus((current) => {
            const next = {
              truncated: true,
              scannedTotal: Math.max(current.scannedTotal, delta.scannedTotal),
            };
            updateCachedWorkspace(cache, root, { listingStatus: next });
            return next;
          });
        }

        options.view.setWorkspaceFiles((current) => {
          const next = applyWorkspaceFileDelta(current, delta);
          updateCachedWorkspace(cache, root, { files: next });
          return next;
        });
        options.view.setWorkspaceFolders((current) => {
          const next = applyWorkspaceFolderDelta(current, delta);
          updateCachedWorkspace(cache, root, { folders: next });
          return next;
        });
        options.view.setWorkspaceIndex((current) => {
          const next = applyWorkspaceIndexDelta(current, delta);
          updateCachedWorkspace(cache, root, { index: next });
          return next;
        });
        options.view.setWorkspaceRevision((current) => {
          const next = current + 1;
          updateCachedWorkspace(cache, root, { revision: next });
          return next;
        });
      } catch {
        if (isActiveWorkspace(requestId, root)) {
          options.view.setWorkspaceWatchError("工作区增量刷新失败，目录仍可手动刷新。");
        }
      } finally {
        if (isActiveWorkspace(requestId, root)) options.view.setWorkspaceIndexLoading(false);
      }
    });
    refreshQueue = refresh.catch(() => undefined);
    return refresh;
  };

  const refreshCachedWorkspace = async (cached: CachedWorkspace, requestId: number, silent: boolean): Promise<void> => {
    try {
      const listing = await options.listWorkspaceEntries(cached.path);
      if (!isActiveWorkspace(requestId, cached.path)) return;

      const filesChanged = !workspaceFilesMatch(cached.files, listing.files);
      const foldersChanged = !workspaceFoldersMatch(cached.folders, listing.folders);
      const listingStatusChanged =
        cached.listingStatus.truncated !== listing.truncated ||
        cached.listingStatus.scannedTotal !== listing.scannedTotal;
      if (filesChanged) {
        options.view.setWorkspaceFiles(listing.files);
        updateCachedWorkspace(cache, cached.path, { files: listing.files });
      }
      if (foldersChanged) {
        options.view.setWorkspaceFolders(listing.folders);
        updateCachedWorkspace(cache, cached.path, { folders: listing.folders });
      }
      if (listingStatusChanged) {
        const listingStatus = { truncated: listing.truncated, scannedTotal: listing.scannedTotal };
        options.view.setWorkspaceListingStatus(listingStatus);
        updateCachedWorkspace(cache, cached.path, { listingStatus });
      }
      if (filesChanged || foldersChanged) {
        options.view.setWorkspaceRevision((current) => {
          const next = current + 1;
          updateCachedWorkspace(cache, cached.path, { revision: next });
          return next;
        });
      }
      if (!cached.indexReady || filesChanged) {
        const index = await options.indexWorkspace(cached.path);
        if (!isActiveWorkspace(requestId, cached.path)) return;
        options.view.setWorkspaceIndex(index);
        updateCachedWorkspace(cache, cached.path, { index, indexReady: true });
      }
    } catch (cause) {
      if (requestId === loadRequestId && !silent) {
        options.view.setError(errorMessage(cause, "工作区刷新失败。"));
      }
    } finally {
      if (requestId === loadRequestId) options.view.setWorkspaceIndexLoading(false);
    }
  };

  const loadWorkspace = async (root: string, silent = false): Promise<boolean> => {
    if (disposed || !options.isNative) return false;

    const mounted = options.loadMountedWorkspaces();
    const rootKey = comparablePath(root);
    const alreadyMounted = mounted.some((workspace) => comparablePath(workspace.path) === rootKey);
    const alreadyPending = pendingMounts.has(rootKey);
    if (!alreadyMounted && !alreadyPending && mounted.length + pendingMounts.size >= options.maxMountedWorkspaces) {
      options.view.setError(`最多同时挂载 ${options.maxMountedWorkspaces} 个阅读库，请先从切换菜单移除一个。`);
      return false;
    }

    const ownsPendingMount = !alreadyMounted && !alreadyPending;
    if (ownsPendingMount) pendingMounts.add(rootKey);

    const previousWorkspacePath = activePath;
    const storedSession = options
      .loadWorkspaceSessions()
      .find((session) => comparablePath(session.path) === comparablePath(root));
    const switchedWorkspace =
      comparablePath(previousWorkspacePath ?? "") !== comparablePath(root) && Boolean(previousWorkspacePath);
    if (switchedWorkspace || (storedSession && !previousWorkspacePath)) runtime.markWorkspaceRestorePending();

    if (switchedWorkspace && previousWorkspacePath) {
      const currentDocument = runtime.getCurrentDocument();
      updateCachedWorkspace(cache, previousWorkspacePath, {
        tabs: runtime
          .getOpenTabs()
          .filter((tab) => !tab.path.startsWith("browser://") && isPathWithin(tab.path, previousWorkspacePath)),
        activeDocumentPath:
          currentDocument && isPathWithin(currentDocument.path, previousWorkspacePath) ? currentDocument.path : null,
      });
      persistCachedWorkspaceSession(cache, options.saveWorkspaceSession, previousWorkspacePath);
    }

    const requestId = ++loadRequestId;
    options.view.setWorkspaceLoading(true);
    options.view.setWorkspaceIndexLoading(true);

    try {
      const cached = cache.get(rootKey);
      if (cached) {
        const switched = comparablePath(activePath ?? "") !== comparablePath(cached.path);
        activateCachedWorkspace(cached, switched, silent);
        options.view.setWorkspaceLoading(false);
        void refreshCachedWorkspace(cached, requestId, silent);
        return true;
      }

      const listing = await options.listWorkspaceEntries(root);
      if (!isCurrentRequest(requestId)) return false;

      const switched = comparablePath(activePath ?? "") !== comparablePath(root);
      const workspaceRecord = {
        path: root,
        name: fileNameFromPath(root.replace(/[\\/]+$/, "")) || root,
      };
      cache.set(rootKey, {
        ...workspaceRecord,
        files: listing.files,
        folders: listing.folders,
        listingStatus: { truncated: listing.truncated, scannedTotal: listing.scannedTotal },
        index: [],
        indexReady: false,
        revision: 0,
        selectedTag: null,
        selectedFileKind: "all",
        searchQuery: "",
        tabs: storedSession?.tabs ?? [],
        activeDocumentPath: storedSession?.activeDocumentPath ?? null,
      });
      setActivePath(root);
      setListingState(listing);
      if (switched || !previousWorkspacePath) {
        options.view.setWorkspaceIndex([]);
        options.view.clearWorkspaceResults();
        options.view.setWorkspaceQuery("");
        options.view.setSelectedTag(null);
        options.view.setSelectedFileKind("all");
        options.view.setOpenTabs(storedSession?.tabs ?? []);
      }
      options.view.setWorkspaceRevision((current) => {
        const next = current + 1;
        updateCachedWorkspace(cache, root, { revision: next });
        return next;
      });
      commitWorkspaceLists(workspaceRecord, silent);
      options.view.setWorkspaceLoading(false);

      void options
        .indexWorkspace(root)
        .then((index) => {
          if (!isActiveWorkspace(requestId, root)) return;
          options.view.setWorkspaceIndex(index);
          updateCachedWorkspace(cache, root, { index, indexReady: true });
        })
        .catch((cause) => {
          if (requestId !== loadRequestId) return;
          options.view.setWorkspaceIndex([]);
          if (!silent) options.view.setError(errorMessage(cause, "工作区索引失败。"));
        })
        .finally(() => {
          if (requestId === loadRequestId) options.view.setWorkspaceIndexLoading(false);
        });
      return true;
    } catch (cause) {
      if (!isCurrentRequest(requestId)) return false;
      options.view.setWorkspaceLoading(false);
      options.view.setWorkspaceIndexLoading(false);
      if (silent) {
        cache.delete(rootKey);
        options.forgetWorkspaceSession(root);
        setActivePath(null);
        options.view.setWorkspaceFiles([]);
        options.view.setWorkspaceFolders([]);
        options.view.setWorkspaceListingStatus({ truncated: false, scannedTotal: 0 });
        options.view.setWorkspaceIndex([]);
        options.saveWorkspacePath(null);
        options.view.setMountedWorkspaces((current) => {
          const next = current.filter((workspace) => comparablePath(workspace.path) !== rootKey);
          options.saveMountedWorkspaces(next);
          return next;
        });
      } else {
        options.view.setError(errorMessage(cause, "工作区读取失败。"));
      }
      return false;
    } finally {
      if (ownsPendingMount) pendingMounts.delete(rootKey);
    }
  };

  const watchWorkspace = (root: string, onDocumentPathsChanged: (paths: string[]) => void): (() => void) => {
    watcherDispose?.();
    watcherRoot = root;
    pendingWorkspacePaths.clear();
    if (watcherTimer !== null) {
      clearTimeout(watcherTimer);
      watcherTimer = null;
    }
    options.view.setWorkspaceWatchError(null);

    let active = true;
    let unlisten: (() => void) | undefined;
    const stop = (): void => {
      if (!active) return;
      active = false;
      if (watcherTimer !== null) {
        clearTimeout(watcherTimer);
        watcherTimer = null;
      }
      pendingWorkspacePaths.clear();
      unlisten?.();
      unlisten = undefined;
      if (watcherRoot === root) watcherRoot = null;
      if (watcherDispose === stop) watcherDispose = null;
    };
    watcherDispose = stop;

    void options
      .subscribeToWorkspaceChanges(root, (paths) => {
        if (!active || disposed || comparablePath(watcherRoot ?? "") !== comparablePath(root)) return;
        runtime.invalidateDocumentCache(paths);
        for (const path of paths) pendingWorkspacePaths.add(path);
        if (watcherTimer !== null) clearTimeout(watcherTimer);
        watcherTimer = setTimeout(() => {
          watcherTimer = null;
          const changedPaths = [...pendingWorkspacePaths];
          pendingWorkspacePaths.clear();
          void refreshWorkspaceChanges(root, changedPaths);
        }, 280);
        onDocumentPathsChanged(paths);
      })
      .then((dispose) => {
        if (!active) {
          dispose?.();
        } else {
          unlisten = dispose ?? undefined;
        }
      })
      .catch(() => {
        if (active) options.view.setWorkspaceWatchError("文件监听不可用，目录仍可手动刷新。");
      });

    return stop;
  };

  const removeMountedWorkspace = (path: string): boolean => {
    if (comparablePath(path) === comparablePath(activePath ?? "")) return false;
    cache.delete(comparablePath(path));
    runtime.invalidateDocumentCache([path]);
    options.forgetWorkspaceSession(path);
    options.view.setMountedWorkspaces((current) => {
      const next = current.filter((workspace) => comparablePath(workspace.path) !== comparablePath(path));
      options.saveMountedWorkspaces(next);
      return next;
    });
    return true;
  };

  const getCachedWorkspace = (root: string): CachedWorkspace | null => cache.get(comparablePath(root)) ?? null;

  const getActiveDocumentPath = (root: string): string | null =>
    cache.get(comparablePath(root))?.activeDocumentPath ?? null;

  const updateCachedWorkspacePublic = (root: string, changes: Partial<Omit<CachedWorkspace, "path">>): void =>
    updateCachedWorkspace(cache, root, changes);

  const persistWorkspaceSession = (root: string): void =>
    persistCachedWorkspaceSession(cache, options.saveWorkspaceSession, root);

  const syncSelection = (
    root: string,
    selection: Pick<CachedWorkspace, "selectedTag" | "selectedFileKind" | "searchQuery">,
  ): void => updateCachedWorkspace(cache, root, selection);

  const syncOpenTabs = (root: string, tabs: RecentFile[]): void => {
    updateCachedWorkspace(cache, root, {
      tabs: tabs.filter((tab) => !tab.path.startsWith("browser://") && isPathWithin(tab.path, root)),
    });
  };

  const syncActiveDocument = (root: string, path: string | null): void => {
    if (!path || !isPathWithin(path, root)) return;
    updateCachedWorkspace(cache, root, { activeDocumentPath: path });
  };

  const clearActiveDocumentPath = (root: string): void => {
    updateCachedWorkspace(cache, root, { activeDocumentPath: null });
  };

  const setRuntime = (nextRuntime: WorkspaceSessionRuntime): void => {
    // React StrictMode replays effect setup/cleanup on the same controller instance.
    // The next runtime binding marks that replayed instance live again.
    disposed = false;
    runtime = nextRuntime;
    if (activePath === null) activePath = runtime.getWorkspacePath();
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    watcherDispose?.();
    watcherDispose = null;
    pendingMounts.clear();
    pendingWorkspacePaths.clear();
    refreshQueue = Promise.resolve();
  };

  return {
    loadWorkspace,
    refreshWorkspaceChanges,
    watchWorkspace,
    removeMountedWorkspace,
    clearActiveWorkspace,
    getCachedWorkspace,
    getActiveDocumentPath,
    updateCachedWorkspace: updateCachedWorkspacePublic,
    persistWorkspaceSession,
    syncSelection,
    syncOpenTabs,
    syncActiveDocument,
    clearActiveDocumentPath,
    setRuntime,
    dispose,
  };
}
