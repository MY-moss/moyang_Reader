import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { createAnnotation } from "../annotations";
import { AnnotationsPanel } from "./AnnotationsPanel";

describe("AnnotationsPanel", () => {
  it("shows quote, note, current status and actions", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const annotation = createAnnotation(
      "Notes/Today.md",
      { quote: "重要内容", prefix: "", suffix: "", start: 0, end: 4 },
      "稍后整理",
      1,
      "a-1",
    );
    const onOpen = vi.fn();
    const onDelete = vi.fn();

    act(() => {
      root.render(
        <AnnotationsPanel
          annotations={[annotation]}
          locations={[
            {
              annotation,
              status: "located",
              start: 0,
              end: 4,
              ranges: [],
              scrollTarget: null,
            },
          ]}
          currentPath="notes/today.md"
          enabled
          onOpen={onOpen}
          onDelete={onDelete}
        />,
      );
    });

    expect(container.querySelector(".annotation-item.current")).not.toBeNull();
    expect(container.textContent).toContain("重要内容");
    expect(container.textContent).toContain("稍后整理");
    expect(container.textContent).toContain("当前文档");

    act(() => {
      container.querySelector<HTMLElement>('[aria-label^="打开批注"]')?.click();
      container.querySelector<HTMLElement>('[aria-label^="删除批注"]')?.click();
    });
    expect(onOpen).toHaveBeenCalledWith(annotation);
    expect(onDelete).toHaveBeenCalledWith(annotation);

    act(() => root.unmount());
    container.remove();
  });

  it("explains disabled annotations", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <AnnotationsPanel annotations={[]} locations={[]} enabled={false} onOpen={vi.fn()} onDelete={vi.fn()} />,
      );
    });
    expect(container.textContent).toContain("阅读批注已关闭");
    act(() => root.unmount());
    container.remove();
  });
});
