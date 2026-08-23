import { afterEach, describe, expect, it } from "vitest";
import { loadRecentFiles, rememberRecentFile, saveRecentFiles } from "./storage";

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
});
