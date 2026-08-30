import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppNotification } from "../notification-queue";
import { NotificationViewport } from "./NotificationViewport";

afterEach(() => {
  vi.useRealTimers();
});

function mountViewport(notifications: readonly AppNotification[], updateNotice: ReactNode = null) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const onDismiss = vi.fn();
  act(() => {
    root.render(
      <NotificationViewport notifications={notifications} updateNotice={updateNotice} onDismiss={onDismiss} />,
    );
  });
  return { container, root, onDismiss };
}

const notifications: AppNotification[] = [
  { id: 1, level: "success", message: "第一条" },
  { id: 2, level: "info", message: "第二条" },
  { id: 3, level: "success", message: "第三条" },
  { id: 4, level: "success", message: "第四条" },
];

describe("NotificationViewport", () => {
  it("renders FIFO messages, supports independent dismissal, and reserves an update slot", () => {
    const { container, root, onDismiss } = mountViewport(
      notifications,
      <div data-testid="update-notice">更新提示</div>,
    );

    const viewport = container.querySelector(".notification-viewport");
    expect(viewport?.children).toHaveLength(3);
    expect(viewport?.textContent).toContain("更新提示");
    expect(viewport?.textContent).toContain("第一条");
    expect(viewport?.textContent).toContain("第二条");
    expect(viewport?.textContent).not.toContain("第三条");
    expect(container.querySelectorAll('[role="status"]').length).toBe(2);
    expect(container.querySelector('[role="status"]')?.getAttribute("aria-live")).toBe("polite");

    const dismissButton = container.querySelector<HTMLButtonElement>('button[aria-label^="关闭通知：第一条"]');
    act(() => dismissButton?.click());
    expect(onDismiss).toHaveBeenCalledWith(1);

    act(() => root.unmount());
    container.remove();
  });

  it("auto-dismisses visible info and success messages after six seconds", () => {
    vi.useFakeTimers();
    const { container, root, onDismiss } = mountViewport([notifications[0], notifications[1]]);

    act(() => {
      vi.advanceTimersByTime(5_999);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledTimes(2);
    expect(onDismiss).toHaveBeenNthCalledWith(1, 1);
    expect(onDismiss).toHaveBeenNthCalledWith(2, 2);

    act(() => root.unmount());
    container.remove();
  });

  it("keeps error and action messages until the user dismisses them", () => {
    const { container, root, onDismiss } = mountViewport([
      { id: 5, level: "error", message: "失败" },
      { id: 6, level: "action", message: "需要操作" },
    ]);

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("失败");
    expect(alert?.getAttribute("aria-live")).toBe("assertive");
    const action = container.querySelector('[data-notification-level="action"]');
    expect(action).toBeTruthy();
    expect(action?.getAttribute("role")).toBe("alert");
    expect(action?.getAttribute("aria-live")).toBe("assertive");
    expect(container.querySelector('button[aria-label^="关闭通知：失败"]')).toBeTruthy();
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });
});
