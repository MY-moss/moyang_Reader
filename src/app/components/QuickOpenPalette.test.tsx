import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { QuickOpenCandidate } from "../quick-open";
import { QuickOpenPalette } from "./QuickOpenPalette";

const items: QuickOpenCandidate[] = [
  { path: "notes/alpha.md", name: "alpha.md", relativePath: "notes/alpha.md", kind: "markdown" },
  { path: "notes/beta.md", name: "beta.md", relativePath: "notes/beta.md", kind: "markdown" },
  { path: "notes/gamma.md", name: "gamma.md", relativePath: "notes/gamma.md", kind: "markdown" },
];

function renderPalette(): { container: HTMLDivElement; root: ReturnType<typeof createRoot> } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<QuickOpenPalette items={items} onClose={vi.fn()} onOpenFile={vi.fn()} />);
  });
  return { container, root };
}

function cleanup(container: HTMLDivElement, root: ReturnType<typeof createRoot>): void {
  act(() => root.unmount());
  container.remove();
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("QuickOpenPalette", () => {
  it("tracks the highlighted result with aria-activedescendant", () => {
    const { container, root } = renderPalette();
    const input = container.querySelector<HTMLInputElement>('input[type="search"]');

    expect(input?.getAttribute("aria-controls")).toBe("quick-open-results");
    expect(input?.getAttribute("aria-activedescendant")).toBe("quick-open-option-0");
    expect(container.querySelector("#quick-open-option-0")?.getAttribute("aria-selected")).toBe("true");

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    });

    expect(input?.getAttribute("aria-activedescendant")).toBe("quick-open-option-1");
    expect(container.querySelector("#quick-open-option-1")?.getAttribute("aria-selected")).toBe("true");
    cleanup(container, root);
  });

  it("scrolls the highlighted result into view", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    const { container, root } = renderPalette();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });

    scrollIntoView.mockClear();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    });

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    cleanup(container, root);

    if (originalDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalDescriptor);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }
  });
});
