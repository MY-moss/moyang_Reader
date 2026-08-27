import { describe, expect, it } from "vitest";
import { applySourceEditorAction } from "./editor-context-actions";

describe("source editor context actions", () => {
  it("wraps selected text and puts the caret inside empty marks", () => {
    expect(applySourceEditorAction("hello", 0, 5, "bold")).toEqual({
      value: "**hello**",
      selectionStart: 2,
      selectionEnd: 7,
    });
    expect(applySourceEditorAction("hello", 5, 5, "italic")).toEqual({
      value: "hello**",
      selectionStart: 6,
      selectionEnd: 6,
    });
  });

  it("changes selected paragraphs without duplicating existing block prefixes", () => {
    expect(applySourceEditorAction("# One\nTwo", 0, 9, "bullet-list")?.value).toBe("- One\n- Two");
    expect(applySourceEditorAction("> Quote", 0, 7, "paragraph")?.value).toBe("Quote");
  });

  it("inserts common Markdown blocks at the selection", () => {
    expect(applySourceEditorAction("Before\nAfter", 7, 7, "table")?.value).toContain("| 列 1 | 列 2 | 列 3 |");
    expect(applySourceEditorAction("", 0, 0, "wikilink", "Note")?.value).toBe("[[Note]]");
    expect(applySourceEditorAction("", 0, 0, "image", "cover.png")?.value).toBe("![](cover.png)");
  });
});
