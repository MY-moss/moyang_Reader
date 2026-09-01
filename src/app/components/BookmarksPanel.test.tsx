import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { createBookmark } from "../bookmarks";
import { BookmarksPanel } from "./BookmarksPanel";

describe("BookmarksPanel", () => {
  it("lists locations, marks the current one and exposes open/delete actions", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const first = createBookmark("C:/Vault/Today.md", { headingId: "morning", createdAt: 1 });
    const second = createBookmark("C:/Vault/Plan.md", { createdAt: 2 });
    const onOpen = vi.fn();
    const onDelete = vi.fn();

    act(() => {
      root.render(
        <BookmarksPanel
          bookmarks={[first, second]}
          knownPaths={["C:/Vault/Today.md", "C:/Vault/Plan.md"]}
          currentPath="c:\\vault\\TODAY.md"
          currentHeadingId="morning"
          onOpen={onOpen}
          onDelete={onDelete}
        />,
      );
    });

    expect(container.querySelectorAll(".bookmark-item")).toHaveLength(2);
    expect(container.querySelector(".bookmark-item.current")).not.toBeNull();
    expect(container.querySelector('[aria-label="打开书签：Today.md · #morning"]')).not.toBeNull();

    act(() => {
      container.querySelector<HTMLElement>('[aria-label="打开书签：Today.md · #morning"]')?.click();
      container.querySelector<HTMLElement>('[aria-label="删除书签：Plan.md · 文档开头"]')?.click();
    });

    expect(onOpen).toHaveBeenCalledWith(first);
    expect(onDelete).toHaveBeenCalledWith(second);

    act(() => root.unmount());
    container.remove();
  });

  it("explains how to add a bookmark when the list is empty", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<BookmarksPanel bookmarks={[]} onOpen={vi.fn()} onDelete={vi.fn()} />);
    });

    expect(container.textContent).toContain("在正文中右键");

    act(() => root.unmount());
    container.remove();
  });

  it("shows a clear status for a location not found in the current library", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const missing = createBookmark("C:/Vault/moved.md", { createdAt: 1 });

    act(() => {
      root.render(<BookmarksPanel bookmarks={[missing]} knownPaths={[]} onOpen={vi.fn()} onDelete={vi.fn()} />);
    });

    expect(container.textContent).toContain("可能已移动或删除");

    act(() => root.unmount());
    container.remove();
  });
});
