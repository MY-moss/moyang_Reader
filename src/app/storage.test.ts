import { afterEach, describe, expect, it } from "vitest";
import {
  loadRecentFiles,
  loadRecentWorkspaces,
  rememberRecentFile,
  rememberRecentWorkspace,
  saveRecentFiles,
  saveRecentWorkspaces,
} from "./storage";

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
    localStorage.setItem("moyang-reader-recent-workspaces", JSON.stringify([
      { path: "C:/Notes", name: "Notes" },
      { path: "c:\\notes", name: "Duplicate" },
      { path: "", name: "Missing path" },
      { path: "C:/Archive", name: 42 },
    ]));

    expect(loadRecentWorkspaces()).toEqual([{ path: "C:/Notes", name: "Notes" }]);

    saveRecentWorkspaces([
      { path: "C:/Notes", name: "Notes" },
      { path: "C:/Archive", name: "Archive" },
    ]);
    expect(loadRecentWorkspaces()).toHaveLength(2);
  });
});
