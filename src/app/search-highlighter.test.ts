import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_SEARCH_HIGHLIGHT_NAME,
  createSearchHighlightController,
  SEARCH_HIGHLIGHT_NAME,
} from "./search-highlighter";

class FakeHighlight {
  readonly ranges: Range[];

  constructor(...ranges: Range[]) {
    this.ranges = ranges;
  }

  get size(): number {
    return this.ranges.length;
  }
}

function createRegistry() {
  const values = new Map<string, FakeHighlight>();
  return {
    values,
    set(name: string, highlight: unknown) {
      values.set(name, highlight as FakeHighlight);
    },
    delete(name: string) {
      return values.delete(name);
    },
  };
}

function createRoot(): HTMLElement {
  const root = document.createElement("article");
  root.innerHTML =
    '<p>Needle one</p><p>needle two</p><p>third needle</p><p aria-hidden="true">needle hidden</p><p>other</p>';
  document.body.appendChild(root);
  return root;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("search highlight controller", () => {
  it("uses custom ranges without inserting marks and reuses text nodes", () => {
    const root = createRoot();
    const registry = createRegistry();
    const walkerSpy = vi.spyOn(root.ownerDocument, "createTreeWalker");
    const controller = createSearchHighlightController(root, {
      css: { highlights: registry },
      Highlight: FakeHighlight,
    });

    expect(controller.strategy).toBe("custom");
    expect(controller.update("needle")).toBe(3);
    expect(root.querySelectorAll("mark.moyang-search-hit")).toHaveLength(0);
    expect(registry.values.get(SEARCH_HIGHLIGHT_NAME)?.size).toBe(3);

    expect(controller.update("other")).toBe(1);
    expect(walkerSpy).toHaveBeenCalledTimes(1);
    expect(registry.values.get(SEARCH_HIGHLIGHT_NAME)?.ranges[0].toString()).toBe("other");

    const target = controller.setActive(0);
    expect(registry.values.get(ACTIVE_SEARCH_HIGHLIGHT_NAME)?.size).toBe(1);
    expect(target?.textContent).toContain("other");

    controller.dispose();
    expect(registry.values.size).toBe(0);
  });

  it("falls back to marks and removes only its previous marks", () => {
    const root = createRoot();
    const controller = createSearchHighlightController(root);

    expect(controller.strategy).toBe("dom");
    expect(controller.update("needle")).toBe(3);
    expect(root.querySelectorAll("mark.moyang-search-hit")).toHaveLength(3);

    controller.setActive(1);
    expect(root.querySelectorAll("mark.moyang-search-hit.active")).toHaveLength(1);

    expect(controller.update("other")).toBe(1);
    expect(root.querySelectorAll("mark.moyang-search-hit")).toHaveLength(1);
    expect(root.textContent).toContain("needle hidden");

    controller.clear();
    expect(root.querySelectorAll("mark.moyang-search-hit")).toHaveLength(0);
  });
});
