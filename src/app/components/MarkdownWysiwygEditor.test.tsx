import { act } from "react";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@milkdown/react", () => ({
  Milkdown: () => null,
  MilkdownProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useEditor: () => ({ loading: false, get: () => null }),
}));

import { MarkdownWysiwygEditor } from "./MarkdownWysiwygEditor";

describe("MarkdownWysiwygEditor", () => {
  it("shows a recoverable error when Milkdown does not mount an editable surface", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    vi.stubGlobal("__MOYANG_DESKTOP_E2E__", false);

    try {
      act(() => {
        root.render(
          <MarkdownWysiwygEditor
            source="# Draft"
            documentKey="draft.md"
            ariaLabel="Markdown 所见即所得编辑器"
            onChange={vi.fn()}
            onInsertLink={vi.fn()}
          />,
        );
      });

      expect(container.querySelector('[role="alert"]')?.textContent).toContain("内容未被修改");
      expect(container.querySelector('[contenteditable="true"]')).toBeNull();
    } finally {
      act(() => root.unmount());
      vi.unstubAllGlobals();
      container.remove();
    }
  });
});
