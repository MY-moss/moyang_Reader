import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { PaneResizeHandle } from "./PaneResizeHandle";

function mountHandle() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const onResizeBy = vi.fn();
  act(() => {
    root.render(
      <PaneResizeHandle side="context" value={320} min={260} max={440} onResizeBy={onResizeBy} onReset={vi.fn()} />,
    );
  });
  return { container, root, onResizeBy };
}

function dispatchPointerEvent(target: HTMLElement, type: string, clientX: number) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, {
    button: { value: 0 },
    clientX: { value: clientX },
    pointerId: { value: 1 },
  });
  void act(() => target.dispatchEvent(event));
}

describe("PaneResizeHandle", () => {
  it("exposes a vertical separator and keyboard resizing", () => {
    const { container, root, onResizeBy } = mountHandle();
    const handle = container.querySelector<HTMLElement>('[role="separator"]');

    expect(handle?.getAttribute("aria-valuenow")).toBe("320");
    expect(handle?.getAttribute("aria-valuemin")).toBe("260");
    expect(handle?.getAttribute("aria-valuemax")).toBe("440");

    act(() => {
      handle?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    });
    expect(onResizeBy).toHaveBeenCalledWith(16);

    act(() => {
      handle?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, shiftKey: true }));
    });
    expect(onResizeBy).toHaveBeenLastCalledWith(-48);

    act(() => root.unmount());
    container.remove();
  });

  it("keeps pointer dragging in the preview path and commits once at the end", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onResizeBy = vi.fn();
    const onResizePreview = vi.fn();
    const onResizeCommit = vi.fn();

    act(() => {
      root.render(
        <PaneResizeHandle
          side="sidebar"
          value={260}
          min={220}
          max={380}
          onResizeBy={onResizeBy}
          onResizePreview={onResizePreview}
          onResizeCommit={onResizeCommit}
          onReset={vi.fn()}
        />,
      );
    });

    const handle = container.querySelector<HTMLElement>('[role="separator"]');
    expect(handle).not.toBeNull();
    Object.defineProperty(handle, "setPointerCapture", { value: vi.fn() });

    dispatchPointerEvent(handle!, "pointerdown", 100);
    dispatchPointerEvent(handle!, "pointermove", 116);
    dispatchPointerEvent(handle!, "pointermove", 132);
    expect(onResizePreview).toHaveBeenNthCalledWith(1, 16);
    expect(onResizePreview).toHaveBeenNthCalledWith(2, 16);
    expect(onResizeBy).not.toHaveBeenCalled();
    expect(onResizeCommit).not.toHaveBeenCalled();

    dispatchPointerEvent(handle!, "pointerup", 132);
    expect(onResizeCommit).toHaveBeenCalledOnce();

    act(() => root.unmount());
    container.remove();
  });
});
