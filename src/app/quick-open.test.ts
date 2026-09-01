import { describe, expect, it } from "vitest";
import { rankQuickOpenItems, type QuickOpenCandidate } from "./quick-open";

function item(path: string, isRecent = false): QuickOpenCandidate {
  return {
    path: `C:/vault/${path}`,
    name: path.split("/").pop() ?? path,
    relativePath: path,
    isRecent,
  };
}

describe("quick open ranking", () => {
  it("keeps recent items first when no query is entered", () => {
    const items = [item("notes/Second.md"), item("notes/First.md", true), item("README.md")];

    expect(rankQuickOpenItems(items, "").map((entry) => entry.name)).toEqual(["Second.md", "First.md", "README.md"]);
  });

  it("ranks exact names and path matches before fuzzy matches", () => {
    const items = [item("archive/project-plan.md"), item("notes/Plan.md"), item("notes/Plain.md")];

    expect(rankQuickOpenItems(items, "plan").map((entry) => entry.relativePath)).toEqual([
      "notes/Plan.md",
      "archive/project-plan.md",
      "notes/Plain.md",
    ]);
  });

  it("supports multiple tokens and removes duplicate paths", () => {
    const target = item("notes/Reading List.md");
    const duplicate = { ...target, isRecent: true };

    expect(rankQuickOpenItems([target, duplicate, item("notes/Other.md")], "reading list")).toEqual([
      { ...target, isRecent: true },
    ]);
  });

  it("matches Chinese filenames by their Rust-provided initials", () => {
    const chinese = { ...item("notes/北京笔记.md"), pinyinKey: "bjbjmd" };
    const english = item("notes/backup.md");

    expect(rankQuickOpenItems([english, chinese], "bj").map((entry) => entry.name)).toEqual(["北京笔记.md"]);
  });
});
