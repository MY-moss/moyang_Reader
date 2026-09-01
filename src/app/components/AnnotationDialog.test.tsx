import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { AnnotationDialog } from "./AnnotationDialog";

describe("AnnotationDialog", () => {
  it("previews the quote and saves the trimmed note", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onSave = vi.fn();
    const onCancel = vi.fn();

    act(() => {
      root.render(<AnnotationDialog quote="选中的内容" onCancel={onCancel} onSave={onSave} />);
    });
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("选中的内容");

    act(() => {
      const textarea = container.querySelector<HTMLTextAreaElement>("textarea");
      if (textarea) {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
        setter?.call(textarea, "  我的备注  ");
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
      container.querySelector<HTMLElement>("button:not(.panel-close-button) + button")?.click();
    });
    expect(onSave).toHaveBeenCalledWith("我的备注");

    act(() => {
      container.querySelector<HTMLElement>(".panel-close-button")?.click();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    container.remove();
  });
});
