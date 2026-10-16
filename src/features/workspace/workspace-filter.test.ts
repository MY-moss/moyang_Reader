import { describe, expect, it } from "vitest";
import type { WorkspaceFile } from "../../shared/types";
import { matchesWorkspaceFilter, type WorkspaceKindFilter } from "./workspace-filter";

function file(path: string, kind: WorkspaceFile["kind"]): WorkspaceFile {
  return { path, name: path, relativePath: path, size: 1, kind };
}

describe("workspace filters", () => {
  it("matches all document kinds when no kind filter is selected", () => {
    const tagged = new Set(["notes.docx"]);

    expect(matchesWorkspaceFilter(file("notes.md", "markdown"), "all", null, tagged)).toBe(true);
    expect(matchesWorkspaceFilter(file("notes.docx", "docx"), "all", null, tagged)).toBe(true);
  });

  it("combines document kind and tag filters", () => {
    const tagged = new Set(["guide.md"]);
    const kind: WorkspaceKindFilter = "markdown";

    expect(matchesWorkspaceFilter(file("guide.md", "markdown"), kind, "guide", tagged)).toBe(true);
    expect(matchesWorkspaceFilter(file("guide.docx", "docx"), kind, "guide", tagged)).toBe(false);
    expect(matchesWorkspaceFilter(file("other.md", "markdown"), kind, "guide", tagged)).toBe(false);
  });
});
