import { describe, expect, it } from "vitest";
import { buildWorkspaceTree } from "./workspace-tree";
import type { WorkspaceDirectory, WorkspaceFile } from "./types";

function file(relativePath: string): WorkspaceFile {
  return {
    path: `C:/vault/${relativePath}`,
    name: relativePath.split(/[\\/]/).pop() ?? relativePath,
    relativePath,
    size: 1,
    kind: "markdown",
  };
}

function directory(relativePath: string): WorkspaceDirectory {
  return {
    path: `C:/vault/${relativePath}`,
    name: relativePath.split(/[\\/]/).pop() ?? relativePath,
    relativePath,
  };
}

describe("workspace tree", () => {
  it("separates root files and builds nested folders", () => {
    const tree = buildWorkspaceTree([
      file("README.md"),
      file("notes/10-later.md"),
      file("notes/2-now.md"),
      file("notes/deep/Topic.md"),
    ]);

    expect(tree.files.map((item) => item.name)).toEqual(["README.md"]);
    expect(tree.folders.map((folder) => folder.name)).toEqual(["notes"]);
    expect(tree.folders[0].fileCount).toBe(3);
    expect(tree.folders[0].files.map((item) => item.name)).toEqual(["2-now.md", "10-later.md"]);
    expect(tree.folders[0].folders[0].path).toBe("notes/deep");
  });

  it("normalizes Windows separators while keeping display names", () => {
    const tree = buildWorkspaceTree([file("Docs\\Design\\Plan.md")]);

    expect(tree.folders[0].path).toBe("Docs");
    expect(tree.folders[0].folders[0].path).toBe("Docs/Design");
    expect(tree.folders[0].folders[0].files[0].name).toBe("Plan.md");
  });

  it("reuses a folder node for case-insensitive paths", () => {
    const tree = buildWorkspaceTree([file("Notes/First.md"), file("notes/Second.md")]);

    expect(tree.folders).toHaveLength(1);
    expect(tree.folders[0].fileCount).toBe(2);
    expect(tree.folders[0].files.map((item) => item.name)).toEqual(["First.md", "Second.md"]);
  });

  it("does not mutate the source file list", () => {
    const files = [file("b.md"), file("a.md")];
    const originalOrder = files.map((item) => item.relativePath);

    buildWorkspaceTree(files);

    expect(files.map((item) => item.relativePath)).toEqual(originalOrder);
  });

  it("keeps empty directories visible", () => {
    const tree = buildWorkspaceTree([], [directory("Archive"), directory("Archive/2026")]);

    expect(tree.folders).toHaveLength(1);
    expect(tree.folders[0].name).toBe("Archive");
    expect(tree.folders[0].fileCount).toBe(0);
    expect(tree.folders[0].folders[0].name).toBe("2026");
  });
});
