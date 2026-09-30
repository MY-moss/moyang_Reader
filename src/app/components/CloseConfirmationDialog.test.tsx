import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { CloseConfirmationDialog } from "./CloseConfirmationDialog";

function mountDialog(onCancel: () => void, onConfirm: () => void, onSaveAndClose: () => void) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<CloseConfirmationDialog onCancel={onCancel} onConfirm={onConfirm} onSaveAndClose={onSaveAndClose} />);
  });
  return {
    container,
    root,
  };
}

describe("CloseConfirmationDialog", () => {
  it("calls cancel on Escape and restores focus when it unmounts", () => {
    const previousFocus = document.createElement("button");
    document.body.appendChild(previousFocus);
    previousFocus.focus();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const onSaveAndClose = vi.fn();
    const { container, root } = mountDialog(onCancel, onConfirm, onSaveAndClose);

    const cancelButton = container.querySelector<HTMLButtonElement>('[data-testid="close-confirm-cancel"]');
    expect(document.activeElement).toBe(cancelButton);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onCancel).toHaveBeenCalledOnce();

    act(() => root.unmount());
    expect(document.activeElement).toBe(previousFocus);
    container.remove();
    previousFocus.remove();
  });

  it("calls confirm from the explicit exit action", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const onSaveAndClose = vi.fn();
    const { container, root } = mountDialog(onCancel, onConfirm, onSaveAndClose);

    const confirmButton = container.querySelector<HTMLButtonElement>('[data-testid="close-confirm-confirm"]');
    expect(confirmButton?.textContent).toBe("退出 Moyang Reader");
    act(() => confirmButton?.click());
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });

  it("explains that the draft was retained and offers save and close", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const onSaveAndClose = vi.fn();
    const { container, root } = mountDialog(onCancel, onConfirm, onSaveAndClose);

    expect(container.textContent).toContain("草稿副本");
    expect(container.textContent).toContain("直接退出不会写回原文件");
    expect(container.textContent).toContain("保存失败时不会退出");
    expect(container.querySelectorAll(".safety-confirm-facts > div")).toHaveLength(3);
    const saveButton = container.querySelector<HTMLButtonElement>('[data-testid="close-confirm-save"]');
    expect(saveButton?.textContent).toBe("保存并退出");
    act(() => saveButton?.click());
    expect(onSaveAndClose).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });

  it("keeps the three sources and consequences readable in English", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <CloseConfirmationDialog
          locale="en-US"
          fileName="chapter.md"
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          onSaveAndClose={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("chapter.md");
    expect(container.textContent).toContain("Unsaved edits");
    expect(container.textContent).toContain("Local draft");
    expect(container.textContent).toContain("a failed save will not close the app");
    expect(container.querySelector('[role="dialog"]')?.getAttribute("aria-describedby")).toBe(
      "close-confirm-description close-confirm-note",
    );

    act(() => root.unmount());
    container.remove();
  });
});
