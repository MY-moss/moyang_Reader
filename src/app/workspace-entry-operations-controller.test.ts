import { describe, expect, it, vi } from "vitest";
import type { OpenDocument, RecentFile } from "./types";
import type { CachedWorkspace } from "./workspace-session-controller";
import {
  createWorkspaceEntryOperationsController,
  type WorkspaceEntryOperationsOptions,
} from "./workspace-entry-operations-controller";

type CurrentDocument = Pick<OpenDocument, "path" | "modified">;

function setup() {
  const state: {
    root: string;
    current: CurrentDocument | null;
    tabs: RecentFile[];
    recent: RecentFile[];
    cached: CachedWorkspace;
    error: string | null;
  } = {
    root: "C:\\Notes",
    current: { path: "C:\\Notes\\Projects\\one.md", modified: false },
    tabs: [
      { path: "C:\\Notes\\Projects\\one.md", name: "one.md" },
      { path: "C:\\Notes\\other.md", name: "other.md" },
    ],
    recent: [{ path: "C:\\Notes\\Projects\\one.md", name: "one.md" }],
    cached: {
      path: "C:\\Notes",
      name: "Notes",
      files: [],
      folders: [],
      index: [],
      listingStatus: { truncated: false, scannedTotal: 0 },
      indexReady: true,
      revision: 1,
      selectedTag: null,
      selectedFileKind: "all",
      searchQuery: "",
      tabs: [],
      activeDocumentPath: "C:\\Notes\\Projects\\one.md",
    },
    error: null,
  };
  state.cached.tabs = [...state.tabs];

  const replaceOpenTabs = vi.fn((tabs: RecentFile[]) => {
    state.tabs = tabs;
  });
  const releaseDocumentResources = vi.fn();
  const invalidateDocumentCache = vi.fn();
  const clearCurrentDocument = vi.fn(() => {
    state.current = null;
  });
  const setError = vi.fn((message: string | null) => {
    state.error = message;
  });
  const session = {
    getCachedWorkspace: vi.fn(() => state.cached),
    updateCachedWorkspace: vi.fn((_root: string, changes: Partial<CachedWorkspace>) => {
      state.cached = { ...state.cached, ...changes };
    }),
    persistWorkspaceSession: vi.fn(),
  };
  const options: WorkspaceEntryOperationsOptions = {
    isNative: () => true,
    getLocale: () => "zh-CN",
    getWorkspacePath: () => state.root,
    getCurrentDocument: () => state.current,
    getOpenTabs: () => state.tabs,
    prompt: vi.fn((_message, value) => value),
    confirm: vi.fn(() => true),
    saveDocument: vi.fn(async () => true),
    openPath: vi.fn(async () => true),
    renameEntry: vi.fn(async () => "C:\\Notes\\Archive"),
    deleteEntry: vi.fn(async () => undefined),
    moveEntry: vi.fn(async () => "C:\\Notes\\Archive\\Projects"),
    copyEntry: vi.fn(async () => "C:\\Notes\\Archive\\Projects"),
    replaceOpenTabs,
    updateRecentFiles: vi.fn((update) => {
      state.recent = update(state.recent);
    }),
    invalidateDocumentCache,
    releaseDocumentResources,
    clearCurrentDocument,
    refreshWorkspaceChanges: vi.fn(async () => undefined),
    session,
    setError,
    notify: vi.fn(),
  };
  return {
    state,
    options,
    replaceOpenTabs,
    releaseDocumentResources,
    invalidateDocumentCache,
    clearCurrentDocument,
    session,
  };
}

describe("workspace entry operations", () => {
  it("rebases affected tabs, recent files, the cached session and current document after a folder rename", async () => {
    const { state, options, session, replaceOpenTabs } = setup();
    options.prompt = vi.fn(() => "Archive");

    const controller = createWorkspaceEntryOperationsController(options);
    expect(await controller.rename("Projects", "folder")).toBe(true);

    expect(state.tabs.map((tab) => tab.path)).toEqual(["C:\\Notes\\Archive\\one.md", "C:\\Notes\\other.md"]);
    expect(state.recent[0]).toMatchObject({ path: "C:\\Notes\\Archive\\one.md", name: "one.md" });
    expect(state.cached.activeDocumentPath).toBe("C:\\Notes\\Archive\\one.md");
    expect(options.openPath).toHaveBeenCalledWith("C:\\Notes\\Archive\\one.md", true);
    expect(session.persistWorkspaceSession).toHaveBeenCalledWith("C:\\Notes");
    expect(replaceOpenTabs).toHaveBeenCalledTimes(1);
    expect(state.error).toBeNull();
  });

  it("leaves every view and cache untouched when deleting the user file fails", async () => {
    const { state, options, replaceOpenTabs, releaseDocumentResources, invalidateDocumentCache, session } = setup();
    options.deleteEntry = vi.fn(async () => {
      throw new Error("Access denied");
    });

    expect(await createWorkspaceEntryOperationsController(options).remove("Projects", "folder")).toBe(false);

    expect(state.tabs[0].path).toBe("C:\\Notes\\Projects\\one.md");
    expect(state.recent[0].path).toBe("C:\\Notes\\Projects\\one.md");
    expect(state.cached.activeDocumentPath).toBe("C:\\Notes\\Projects\\one.md");
    expect(replaceOpenTabs).not.toHaveBeenCalled();
    expect(releaseDocumentResources).not.toHaveBeenCalled();
    expect(invalidateDocumentCache).not.toHaveBeenCalled();
    expect(session.persistWorkspaceSession).not.toHaveBeenCalled();
    expect(state.error).toBe("Access denied");
  });

  it("removes a deleted folder from tabs, recent files and the cached active path only after success", async () => {
    const { state, options, releaseDocumentResources, clearCurrentDocument } = setup();

    expect(await createWorkspaceEntryOperationsController(options).remove("Projects", "folder")).toBe(true);

    expect(state.tabs).toEqual([{ path: "C:\\Notes\\other.md", name: "other.md" }]);
    expect(state.recent).toEqual([]);
    expect(state.cached.activeDocumentPath).toBeNull();
    expect(clearCurrentDocument).toHaveBeenCalledOnce();
    expect(releaseDocumentResources).toHaveBeenCalledWith("C:\\Notes\\Projects\\one.md");
    expect(options.openPath).toHaveBeenCalledWith("C:\\Notes\\other.md", true);
  });

  it("does not touch disk or metadata when saving a dirty document is cancelled", async () => {
    const { state, options, replaceOpenTabs } = setup();
    state.current = { path: state.current!.path, modified: true };
    options.confirm = vi.fn(() => false);

    expect(
      await createWorkspaceEntryOperationsController(options).transfer("Projects", "Archive", "move", "folder"),
    ).toBe(false);
    expect(options.saveDocument).not.toHaveBeenCalled();
    expect(options.moveEntry).not.toHaveBeenCalled();
    expect(replaceOpenTabs).not.toHaveBeenCalled();
  });

  it("uses English confirmations when the interface locale is English", async () => {
    const { state, options } = setup();
    state.current = { path: state.current!.path, modified: true };
    options.getLocale = () => "en-US";
    options.confirm = vi.fn(() => false);

    expect(await createWorkspaceEntryOperationsController(options).remove("Projects", "folder")).toBe(false);
    expect(options.confirm).toHaveBeenCalledWith(
      "Move “Projects” and everything inside it to the Windows Recycle Bin?",
    );
  });

  it("does not start a native mutation when saving a dirty document fails", async () => {
    const { state, options, replaceOpenTabs } = setup();
    state.current = { path: state.current!.path, modified: true };
    options.saveDocument = vi.fn(async () => false);

    expect(await createWorkspaceEntryOperationsController(options).remove("Projects", "folder")).toBe(false);
    expect(options.deleteEntry).not.toHaveBeenCalled();
    expect(replaceOpenTabs).not.toHaveBeenCalled();
  });

  it("cancels before touching disk if the workspace changes during the save", async () => {
    const { state, options } = setup();
    state.current = { path: state.current!.path, modified: true };
    options.saveDocument = vi.fn(async () => {
      state.root = "D:\\Books";
      return true;
    });

    expect(await createWorkspaceEntryOperationsController(options).remove("Projects", "folder")).toBe(false);
    expect(options.deleteEntry).not.toHaveBeenCalled();
  });

  it("copies without rebasing open paths or changing the current document", async () => {
    const { state, options, replaceOpenTabs, clearCurrentDocument, invalidateDocumentCache } = setup();

    expect(
      await createWorkspaceEntryOperationsController(options).transfer("Projects", "Archive", "copy", "folder"),
    ).toBe(true);
    expect(state.tabs[0].path).toBe("C:\\Notes\\Projects\\one.md");
    expect(state.recent[0].path).toBe("C:\\Notes\\Projects\\one.md");
    expect(replaceOpenTabs).not.toHaveBeenCalled();
    expect(clearCurrentDocument).not.toHaveBeenCalled();
    expect(invalidateDocumentCache).toHaveBeenCalledWith(["C:\\Notes\\Archive\\Projects"]);
  });

  it("updates only the old workspace cache after switching workspaces during a move", async () => {
    const { state, options, replaceOpenTabs, session } = setup();
    options.moveEntry = vi.fn(async () => {
      state.root = "D:\\Books";
      state.tabs = [{ path: "D:\\Books\\active.md", name: "active.md" }];
      state.current = { path: "D:\\Books\\active.md", modified: false };
      state.error = "New workspace warning";
      return "C:\\Notes\\Archive\\Projects";
    });

    expect(
      await createWorkspaceEntryOperationsController(options).transfer("Projects", "Archive", "move", "folder"),
    ).toBe(true);
    expect(state.tabs).toEqual([{ path: "D:\\Books\\active.md", name: "active.md" }]);
    expect(replaceOpenTabs).not.toHaveBeenCalled();
    expect(options.openPath).not.toHaveBeenCalled();
    expect(state.recent[0].path).toBe("C:\\Notes\\Archive\\Projects\\one.md");
    expect(state.cached.activeDocumentPath).toBe("C:\\Notes\\Archive\\Projects\\one.md");
    expect(session.persistWorkspaceSession).toHaveBeenCalledWith("C:\\Notes");
    expect(state.error).toBe("New workspace warning");
  });

  it("keeps the moved paths committed and reports a failed reopen", async () => {
    const { state, options, clearCurrentDocument } = setup();
    options.openPath = vi.fn(async () => false);

    expect(
      await createWorkspaceEntryOperationsController(options).transfer("Projects", "Archive", "move", "folder"),
    ).toBe(true);
    expect(clearCurrentDocument).toHaveBeenCalledOnce();
    expect(state.tabs[0].path).toBe("C:\\Notes\\Archive\\Projects\\one.md");
    expect(state.error).toContain("重新打开当前文档失败");
  });

  it("preserves edits made while a native move was in flight", async () => {
    const { state, options, clearCurrentDocument } = setup();
    options.moveEntry = vi.fn(async () => {
      state.current = { path: state.current!.path, modified: true };
      return "C:\\Notes\\Archive\\Projects";
    });

    expect(
      await createWorkspaceEntryOperationsController(options).transfer("Projects", "Archive", "move", "folder"),
    ).toBe(true);
    expect(clearCurrentDocument).not.toHaveBeenCalled();
    expect(options.openPath).not.toHaveBeenCalled();
    expect(state.error).toContain("仍保留在内存中");
  });

  it("does not release the current document when it becomes dirty during native deletion", async () => {
    const { state, options, releaseDocumentResources, clearCurrentDocument } = setup();
    options.deleteEntry = vi.fn(async () => {
      state.current = { path: state.current!.path, modified: true };
    });

    expect(await createWorkspaceEntryOperationsController(options).remove("Projects", "folder")).toBe(true);
    expect(releaseDocumentResources).not.toHaveBeenCalled();
    expect(clearCurrentDocument).not.toHaveBeenCalled();
    expect(state.error).toContain("仍保留在内存中");
  });

  it("rejects a second entry operation while the first native mutation is pending", async () => {
    const { options } = setup();
    let completeMove!: (path: string) => void;
    options.moveEntry = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          completeMove = resolve;
        }),
    );
    const controller = createWorkspaceEntryOperationsController(options);

    const pendingMove = controller.transfer("Projects", "Archive", "move", "folder");
    expect(await controller.remove("Projects", "folder")).toBe(false);
    expect(options.deleteEntry).not.toHaveBeenCalled();
    completeMove("C:\\Notes\\Archive\\Projects");
    expect(await pendingMove).toBe(true);
  });
});
