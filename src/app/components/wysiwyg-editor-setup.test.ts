import { describe, expect, it, vi } from "vitest";
import { defaultValueCtx, Editor, editorViewCtx, rootCtx, serializerCtx } from "@milkdown/kit/core";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";

import { buildWysiwygEditorPlugins } from "./wysiwyg-editor-setup";

describe("wysiwyg editor setup", () => {
  it("creates a Milkdown editor with the doc schema mounted", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, "# 标题\n\n正文。");
      })
      .use(buildWysiwygEditorPlugins())
      .use(listener)
      .config((ctx) => {
        ctx.get(listenerCtx).markdownUpdated(() => {});
      });

    await editor.create();

    // Regression guard: without the commonmark preset the editor used to fail
    // with "Schema is missing its top node type ('doc')" and stayed blank.
    expect(root.querySelector('[contenteditable="true"]')).toBeTruthy();
    expect(root.querySelector(".editor")).toBeTruthy();
    expect(root.querySelector(".editor p")).toBeTruthy();

    await editor.destroy();
    root.remove();
  });

  it("serializes supported GFM structures without dropping their semantics", async () => {
    const source = [
      "# GFM",
      "",
      "- [ ] todo",
      "- [x] done",
      "",
      "~~deleted~~",
      "",
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "",
      "Footnote[^1].",
      "",
      "[^1]: footnote text",
      "",
      "<https://example.com>",
    ].join("\n");
    const root = document.createElement("div");
    document.body.appendChild(root);

    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, source);
      })
      .use(buildWysiwygEditorPlugins())
      .use(listener)
      .config((ctx) => {
        ctx.get(listenerCtx).markdownUpdated(() => {});
      });

    try {
      await editor.create();

      const view = editor.ctx.get(editorViewCtx) as unknown as { state: { doc: unknown } };
      const serializer = editor.ctx.get(serializerCtx) as unknown as (doc: unknown) => string;
      const serialized = serializer(view.state.doc);

      expect(serialized).toMatch(/[*-] \[ \] todo/);
      expect(serialized).toMatch(/[*-] \[x\] done/);
      expect(serialized).toContain("~~deleted~~");
      expect(serialized).toMatch(/\|\s*A\s*\|\s*B\s*\|/);
      expect(serialized).toContain("| 1 | 2 |");
      expect(serialized).toContain("Footnote[^1].");
      expect(serialized).toContain("[^1]: footnote text");
      expect(serialized).toContain("<https://example.com>");
    } finally {
      await editor.destroy();
      root.remove();
    }
  });

  it("debounces a local edit for 200ms and then emits the latest Markdown", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    document.body.appendChild(root);
    const updates: string[] = [];

    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, "# 标题\n\n正文。");
      })
      .use(buildWysiwygEditorPlugins())
      .use(listener)
      .config((ctx) => {
        ctx.get(listenerCtx).markdownUpdated((_context, markdown) => updates.push(markdown));
      });

    try {
      await editor.create();
      const view = editor.ctx.get(editorViewCtx) as unknown as {
        state: { tr: { insertText: (text: string, from: number, to?: number) => unknown } };
        dispatch: (transaction: unknown) => void;
      };

      view.dispatch(view.state.tr.insertText("追加", 1));
      expect(updates).toEqual([]);

      await vi.advanceTimersByTimeAsync(199);
      expect(updates).toEqual([]);

      await vi.advanceTimersByTimeAsync(1);
      expect(updates).toHaveLength(1);
      expect(updates[0]).toContain("追加");
    } finally {
      await editor.destroy();
      root.remove();
      vi.useRealTimers();
    }
  });
});
