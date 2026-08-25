import { describe, expect, it } from "vitest";
import { defaultValueCtx, Editor, rootCtx } from "@milkdown/kit/core";
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
});
