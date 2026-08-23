import { describe, expect, it } from "vitest";
import { findBacklinks, findLinkedEntry, linkMatchesEntry } from "./workspace-index";
import type { WorkspaceIndexEntry } from "./types";

function entry(path: string, links: string[] = []): WorkspaceIndexEntry {
  const name = path.split("/").pop() ?? path;
  return {
    file: { path, name, relativePath: path, size: 1, kind: "markdown" },
    title: name.replace(/\.md$/i, ""),
    links,
    tags: [],
  };
}

describe("workspace index", () => {
  it("matches wiki links by relative path or note name", () => {
    const target = entry("notes/Target.md");

    expect(linkMatchesEntry("Target", target)).toBe(true);
    expect(linkMatchesEntry("notes/Target.md#Section", target)).toBe(true);
    expect(linkMatchesEntry("notes/Target.markdown", target)).toBe(true);
    expect(linkMatchesEntry("Other", target)).toBe(false);
  });

  it("finds backlinks without including the current note", () => {
    const target = entry("Target.md");
    const source = entry("Source.md", ["Target"]);
    const unrelated = entry("Other.md", ["Elsewhere"]);

    expect(findBacklinks([target, source, unrelated], target).map((item) => item.file.name)).toEqual(["Source.md"]);
  });

  it("prefers a same-folder note before falling back to the workspace name", () => {
    const current = entry("notes/Current.md");
    const sameFolder = entry("notes/Target.md");
    const otherFolder = entry("archive/Target.md");

    expect(findLinkedEntry([otherFolder, sameFolder], current, "Target#Section")?.file.path)
      .toBe("notes/Target.md");
    expect(findLinkedEntry([otherFolder, sameFolder], current, "archive/Target")?.file.path)
      .toBe("archive/Target.md");
  });
});
