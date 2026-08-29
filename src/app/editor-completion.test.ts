import { describe, expect, it, vi } from "vitest";

import {
  flushEditorMarkdownChange,
  readCaretSlashTrigger,
  readCaretWikiTrigger,
  type CompletionEditorView,
} from "./editor-completion";

function createView(
  text: string,
  options: { caret?: number; parentName?: string; selectionEmpty?: boolean; basePosition?: number } = {},
): CompletionEditorView {
  const caret = options.caret ?? text.length;
  const parent = {
    type: { name: options.parentName ?? "paragraph" },
    textBetween: (from: number, to: number) => text.slice(from, to),
  };

  return {
    state: {
      selection: {
        empty: options.selectionEmpty ?? true,
        $from: {
          pos: (options.basePosition ?? 100) + caret,
          parentOffset: caret,
          parent,
        },
      },
    },
  };
}

describe("readCaretSlashTrigger", () => {
  it("returns the block-start query and replacement range", () => {
    expect(readCaretSlashTrigger(createView("/h1", { basePosition: 40 }))).toEqual({
      kind: "slash",
      query: "h1",
      from: 40,
      caret: 43,
    });
  });

  it("rejects non-empty selections, code blocks and non-block-start text", () => {
    expect(readCaretSlashTrigger(createView("/h1", { selectionEmpty: false }))).toBeNull();
    expect(readCaretSlashTrigger(createView("/h1", { parentName: "code_block" }))).toBeNull();
    expect(readCaretSlashTrigger(createView("text /h1"))).toBeNull();
    expect(readCaretSlashTrigger(createView("/h1 "))).toBeNull();
  });
});

describe("readCaretWikiTrigger", () => {
  it("returns the last open WikiLink and keeps its absolute range", () => {
    expect(readCaretWikiTrigger(createView("前置 [[Read", { basePosition: 40 }))).toEqual({
      kind: "wiki",
      query: "Read",
      from: 43,
      caret: 49,
    });
  });

  it("does not offer a completion inside code or after a closed/aliased link", () => {
    expect(readCaretWikiTrigger(createView("[[Read", { parentName: "code_block" }))).toBeNull();
    expect(readCaretWikiTrigger(createView("[[Read]]"))).toBeNull();
    expect(readCaretWikiTrigger(createView("[[Read|别名"))).toBeNull();
    expect(readCaretWikiTrigger(createView("[[Read", { selectionEmpty: false }))).toBeNull();
  });
});

describe("flushEditorMarkdownChange", () => {
  it("does not feed the current baseline back into app state", () => {
    const markEditorSource = vi.fn();
    const onChange = vi.fn();

    expect(flushEditorMarkdownChange("# Draft", "# Draft", markEditorSource, onChange)).toBe("# Draft");
    expect(markEditorSource).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("flushes an unsent serialized edit exactly once", () => {
    const markEditorSource = vi.fn();
    const onChange = vi.fn();
    const latest = "# Draft\n\n最后一笔编辑";

    expect(flushEditorMarkdownChange(latest, "# Draft", markEditorSource, onChange)).toBe(latest);
    expect(markEditorSource).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(latest);
  });
});
