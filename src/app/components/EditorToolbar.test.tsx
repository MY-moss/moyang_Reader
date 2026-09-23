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

  it("keeps the same actions available with English labels", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onAction = vi.fn();
    const onInsert = vi.fn();
    act(() => root.render(<EditorToolbar locale="en-US" canUndo canRedo onAction={onAction} onInsert={onInsert} />));

    expect(container.querySelector('[role="toolbar"]')?.getAttribute("aria-label")).toBe("Editor toolbar");
    const bold = container.querySelector<HTMLButtonElement>('button[aria-label="Bold"]');
    const insert = container.querySelector<HTMLButtonElement>('button[aria-label="Insert"]');
    expect(bold).toBeTruthy();
    expect(insert).toBeTruthy();
    act(() => {
      bold?.click();
      insert?.click();
    });
    expect(onAction).toHaveBeenCalledWith("bold");
    expect(onInsert).toHaveBeenCalledWith("link");
    act(() => root.unmount());
    container.remove();
  });
});
