import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { useModalBehavior } from "./useModalBehavior";

function TestModal({ onClose }: { onClose: () => void }) {
  const containerRef = useRef<HTMLElement>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  useModalBehavior({ containerRef, initialFocusRef, onClose });

  return (
    <section ref={containerRef} role="dialog" tabIndex={-1}>
      <button ref={initialFocusRef} type="button">
        first
      </button>
      <button type="button">last</button>
    </section>
  );
}

describe("useModalBehavior", () => {
  it("focuses the first control, traps Tab, closes on Escape, and restores focus", () => {
    const previousFocus = document.createElement("button");
    document.body.appendChild(previousFocus);
    previousFocus.focus();
    const onClose = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => root.render(<TestModal onClose={onClose} />));
    const [first, last] = Array.from(container.querySelectorAll<HTMLButtonElement>("button"));
    expect(document.activeElement).toBe(first);

    last.focus();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", cancelable: true }));
    });
    expect(document.activeElement).toBe(first);

    first.focus();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(last);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }));
    });
    expect(onClose).toHaveBeenCalledOnce();

    act(() => root.unmount());
    expect(document.activeElement).toBe(previousFocus);
    container.remove();
    previousFocus.remove();
  });
});
