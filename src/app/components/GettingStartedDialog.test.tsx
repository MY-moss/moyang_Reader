import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { GettingStartedDialog } from "./GettingStartedDialog";

describe("GettingStartedDialog", () => {
  it("shows the first-use path and exposes the main actions", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onClose = vi.fn();

    act(() => {
      root.render(
        <GettingStartedDialog locale="zh-CN" onClose={onClose} onOpenDocument={() => {}} onAddWorkspace={() => {}} />,
      );
    });

    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("快速上手 Moyang Reader");
    expect(container.textContent).toContain("添加阅读库");
    expect(container.textContent).toContain("设置保存到本机");

    act(() => {
      const done = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "知道了");
      done?.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    container.remove();
  });
});
