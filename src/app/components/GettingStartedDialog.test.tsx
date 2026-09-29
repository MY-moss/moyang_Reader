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

    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("从本地文档开始");
    expect(container.textContent).toContain("添加阅读库");
    expect(container.textContent).toContain("设置保存到本机");
    expect(container.querySelectorAll(".getting-started-step")).toHaveLength(5);
    expect(container.querySelector(".getting-started-footer .primary")?.textContent).toBe("打开文档");

    act(() => {
      const done = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "知道了");
      done?.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    container.remove();
  });

  it("offers the same actions in English", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <GettingStartedDialog locale="en-US" onClose={() => {}} onOpenDocument={() => {}} onAddWorkspace={() => {}} />,
      );
    });
    expect(container.textContent).toContain("Start with your local documents");
    expect(container.querySelector(".getting-started-footer .primary")?.textContent).toBe("Open a document");
    act(() => root.unmount());
    container.remove();
  });
});
