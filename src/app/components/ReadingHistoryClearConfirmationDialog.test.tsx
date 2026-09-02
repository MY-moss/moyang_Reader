import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { ReadingHistoryClearConfirmationDialog } from "./ReadingHistoryClearConfirmationDialog";

describe("ReadingHistoryClearConfirmationDialog", () => {
  it("explains the local-only destructive action and exposes both choices", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    act(() => {
      root.render(<ReadingHistoryClearConfirmationDialog onCancel={onCancel} onConfirm={onConfirm} />);
    });

    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("原文档、最近打开、阅读位置和草稿");
    expect(container.querySelector('[data-testid="reading-history-clear-cancel"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="reading-history-clear-confirm"]')).toBeTruthy();

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="reading-history-clear-confirm"]')?.click();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    container.remove();
  });
});
