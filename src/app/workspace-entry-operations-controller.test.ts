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
    requestName: vi.fn(async (request, submit) => (await submit(request.initialName)) === "done"),
    confirmDocumentReplacement: vi.fn(async () => true),
    createNote: vi.fn(async () => "C:\\Notes\\created.md"),
    createFolder: vi.fn(async () => "C:\\Notes\\Created"),
    confirm: vi.fn(() => true),
    saveDocument: vi.fn(async () => true),
    openPath: vi.fn(async () => true),
    renameEntry: vi.fn(async () => "C:\\Notes\\Archive"),
    deleteEntry: vi.fn(async () => undefined),
    moveEntry: vi.fn(async () => "C:\\Notes\\Archive\\Projects"),
    copyEntry: vi.fn(async () => "C:\\Notes\\Archive\\Projects"),
    duplicateEntry: vi.fn(async () => "C:\\Notes\\Projects\\one 副本.md"),
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
  it.each([
    ["zh-CN", "file", "Projects/one.md", "one 副本.md"],
    ["en-US", "file", "Projects/one.md", "one copy.md"],
    ["zh-CN", "folder", "Projects/Folder.txt", "Folder.txt 副本"],
    ["en-US", "folder", "Projects/Folder.txt", "Folder.txt copy"],
  ] as const)("duplicates %s %s without changing source sessions", async (locale, kind, entry, name) => {
    const { options, state, replaceOpenTabs, session } = setup();
    options.getLocale = () => locale;
    state.current!.modified = true;
    const current = state.current;
    const recent = [...state.recent];
    expect(await createWorkspaceEntryOperationsController(options).duplicate(entry, kind)).toBe(true);
    expect(options.requestName).toHaveBeenCalledWith(
      expect.objectContaining({ action: "duplicate", kind, parentPath: "Projects", initialName: name }),
      expect.any(Function),
    );
    expect(options.duplicateEntry).toHaveBeenCalledExactlyOnceWith("C:\\Notes", entry, name);
    expect(options.saveDocument).not.toHaveBeenCalled();
    expect(options.confirm).not.toHaveBeenCalled();
    expect(options.openPath).not.toHaveBeenCalled();
    expect(replaceOpenTabs).not.toHaveBeenCalled();
    expect(session.updateCachedWorkspace).not.toHaveBeenCalled();
    expect(state.current).toBe(current);
    expect(state.recent).toEqual(recent);
    expect(options.invalidateDocumentCache).toHaveBeenCalledWith(["C:\\Notes\\Projects\\one 副本.md"]);
  });

  it("does not copy when the input is cancelled", async () => {
    const { options } = setup();
    options.requestName = vi.fn(async () => false);
    expect(await createWorkspaceEntryOperationsController(options).duplicate("Projects/one.md", "file")).toBe(false);
    expect(options.duplicateEntry).not.toHaveBeenCalled();
  });

  it.each(["root", "dispose"])("invalidates pending copy on %s and holds the mutation lock", async (change) => {
    const { options, state } = setup();
    let submit!: Parameters<WorkspaceEntryOperationsOptions["requestName"]>[1];
    let resolve!: (value: boolean) => void;
    options.requestName = vi.fn((_request, callback) => {
      submit = callback;
      return new Promise<boolean>((done) => {
        resolve = done;
      });
    });
    const controller = createWorkspaceEntryOperationsController(options);
    const pending = controller.duplicate("Projects/one.md", "file");
    expect(await controller.rename("Projects/one.md", "file")).toBe(false);
    expect(options.requestName).toHaveBeenCalledOnce();
    if (change === "root") state.root = "D:\\Other";
    else controller.dispose();
    expect(await submit("Another.md")).toBe("cancelled");
    resolve(false);
    expect(await pending).toBe(false);
    expect(options.duplicateEntry).not.toHaveBeenCalled();
  });

  it("leaves IO failure retryable without touching cache, tabs or sessions", async () => {
    const { options, replaceOpenTabs, session } = setup();
    const cause = new Error("existing target");
    options.duplicateEntry = vi.fn(async () => {
      throw cause;
    });
    await expect(createWorkspaceEntryOperationsController(options).duplicate("Projects/one.md", "file")).rejects.toBe(
      cause,
    );
    expect(options.refreshWorkspaceChanges).not.toHaveBeenCalled();
    expect(options.invalidateDocumentCache).not.toHaveBeenCalled();
    expect(replaceOpenTabs).not.toHaveBeenCalled();
    expect(session.updateCachedWorkspace).not.toHaveBeenCalled();
  });

  it("completes the input after a successful copy even when refresh fails", async () => {
    const { options } = setup();
    options.refreshWorkspaceChanges = vi.fn(async () => {
      throw new Error();
    });
    expect(await createWorkspaceEntryOperationsController(options).duplicate("Projects/one.md", "file")).toBe(true);
    expect(options.duplicateEntry).toHaveBeenCalledOnce();
    expect(options.setError).toHaveBeenCalledWith(expect.stringContaining("不要重复复制"));
  });

  it("does not overwrite a new workspace's feedback after copy IO", async () => {
    const { options, state, replaceOpenTabs } = setup();
    options.duplicateEntry = vi.fn(async () => {
      state.root = "D:\\Other";
      state.error = "new workspace warning";
      return "C:\\Notes\\Projects\\one 副本.md";
    });
    expect(await createWorkspaceEntryOperationsController(options).duplicate("Projects/one.md", "file")).toBe(true);
    expect(state.error).toBe("new workspace warning");
    expect(replaceOpenTabs).not.toHaveBeenCalled();
    expect(options.openPath).not.toHaveBeenCalled();
  });

  it("creates a note only after document replacement, then refreshes and opens it", async () => {
    const { options } = setup();
    const controller = createWorkspaceEntryOperationsController(options);
    expect(await controller.createNote("Projects")).toBe(true);
    expect(options.requestName).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create-note", parentPath: "Projects" }),
      expect.any(Function),
    );
    expect(options.confirmDocumentReplacement).toHaveBeenCalledOnce();
    expect(options.createNote).toHaveBeenCalledExactlyOnceWith("C:\\Notes", "Projects", "未命名笔记");
    expect(options.refreshWorkspaceChanges).toHaveBeenCalledWith("C:\\Notes", ["C:\\Notes\\created.md"]);
    expect(options.openPath).toHaveBeenCalledWith("C:\\Notes\\created.md", false);
  });

  it("creates a folder without replacing or opening the current document", async () => {
    const { options, state } = setup();
    const current = state.current;
    expect(await createWorkspaceEntryOperationsController(options).createFolder("")).toBe(true);
    expect(options.createFolder).toHaveBeenCalledExactlyOnceWith("C:\\Notes", "", "新建文件夹");
    expect(options.confirmDocumentReplacement).not.toHaveBeenCalled();
    expect(options.openPath).not.toHaveBeenCalled();
    expect(state.current).toBe(current);
  });

  it("does not create when the name input or replacement is cancelled", async () => {
    const { options } = setup();
    options.requestName = vi.fn(async () => false);
    const controller = createWorkspaceEntryOperationsController(options);
    expect(await controller.createNote("")).toBe(false);
    expect(options.confirmDocumentReplacement).not.toHaveBeenCalled();
    options.requestName = vi.fn(async (request, submit) => (await submit(request.initialName)) === "done");
    options.confirmDocumentReplacement = vi.fn(async () => false);
    expect(await controller.createNote("")).toBe(false);
    expect(options.createNote).not.toHaveBeenCalled();
    expect(options.refreshWorkspaceChanges).not.toHaveBeenCalled();
  });

  for (const change of ["root", "document", "dispose"] as const) {
    it(`rejects ${change} changes while the name is pending`, async () => {
      const { options, state } = setup();
      let submitName!: Parameters<WorkspaceEntryOperationsOptions["requestName"]>[1];
      let resolveName!: (accepted: boolean) => void;
      options.requestName = vi.fn((_request, submit) => {
        submitName = submit;
        return new Promise<boolean>((resolve) => {
          resolveName = resolve;
        });
      });
      const controller = createWorkspaceEntryOperationsController(options);
      const pending = controller.createNote("");
      expect(await controller.createFolder("")).toBe(false);
      if (change === "root") state.root = "D:\\Other";
      if (change === "document") state.current = { path: "C:\\Notes\\other.md", modified: false };
      if (change === "dispose") controller.dispose();
      expect(await submitName("Next")).toBe("cancelled");
      resolveName(false);
      expect(await pending).toBe(false);
      expect(options.createNote).not.toHaveBeenCalled();
      expect(options.confirmDocumentReplacement).not.toHaveBeenCalled();
    });
  }

  it("rechecks the workspace after an asynchronous replacement decision", async () => {
    const { options, state } = setup();
    options.confirmDocumentReplacement = vi.fn(async () => {
      state.root = "D:\\Other";
      return true;
    });
    expect(await createWorkspaceEntryOperationsController(options).createNote("")).toBe(false);
    expect(options.createNote).not.toHaveBeenCalled();
  });

  for (const change of ["root", "document", "dispose"] as const) {
    it(`rejects a rename after ${change} changes while input is pending`, async () => {
      const { options, state, replaceOpenTabs } = setup();
      let submitName!: Parameters<WorkspaceEntryOperationsOptions["requestName"]>[1];
      let resolveName!: (accepted: boolean) => void;
      options.requestName = vi.fn((_request, submit) => {
        submitName = submit;
        return new Promise<boolean>((resolve) => {
          resolveName = resolve;
        });
      });
      const controller = createWorkspaceEntryOperationsController(options);
      const pending = controller.rename("Projects/one.md", "file");
      if (change === "root") state.root = "D:\\Other";
      if (change === "document") state.current = { path: "C:\\Notes\\other.md", modified: false };
      if (change === "dispose") controller.dispose();
      expect(await submitName("Next.md")).toBe("cancelled");
      resolveName(false);
      expect(await pending).toBe(false);
      expect(options.renameEntry).not.toHaveBeenCalled();
      expect(replaceOpenTabs).not.toHaveBeenCalled();
    });
  }

  it("propagates failed IO to the input without updating view, tabs or session", async () => {
    const { options, state, replaceOpenTabs, session } = setup();
    const current = state.current;
    const cause = new Error("disk unavailable");
    options.createNote = vi.fn(async () => {
      throw cause;
    });
    await expect(createWorkspaceEntryOperationsController(options).createNote("")).rejects.toBe(cause);
    expect(options.refreshWorkspaceChanges).not.toHaveBeenCalled();
    expect(options.openPath).not.toHaveBeenCalled();
    expect(replaceOpenTabs).not.toHaveBeenCalled();
    expect(session.updateCachedWorkspace).not.toHaveBeenCalled();
    expect(state.current).toBe(current);
  });

  it("finishes a successful create despite refresh or open failures so retry cannot duplicate it", async () => {
    const { options } = setup();
    options.refreshWorkspaceChanges = vi.fn(async () => {
      throw new Error();
    });
    options.openPath = vi.fn(async () => false);
    expect(await createWorkspaceEntryOperationsController(options).createNote("")).toBe(true);
    expect(options.createNote).toHaveBeenCalledOnce();
    expect(options.setError).toHaveBeenCalledWith(expect.stringContaining("不要重复创建"));
  });

  it("does not open an old created note over a workspace changed during IO", async () => {
    const { options, state } = setup();
    options.createNote = vi.fn(async () => {
      state.root = "D:\\Other";
      return "C:\\Notes\\created.md";
    });
    expect(await createWorkspaceEntryOperationsController(options).createNote("")).toBe(true);
    expect(options.openPath).not.toHaveBeenCalled();
    expect(options.setError).not.toHaveBeenCalled();
  });

  it("returns save failure to the rename input without renaming or half updating", async () => {
    const { options, state, replaceOpenTabs, session } = setup();
    state.current!.modified = true;
    options.requestName = vi.fn(async (_request, submit) => (await submit("Archive")) === "done");
    options.saveDocument = vi.fn(async () => false);
    await expect(createWorkspaceEntryOperationsController(options).rename("Projects", "folder")).rejects.toMatchObject({
      code: "FILE_WRITE_FAILED",
    });
    expect(options.renameEntry).not.toHaveBeenCalled();
    expect(replaceOpenTabs).not.toHaveBeenCalled();
    expect(session.updateCachedWorkspace).not.toHaveBeenCalled();
  });

  it("propagates a failed rename without half updating paths", async () => {
    const { options, replaceOpenTabs, session } = setup();
    options.requestName = vi.fn(async (_request, submit) => (await submit("Archive")) === "done");
    options.renameEntry = vi.fn(async () => {
      throw new Error("exists");
    });
    await expect(createWorkspaceEntryOperationsController(options).rename("Projects", "folder")).rejects.toThrow(
      "exists",
    );
    expect(replaceOpenTabs).not.toHaveBeenCalled();
    expect(session.updateCachedWorkspace).not.toHaveBeenCalled();
  });

  it("waits for an asynchronous deletion decision and leaves state untouched on cancellation", async () => {
    const { state, options, replaceOpenTabs, session } = setup();
    let decide!: (accepted: boolean) => void;
    options.confirm = vi.fn(() => new Promise<boolean>((resolve) => (decide = resolve)));
    const controller = createWorkspaceEntryOperationsController(options);
    const pending = controller.remove("Projects", "folder");
    expect(options.deleteEntry).not.toHaveBeenCalled();
    expect(await controller.remove("other.md", "file")).toBe(false);
    expect(options.confirm).toHaveBeenCalledOnce();
    decide(false);
    expect(await pending).toBe(false);
    expect(options.deleteEntry).not.toHaveBeenCalled();
    expect(replaceOpenTabs).not.toHaveBeenCalled();
    expect(session.persistWorkspaceSession).not.toHaveBeenCalled();
    expect(state.current?.path).toBe("C:\\Notes\\Projects\\one.md");
  });

  it("does not save or delete after the workspace changes while deletion confirmation is open", async () => {
    const { state, options } = setup();
    state.current = { path: state.current!.path, modified: true };
    options.confirm = vi.fn(async () => {
      state.root = "D:\\Books";
      return true;
    });
    expect(await createWorkspaceEntryOperationsController(options).remove("Projects", "folder")).toBe(false);
    expect(options.confirm).toHaveBeenCalledOnce();
    expect(options.saveDocument).not.toHaveBeenCalled();
    expect(options.deleteEntry).not.toHaveBeenCalled();
  });

  it("does not save a different document selected while the dirty-document confirmation is open", async () => {
    const { state, options } = setup();
    state.current = { path: state.current!.path, modified: true };
    options.confirm = vi.fn(async () => {
      state.current = { path: "C:\\Notes\\other.md", modified: true };
      return true;
    });
    expect(
      await createWorkspaceEntryOperationsController(options).transfer("Projects", "Archive", "move", "folder"),
    ).toBe(false);
    expect(options.saveDocument).not.toHaveBeenCalled();
    expect(options.moveEntry).not.toHaveBeenCalled();
  });

  it("rebases affected tabs, recent files, the cached session and current document after a folder rename", async () => {
    const { state, options, session, replaceOpenTabs } = setup();
    options.requestName = vi.fn(async (_request, submit) => (await submit("Archive")) === "done");

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

  it("describes the deletion target without coupling the controller to dialog copy", async () => {
    const { state, options } = setup();
    state.current = { path: state.current!.path, modified: true };
    options.getLocale = () => "en-US";
    options.confirm = vi.fn(() => false);

    expect(await createWorkspaceEntryOperationsController(options).remove("Projects", "folder")).toBe(false);
    expect(options.confirm).toHaveBeenCalledWith({ type: "delete", path: "C:\\Notes\\Projects", kind: "folder" });
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
