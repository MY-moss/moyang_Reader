import { describe, expect, it } from "vitest";
import {
  applyEditorInsert,
  buildMarkdownImage,
  buildMarkdownLink,
  buildMarkdownTable,
  buildMarkdownWikiLink,
  normalizeTableDimension,
} from "./editor-insertion";

describe("editor insertion builders", () => {
  it("builds a link with the edited label and optional title", () => {
    expect(buildMarkdownLink("项目主页", "https://example.com", "打开网站")).toBe(
      '[项目主页](https://example.com "打开网站")',
    );
  });

  it("rejects empty or executable destinations", () => {
    expect(buildMarkdownLink("链接", "")).toBeNull();
    expect(buildMarkdownLink("链接", "javascript:alert(1)")).toBeNull();
    expect(buildMarkdownImage("data:text/html,alert(1)", "图片")).toBeNull();
  });

  it("keeps wiki aliases and image alt text as separate fields", () => {
    expect(buildMarkdownWikiLink("项目计划", "查看计划")).toBe("[[项目计划|查看计划]]");
    expect(buildMarkdownImage("images/cover.png", "封面")).toBe("![封面](images/cover.png)");
  });

  it("clamps table dimensions and creates an editable Markdown table", () => {
    expect(normalizeTableDimension(1)).toBe(2);
    expect(normalizeTableDimension(99)).toBe(8);
    const table = buildMarkdownTable(4, 5);

    expect(table.rows).toBe(4);
    expect(table.columns).toBe(5);
    expect(table.markdown).toContain("列 5");
    expect(table.markdown.split("\n")).toHaveLength(5);
    expect(table.firstCellOffset).toBeGreaterThan(table.markdown.indexOf("|  |"));
  });

  it("replaces the current selection without losing surrounding text", () => {
    const result = applyEditorInsert("前后", 1, 1, {
      kind: "wikilink",
      target: "目标笔记",
    });

    expect(result?.value).toBe("前[[目标笔记]]后");
    expect(result?.selectionStart).toBe(9);
    expect(result?.selectionEnd).toBe(9);
  });
});
