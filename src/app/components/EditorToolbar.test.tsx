import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { EditorToolbar } from "./EditorToolbar";

describe("EditorToolbar", () => {
  it("uses accessible icon controls for undo and redo", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<EditorToolbar canUndo canRedo onAction={vi.fn()} onInsert={vi.fn()} />);
    });

    for (const [label, iconName] of [
      ["撤销", "undo"],
      ["重做", "redo"],
    ] as const) {
      const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
      expect(button).toBeTruthy();
      expect(button?.textContent).toBe("");
      expect(button?.querySelector(`svg[data-icon="${iconName}"]`)).toBeTruthy();
    }

    act(() => root.unmount());
    container.remove();
  });
});
