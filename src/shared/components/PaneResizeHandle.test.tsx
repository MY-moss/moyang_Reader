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

describe("PaneResizeHandle", () => {
  it("exposes a vertical separator and keyboard resizing", () => {
    const { container, root, onResizeBy } = mountHandle();
    const handle = container.querySelector<HTMLElement>('[role="separator"]');

    expect(handle?.getAttribute("aria-valuenow")).toBe("320");
    expect(handle?.getAttribute("aria-valuemin")).toBe("260");
    expect(handle?.getAttribute("aria-valuemax")).toBe("440");

    act(() => handle?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })));
    expect(onResizeBy).toHaveBeenCalledWith(16);

    act(() =>
      handle?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, shiftKey: true })),
    );
    expect(onResizeBy).toHaveBeenLastCalledWith(-48);

    act(() => root.unmount());
    container.remove();
  });
});
