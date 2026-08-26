import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { DraftDiscardConfirmationDialog } from "./DraftDiscardConfirmationDialog";

function mountDialog(onCancel: () => void, onConfirm: () => void) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <DraftDiscardConfirmationDialog path="C:/Notes/recovery-note.md" onCancel={onCancel} onConfirm={onConfirm} />,
    );
  });
  return { container, root };
}

describe("DraftDiscardConfirmationDialog", () => {
  it("focuses cancel, closes on Escape, and restores focus", () => {
    const previousFocus = document.createElement("button");
    document.body.appendChild(previousFocus);
    previousFocus.focus();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { container, root } = mountDialog(onCancel, onConfirm);

    const cancelButton = container.querySelector<HTMLButtonElement>('[data-testid="draft-discard-cancel"]');
    expect(document.activeElement).toBe(cancelButton);
    expect(container.textContent).toContain("recovery-note.md");

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onCancel).toHaveBeenCalledOnce();

    act(() => root.unmount());
    expect(document.activeElement).toBe(previousFocus);
    container.remove();
    previousFocus.remove();
  });

  it("only discards after the explicit confirmation action", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { container, root } = mountDialog(onCancel, onConfirm);

    expect(onConfirm).not.toHaveBeenCalled();
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="draft-discard-confirm"]')?.click());
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });
});
