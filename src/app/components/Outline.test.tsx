import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { TocItem } from "../types";
import { Outline } from "./Outline";

const items: TocItem[] = [
  { id: "intro", depth: 1, text: "简介" },
  { id: "setup", depth: 2, text: "安装" },
  { id: "usage", depth: 2, text: "使用" },
  { id: "appendix", depth: 1, text: "附录" },
];

function mountOutline(activeId: string | null = "setup") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const onNavigate = vi.fn();

  act(() => {
    root.render(<Outline items={items} activeId={activeId} onNavigate={onNavigate} />);
  });

  return { container, root, onNavigate };
}

function cleanup(container: HTMLElement, root: ReturnType<typeof createRoot>) {
  act(() => root.unmount());
  container.remove();
}

describe("Outline", () => {
  it("exposes a hierarchical outline with one tab stop at the current heading", () => {
    const { container, root } = mountOutline();
    const tree = container.querySelector('[role="tree"]');
    const links = container.querySelectorAll<HTMLAnchorElement>('[role="treeitem"]');

    expect(tree?.getAttribute("aria-label")).toBe("文档目录");
    expect(tree?.getAttribute("aria-orientation")).toBe("vertical");
    expect(Array.from(links).map((link) => link.tabIndex)).toEqual([-1, 0, -1, -1]);
    expect(Array.from(links).map((link) => link.getAttribute("aria-level"))).toEqual(["1", "2", "2", "1"]);
    expect(Array.from(links).map((link) => link.getAttribute("aria-selected"))).toEqual([
      "false",
      "true",
      "false",
      "false",
    ]);
    expect(links[1]?.classList.contains("active")).toBe(true);
    cleanup(container, root);
  });

  it("moves focus and navigation with vertical arrows and Home/End", async () => {
    const { container, root, onNavigate } = mountOutline();
    const links = container.querySelectorAll<HTMLAnchorElement>('[role="treeitem"]');
    links[1]?.focus();

    await act(async () => {
      links[1]?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    });
    expect(onNavigate).toHaveBeenCalledWith(items[2]);
    expect(document.activeElement).toBe(links[2]);
    expect(Array.from(links).map((link) => link.tabIndex)).toEqual([-1, -1, 0, -1]);

    await act(async () => {
      links[2]?.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
    });
    expect(onNavigate).toHaveBeenLastCalledWith(items[3]);
    expect(document.activeElement).toBe(links[3]);

    await act(async () => {
      links[3]?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }));
    });
    expect(onNavigate).toHaveBeenLastCalledWith(items[0]);
    expect(document.activeElement).toBe(links[0]);
    cleanup(container, root);
  });

  it("keeps modified arrow shortcuts available and bounds movement", async () => {
    const { container, root, onNavigate } = mountOutline();
    const links = container.querySelectorAll<HTMLAnchorElement>('[role="treeitem"]');
    links[0]?.focus();

    const modified = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      links[0]?.dispatchEvent(modified);
    });
    expect(modified.defaultPrevented).toBe(false);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(links[0]);

    const bounded = new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true });
    await act(async () => {
      links[0]?.dispatchEvent(bounded);
    });
    expect(bounded.defaultPrevented).toBe(true);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(links[0]);
    cleanup(container, root);
  });

  it("follows an externally changed current heading without stealing focus", async () => {
    const { container, root } = mountOutline(null);
    const initialLinks = container.querySelectorAll<HTMLAnchorElement>('[role="treeitem"]');
    expect(Array.from(initialLinks).map((link) => link.tabIndex)).toEqual([0, -1, -1, -1]);

    act(() => {
      root.render(<Outline items={items} activeId="usage" onNavigate={vi.fn()} />);
    });
    const links = container.querySelectorAll<HTMLAnchorElement>('[role="treeitem"]');
    expect(Array.from(links).map((link) => link.tabIndex)).toEqual([-1, -1, 0, -1]);
    expect(links[2]?.classList.contains("active")).toBe(true);
    expect(links[2]?.getAttribute("aria-current")).toBe("location");
    cleanup(container, root);
  });

  it("navigates on click while preserving the application-owned scroll behavior", () => {
    const { container, root, onNavigate } = mountOutline();
    const links = container.querySelectorAll<HTMLAnchorElement>('[role="treeitem"]');

    act(() => links[0]?.click());

    expect(onNavigate).toHaveBeenCalledWith(items[0]);
    expect(window.location.hash).toBe("");
    cleanup(container, root);
  });
});
