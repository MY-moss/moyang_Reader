import { afterEach, describe, expect, it } from "vitest";
import {
  loadRecentFiles,
  loadMountedWorkspaces,
  loadRecentWorkspaces,
  loadWorkspaceSessions,
  loadLastDocumentPath,
  loadOpenTabs,
  loadReadingPosition,
  loadSidebarCollapsed,
  loadContextPanelOpen,
  loadContextPanelTab,
  loadPaneWidths,
  rememberRecentFile,
  rememberMountedWorkspace,
  rememberRecentWorkspace,
  saveLastDocumentPath,
  saveOpenTabs,
  saveReadingPosition,
  saveSidebarCollapsed,
  saveContextPanelOpen,
  saveContextPanelTab,
  savePaneWidths,
  saveRecentFiles,
  saveMountedWorkspaces,
  saveRecentWorkspaces,
  saveWorkspaceSession,
  saveWorkspaceSessions,
  forgetWorkspaceSession,
} from "./storage";
import { normalizePathKey } from "./path-key";

afterEach(() => localStorage.clear());

describe("reader storage", () => {
  it("deduplicates recent files and keeps the newest twelve", () => {
    for (let index = 0; index < 14; index += 1) {
      rememberRecentFile({ path: `C:/Notes/${index}.md`, name: `${index}.md` });
    }

    const files = loadRecentFiles();
    expect(files).toHaveLength(12);
    expect(files[0].name).toBe("13.md");

    rememberRecentFile({ path: "C:/Notes/5.md", name: "renamed.md" });
    expect(loadRecentFiles()[0].name).toBe("renamed.md");
  });

  it("persists a pruned recent-file list", () => {
    saveRecentFiles([{ path: "C:/Notes/keep.md", name: "keep.md" }]);

    expect(loadRecentFiles()).toEqual([{ path: "C:/Notes/keep.md", name: "keep.md" }]);
  });

  it("persists and clears the last document path", () => {
    expect(loadLastDocumentPath()).toBeNull();

    saveLastDocumentPath("C:/Notes/last.md");
    expect(loadLastDocumentPath()).toBe("C:/Notes/last.md");

    saveLastDocumentPath(null);
    expect(loadLastDocumentPath()).toBeNull();
  });

  it("persists the sidebar collapsed state", () => {
    expect(loadSidebarCollapsed()).toBe(false);

    saveSidebarCollapsed(true);
    expect(loadSidebarCollapsed()).toBe(true);

    saveSidebarCollapsed(false);
    expect(loadSidebarCollapsed()).toBe(false);
  });

  it("persists the right context panel state and tab", () => {
    expect(loadContextPanelOpen()).toBe(true);
    expect(loadContextPanelTab()).toBe("outline");

    saveContextPanelOpen(false);
    saveContextPanelTab("properties");

    expect(loadContextPanelOpen()).toBe(false);
    expect(loadContextPanelTab()).toBe("properties");
  });

  it("persists bounded pane widths and recovers from malformed values", () => {
    expect(loadPaneWidths()).toEqual({ sidebar: 260, context: 320 });

    savePaneWidths({ sidebar: 311.4, context: 900 });
    expect(loadPaneWidths()).toEqual({ sidebar: 311, context: 440 });

    localStorage.setItem("moyang-reader-pane-widths", "not-json");
    expect(loadPaneWidths()).toEqual({ sidebar: 260, context: 320 });
  });

  it("falls back from the removed graph placeholder tab", () => {
    localStorage.setItem("moyang-reader-context-panel-tab", "graph");

    expect(loadContextPanelTab()).toBe("outline");
  });

  it("persists bounded native tabs and drops temporary browser documents", () => {
    saveOpenTabs([
      { path: "C:/I-NOTES/INDEX.md", name: "first.md" },
      { path: "c:\\i-notes\\index.md", name: "duplicate.md" },
      { path: "browser://temporary.md", name: "temporary.md" },
      ...Array.from({ length: 17 }, (_, index) => ({
        path: `C:/Notes/${index + 2}.md`,
        name: `${index + 2}.md`,
      })),
    ]);

    const tabs = loadOpenTabs();
    expect(tabs).toHaveLength(16);
    expect(tabs[0]).toEqual({ path: "C:/I-NOTES/INDEX.md", name: "first.md" });
    expect(tabs.some((tab) => tab.path.startsWith("browser://"))).toBe(false);
    expect(tabs.filter((tab) => normalizePathKey(tab.path) === "c:\\i-notes\\index.md")).toHaveLength(1);
  });

  it("stores reading positions case-insensitively and keeps a bounded history", () => {
    saveReadingPosition("C:/Notes/Guide.md", 420.6);
    expect(loadReadingPosition("c:\\notes\\guide.md")).toBe(421);

    saveReadingPosition("c:\\NOTES\\GUIDE.md", 90);
    expect(loadReadingPosition("C:/Notes/Guide.md")).toBe(90);

    for (let index = 0; index < 40; index += 1) {
      saveReadingPosition(`C:/Notes/${index}.md`, index);
    }
    expect(loadReadingPosition("C:/Notes/0.md")).toBe(0);
    expect(loadReadingPosition("C:/Notes/39.md")).toBe(39);
    expect(JSON.parse(localStorage.getItem("moyang-reader-reading-positions") ?? "[]")).toHaveLength(32);
  });

  it("deduplicates recent workspaces case-insensitively and keeps the newest eight", () => {
    for (let index = 0; index < 10; index += 1) {
      rememberRecentWorkspace({ path: `C:/Vault-${index}`, name: `Vault ${index}` });
    }

    expect(loadRecentWorkspaces()).toHaveLength(8);
    expect(loadRecentWorkspaces()[0].name).toBe("Vault 9");

    rememberRecentWorkspace({ path: "c:\\VAULT-5", name: "Renamed vault" });
    expect(loadRecentWorkspaces()[0]).toEqual({ path: "c:\\VAULT-5", name: "Renamed vault" });
    expect(loadRecentWorkspaces()).toHaveLength(8);
  });

  it("filters malformed and duplicate workspace records before saving", () => {
    localStorage.setItem(
      "moyang-reader-recent-workspaces",
      JSON.stringify([
        { path: "C:/Notes", name: "Notes" },
        { path: "c:\\notes", name: "Duplicate" },
        { path: "", name: "Missing path" },
        { path: "C:/Archive", name: 42 },
      ]),
    );

    expect(loadRecentWorkspaces()).toEqual([{ path: "C:/Notes", name: "Notes" }]);

    saveRecentWorkspaces([
      { path: "C:/Notes", name: "Notes" },
      { path: "C:/Archive", name: "Archive" },
    ]);
    expect(loadRecentWorkspaces()).toHaveLength(2);
  });

  it("persists at most five mounted workspaces and moves reopened workspaces to the front", () => {
    for (let index = 0; index < 7; index += 1) {
      rememberMountedWorkspace({ path: `C:/Mounted-${index}`, name: `Mounted ${index}` });
    }

    expect(loadMountedWorkspaces()).toHaveLength(5);
    expect(loadMountedWorkspaces()[0].name).toBe("Mounted 6");

    rememberMountedWorkspace({ path: "c:\\mounted-4", name: "Renamed mounted" });
    expect(loadMountedWorkspaces()[0]).toEqual({ path: "c:\\mounted-4", name: "Renamed mounted" });
    expect(loadMountedWorkspaces()).toHaveLength(5);

    saveMountedWorkspaces([
      { path: "C:/One", name: "One" },
      { path: "c:\\one", name: "Duplicate" },
      { path: "C:/Two", name: "Two" },
    ]);
    expect(loadMountedWorkspaces()).toEqual([
      { path: "C:/One", name: "One" },
      { path: "C:/Two", name: "Two" },
    ]);
  });

  it("persists bounded per-workspace tabs and rejects paths outside the workspace", () => {
    saveWorkspaceSessions([
      {
        path: "C:/Notes",
        tabs: [
          { path: "C:/Notes/today.md", name: "today.md" },
          { path: "C:/Other/outside.md", name: "outside.md" },
          { path: "browser://temporary.md", name: "temporary.md" },
        ],
        activeDocumentPath: "C:/Other/outside.md",
      },
      {
        path: "c:\\notes",
        tabs: [{ path: "c:\\notes\\duplicate.md", name: "duplicate.md" }],
        activeDocumentPath: "c:\\notes\\duplicate.md",
      },
    ]);

    expect(loadWorkspaceSessions()).toEqual([
      {
        path: "C:/Notes",
        tabs: [{ path: "C:/Notes/today.md", name: "today.md" }],
        activeDocumentPath: null,
      },
    ]);

    saveWorkspaceSession({
      path: "C:/Archive",
      tabs: [{ path: "C:/Archive/index.md", name: "index.md" }],
      activeDocumentPath: "C:/Archive/index.md",
    });
    expect(loadWorkspaceSessions()[0].path).toBe("C:/Archive");

    forgetWorkspaceSession("c:\\archive");
    expect(loadWorkspaceSessions()).toHaveLength(1);
    expect(loadWorkspaceSessions()[0].path).toBe("C:/Notes");
  });
});
