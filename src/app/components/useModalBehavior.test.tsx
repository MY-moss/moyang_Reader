import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { useModalBehavior } from "./useModalBehavior";

function TestModal({ onClose }: { onClose: () => void }) {
  const containerRef = useRef<HTMLElement>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  useModalBehavior({ containerRef, initialFocusRef, onClose });

  return (
    <section ref={containerRef} role="dialog" aria-modal="true" tabIndex={-1}>
      <button ref={initialFocusRef} type="button">
        first
      </button>
      <button type="button">last</button>
    </section>
  );
}

function NestedTestModals({ lowerOnClose, upperOnClose }: { lowerOnClose: () => void; upperOnClose: () => void }) {
  return (
    <>
      <TestModal onClose={lowerOnClose} />
      <TestModal onClose={upperOnClose} />
    </>
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

  it("lets only the modal that owns focus handle Escape when modals overlap", () => {
    const lowerOnClose = vi.fn();
    const upperOnClose = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => root.render(<NestedTestModals lowerOnClose={lowerOnClose} upperOnClose={upperOnClose} />));
    const buttons = container.querySelectorAll<HTMLButtonElement>("button");
    buttons[2]?.focus();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }));
    });

    expect(lowerOnClose).not.toHaveBeenCalled();
    expect(upperOnClose).toHaveBeenCalledOnce();

    act(() => root.unmount());
    container.remove();
  });

  it("prevents later global Escape listeners after the focused modal closes", () => {
    const onClose = vi.fn();
    const globalShortcut = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => root.render(<TestModal onClose={onClose} />));
    const first = container.querySelector<HTMLButtonElement>("button");
    window.addEventListener("keydown", globalShortcut, true);

    act(() => {
      first?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });

    expect(onClose).toHaveBeenCalledOnce();
    expect(globalShortcut).not.toHaveBeenCalled();

    window.removeEventListener("keydown", globalShortcut, true);
    act(() => root.unmount());
    container.remove();
  });

  it("ignores Escape after the modal node detaches", () => {
    const onClose = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => root.render(<TestModal onClose={onClose} />));
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    if (dialog) Object.defineProperty(dialog, "isConnected", { configurable: true, value: false });

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }));
    });

    expect(onClose).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });

  it("keeps Tab navigation inside the modal that owns focus when modals overlap", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => root.render(<NestedTestModals lowerOnClose={vi.fn()} upperOnClose={vi.fn()} />));
    const buttons = container.querySelectorAll<HTMLButtonElement>("button");
    buttons[2]?.focus();
    expect(document.activeElement).toBe(buttons[2]);
    expect(buttons[2]?.closest('[aria-modal="true"]')).toBe(buttons[2]?.parentElement);
    act(() => {
      const event = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
      document.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    });

    expect(document.activeElement).toBe(buttons[2]);

    act(() => root.unmount());
    container.remove();
  });
});
