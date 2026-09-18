import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createWorkspaceSessionController,
  type WorkspaceSessionControllerOptions,
  type WorkspaceSessionRuntime,
  type WorkspaceSessionView,
} from "./workspace-session-controller";
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

type ControllerState = {
  workspacePath: string | null;
  files: WorkspaceFile[];
  folders: WorkspaceDirectory[];
  listingStatus: WorkspaceListingStatus;
  index: WorkspaceIndexEntry[];
  workspaceLoading: boolean;
  indexLoading: boolean;
  revision: number;
  watchError: string | null;
  recentWorkspaces: RecentWorkspace[];
  mountedWorkspaces: RecentWorkspace[];
  workspaceQuery: string;
  selectedTag: string | null;
  selectedFileKind: WorkspaceKindFilter;
  openTabs: RecentFile[];
  resultsCleared: number;
  error: string | null;
  savedWorkspacePath: string | null;
  savedSessions: WorkspaceSession[];
  forgottenSessions: string[];
  invalidatedPaths: string[][];
  restorePending: number;
  currentDocument: OpenDocument | null;
};

type Harness = {
  controller: ReturnType<typeof createWorkspaceSessionController>;
  state: ControllerState;
  options: WorkspaceSessionControllerOptions;
  listWorkspaceEntries: ReturnType<typeof vi.fn>;
  indexWorkspace: ReturnType<typeof vi.fn>;
  refreshWorkspace: ReturnType<typeof vi.fn>;
  subscribeToWorkspaceChanges: ReturnType<typeof vi.fn>;
};

const root = "C:\\Notes";

function createFile(path: string, name = path.split(/[\\/]/).pop() ?? "note.md"): WorkspaceFile {
  return {
    path,
    name,
    relativePath: name,
    size: 10,
    modifiedMs: 1,
    kind: "markdown",
  };
}

function createListing(files: WorkspaceFile[] = [createFile(`${root}\\note.md`)]): WorkspaceListing {
  return {
    files,
    folders: [],
    truncated: false,
    scannedTotal: files.length,
  };
}

function createIndex(file: WorkspaceFile): WorkspaceIndexEntry {
  return { file, title: file.name, links: [], tags: [] };
}

function setValue<T>(current: T, next: T | ((value: T) => T)): T {
  return typeof next === "function" ? (next as (value: T) => T)(current) : next;
}

function createHarness(overrides: Partial<WorkspaceSessionControllerOptions> = {}): Harness {
  const state: ControllerState = {
    workspacePath: null,
    files: [],
    folders: [],
    listingStatus: { truncated: false, scannedTotal: 0 },
    index: [],
    workspaceLoading: false,
    indexLoading: false,
    revision: 0,
    watchError: null,
    recentWorkspaces: [],
    mountedWorkspaces: [],
    workspaceQuery: "",
    selectedTag: null,
    selectedFileKind: "all",
    openTabs: [],
    resultsCleared: 0,
    error: null,
    savedWorkspacePath: null,
    savedSessions: [],
    forgottenSessions: [],
    invalidatedPaths: [],
    restorePending: 0,
    currentDocument: null,
  };

  const listWorkspaceEntries = vi.fn().mockResolvedValue(createListing());
  const indexWorkspace = vi.fn().mockResolvedValue([] as WorkspaceIndexEntry[]);
  const refreshWorkspace = vi.fn().mockResolvedValue({
    scopePaths: [],
    folderScopePaths: [],
    folders: [],
    files: [],
    index: [],
    truncated: false,
    scannedTotal: 0,
  } satisfies WorkspaceRefreshResult);
  const subscribeToWorkspaceChanges = vi.fn().mockResolvedValue(vi.fn());

  const view: WorkspaceSessionView = {
    setWorkspaceFiles: (next) => {
      state.files = setValue(state.files, next);
    },
    setWorkspaceFolders: (next) => {
      state.folders = setValue(state.folders, next);
    },
    setWorkspaceListingStatus: (next) => {
      state.listingStatus = setValue(state.listingStatus, next);
    },
    setWorkspaceIndex: (next) => {
      state.index = setValue(state.index, next);
    },
    setWorkspaceLoading: (loading) => {
      state.workspaceLoading = loading;
    },
    setWorkspaceIndexLoading: (loading) => {
      state.indexLoading = loading;
    },
    setWorkspaceRevision: (next) => {
      state.revision = setValue(state.revision, next);
    },
    setWorkspaceWatchError: (message) => {
      state.watchError = message;
    },
    setRecentWorkspaces: (workspaces) => {
      state.recentWorkspaces = workspaces;
    },
    setMountedWorkspaces: (next) => {
      state.mountedWorkspaces = setValue(state.mountedWorkspaces, next);
    },
    setWorkspaceQuery: (query) => {
      state.workspaceQuery = query;
    },
    setSelectedTag: (tag) => {
      state.selectedTag = tag;
    },
    setSelectedFileKind: (kind) => {
      state.selectedFileKind = kind;
    },
    setOpenTabs: (tabs) => {
      state.openTabs = tabs;
    },
    clearWorkspaceResults: () => {
      state.resultsCleared += 1;
    },
    setError: (message) => {
      state.error = message;
    },
  };

  const runtime: WorkspaceSessionRuntime = {
    getWorkspacePath: () => state.workspacePath,
    setWorkspacePath: (path) => {
      state.workspacePath = path;
    },
    getOpenTabs: () => state.openTabs,
    getCurrentDocument: () => state.currentDocument,
    invalidateDocumentCache: (paths) => {
      state.invalidatedPaths.push(paths);
    },
    markWorkspaceRestorePending: () => {
      state.restorePending += 1;
    },
  };

  const options: WorkspaceSessionControllerOptions = {
    isNative: true,
    maxMountedWorkspaces: 5,
    loadMountedWorkspaces: () => state.mountedWorkspaces,
    loadWorkspaceSessions: () => state.savedSessions,
    listWorkspaceEntries,
    indexWorkspace,
    refreshWorkspace,
    subscribeToWorkspaceChanges,
    rememberRecentWorkspace: (workspace) => [
      workspace,
      ...state.recentWorkspaces.filter((item) => item.path !== workspace.path),
    ],
    rememberMountedWorkspace: (workspace) => [
      workspace,
      ...state.mountedWorkspaces.filter((item) => item.path !== workspace.path),
    ],
    saveMountedWorkspaces: (workspaces) => {
      state.mountedWorkspaces = workspaces;
    },
    saveWorkspacePath: (path) => {
      state.savedWorkspacePath = path;
    },
    saveWorkspaceSession: (session) => {
      state.savedSessions = [session, ...state.savedSessions.filter((item) => item.path !== session.path)];
    },
    forgetWorkspaceSession: (path) => {
      state.forgottenSessions.push(path);
    },
    ...overrides,
    view,
    runtime,
  };

  return {
    controller: createWorkspaceSessionController(options),
    state,
    options,
    listWorkspaceEntries,
    indexWorkspace,
    refreshWorkspace,
    subscribeToWorkspaceChanges,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("workspace session controller", () => {
  it("loads a workspace, mounts it, and finishes its background index", async () => {
    const file = createFile(`${root}\\today.md`);
    const index = [createIndex(file)];
    const harness = createHarness({
      listWorkspaceEntries: vi.fn().mockResolvedValue(createListing([file])),
      indexWorkspace: vi.fn().mockResolvedValue(index),
    });

    await expect(harness.controller.loadWorkspace(root)).resolves.toBe(true);
    await vi.waitFor(() => expect(harness.state.index).toEqual(index));

    expect(harness.state.workspacePath).toBe(root);
    expect(harness.state.files).toEqual([file]);
    expect(harness.state.revision).toBe(1);
    expect(harness.state.mountedWorkspaces).toEqual([{ path: root, name: "Notes" }]);
    expect(harness.state.savedWorkspacePath).toBe(root);
    expect(harness.state.workspaceLoading).toBe(false);
    expect(harness.state.indexLoading).toBe(false);
  });

  it("ignores a stale listing when a later workspace switch wins", async () => {
    const firstRoot = "C:\\First";
    const secondRoot = "C:\\Second";
    const firstFile = createFile(`${firstRoot}\\first.md`);
    const secondFile = createFile(`${secondRoot}\\second.md`);
    const resolvers: Array<(listing: WorkspaceListing) => void> = [];
    const listWorkspaceEntries = vi.fn(
      () =>
        new Promise<WorkspaceListing>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const harness = createHarness({ listWorkspaceEntries });

    const firstLoad = harness.controller.loadWorkspace(firstRoot);
    const secondLoad = harness.controller.loadWorkspace(secondRoot);
    resolvers[1](createListing([secondFile]));

    await expect(secondLoad).resolves.toBe(true);
    resolvers[0](createListing([firstFile]));
    await expect(firstLoad).resolves.toBe(false);

    expect(harness.state.workspacePath).toBe(secondRoot);
    expect(harness.state.files).toEqual([secondFile]);
    expect(harness.state.mountedWorkspaces).toEqual([{ path: secondRoot, name: "Second" }]);
  });

  it("applies an external delta through the serialized refresh queue", async () => {
    const oldFile = createFile(`${root}\\old.md`, "old.md");
    const newFile = createFile(`${root}\\new.md`, "new.md");
    const refreshResult: WorkspaceRefreshResult = {
      scopePaths: [oldFile.path],
      folderScopePaths: [],
      folders: [],
      files: [newFile],
      index: [createIndex(newFile)],
      truncated: true,
      scannedTotal: 4,
    };
    const refreshWorkspace = vi.fn().mockResolvedValue(refreshResult);
    const harness = createHarness({
      listWorkspaceEntries: vi.fn().mockResolvedValue(createListing([oldFile])),
      refreshWorkspace,
    });

    await harness.controller.loadWorkspace(root);
    await harness.controller.refreshWorkspaceChanges(root, [oldFile.path]);

    expect(refreshWorkspace).toHaveBeenCalledWith(root, [oldFile.path]);
    expect(harness.state.files).toEqual([newFile]);
    expect(harness.state.index).toEqual([createIndex(newFile)]);
    expect(harness.state.listingStatus).toEqual({ truncated: true, scannedTotal: 4 });
    expect(harness.state.revision).toBe(2);
    expect(harness.state.indexLoading).toBe(false);
  });

  it("coalesces watcher paths, refreshes once, and stops after unsubscribe", async () => {
    vi.useFakeTimers();
    const changedFile = createFile(`${root}\\changed.md`, "changed.md");
    const subscribeToWorkspaceChanges = vi.fn().mockResolvedValue(vi.fn());
    const refreshWorkspace = vi.fn().mockResolvedValue({
      scopePaths: [],
      folderScopePaths: [],
      folders: [],
      files: [],
      index: [],
      truncated: false,
      scannedTotal: 1,
    } satisfies WorkspaceRefreshResult);
    const harness = createHarness({ subscribeToWorkspaceChanges, refreshWorkspace });

    await harness.controller.loadWorkspace(root);
    const onDocumentPathsChanged = vi.fn();
    const stop = harness.controller.watchWorkspace(root, onDocumentPathsChanged);
    const callback = subscribeToWorkspaceChanges.mock.calls[0][1] as (paths: string[]) => void;
    await Promise.resolve();

    callback([changedFile.path]);
    callback([root]);
    expect(onDocumentPathsChanged).toHaveBeenCalledTimes(2);
    expect(harness.state.invalidatedPaths).toEqual([[changedFile.path], [root]]);

    await vi.advanceTimersByTimeAsync(279);
    expect(refreshWorkspace).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(refreshWorkspace).toHaveBeenCalledOnce());
    expect(refreshWorkspace).toHaveBeenCalledWith(root, [changedFile.path, root]);

    stop();
    callback([changedFile.path]);
    await vi.advanceTimersByTimeAsync(280);
    expect(refreshWorkspace).toHaveBeenCalledOnce();
  });

  it("reports watcher subscription failures through workspace state", async () => {
    const subscribeToWorkspaceChanges = vi.fn().mockRejectedValue(new Error("watch unavailable"));
    const harness = createHarness({ subscribeToWorkspaceChanges });

    await harness.controller.loadWorkspace(root);
    harness.controller.watchWorkspace(root, vi.fn());
    await vi.waitFor(() => expect(harness.state.watchError).toBe("文件监听不可用，目录仍可手动刷新。"));
  });
});
