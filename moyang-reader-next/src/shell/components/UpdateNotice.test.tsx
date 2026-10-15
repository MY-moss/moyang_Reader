import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { UpdateNotice } from "./UpdateNotice";

function mountNotice(status: "available" | "downloading") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const props = {
    status,
    version: "0.9.0",
    notes: null,
    progress: status === "downloading" ? 0.42 : null,
    error: null,
    onInstall: vi.fn(),
    onRelaunch: vi.fn(),
    onHide: vi.fn(),
    onDismiss: vi.fn(),
  };
  act(() => {
    root.render(<UpdateNotice {...props} />);
  });
  return { container, root, props };
}

describe("UpdateNotice", () => {
  it("allows an active download to be hidden without dismissing it", () => {
    const { container, root, props } = mountNotice("downloading");
    const hideButton = container.querySelector<HTMLButtonElement>('[data-testid="update-hide"]');

    expect(hideButton?.textContent).toBe("隐藏");
    expect(container.textContent).not.toContain("稍后处理");
    act(() => hideButton?.click());
    expect(props.onHide).toHaveBeenCalledOnce();
    expect(props.onDismiss).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });

  it("keeps the normal dismiss action for an available update", () => {
    const { container, root, props } = mountNotice("available");
    const installButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("下载并安装"),
    );
    const dismissButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("稍后处理"),
    );

    expect(installButton).toBeTruthy();
    expect(dismissButton).toBeTruthy();
    expect(container.querySelector('[data-testid="update-hide"]')).toBeNull();
    act(() => dismissButton?.click());
    expect(props.onDismiss).toHaveBeenCalledOnce();
    expect(props.onHide).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });
});
