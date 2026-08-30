import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { ExternalOverwriteDialog } from "./ExternalOverwriteDialog";

describe("ExternalOverwriteDialog", () => {
  it("focuses cancel and supports Escape cancellation", () => {
    const previousFocus = document.createElement("button");
    document.body.appendChild(previousFocus);
    previousFocus.focus();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<ExternalOverwriteDialog onCancel={onCancel} onConfirm={onConfirm} />);
    });

    expect(document.activeElement).toBe(container.querySelector('[data-testid="external-overwrite-cancel"]'));
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onCancel).toHaveBeenCalledOnce();

    act(() => root.unmount());
    expect(document.activeElement).toBe(previousFocus);
    container.remove();
    previousFocus.remove();
  });

  it("calls the explicit overwrite action", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<ExternalOverwriteDialog onCancel={onCancel} onConfirm={onConfirm} />);
    });
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="external-overwrite-confirm"]')?.click());
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });
});
