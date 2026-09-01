import { afterEach, describe, expect, it, vi } from "vitest";
import { createAnnotation } from "./annotations";
import { ANNOTATION_HIGHLIGHT_NAME, createAnnotationHighlightController } from "./annotation-highlighter";

class FakeHighlight {
  readonly ranges: Range[];

  constructor(...ranges: Range[]) {
    this.ranges = ranges;
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

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("annotation highlight controller", () => {
  it("locates an anchored quote across rendered markup with custom highlights", () => {
    const root = document.createElement("article");
    root.innerHTML = "<p>Read <strong>important</strong> now</p><p>Read important later</p>";
    document.body.appendChild(root);
    const registry = createRegistry();
    const controller = createAnnotationHighlightController(root, {
      css: { highlights: registry },
      Highlight: FakeHighlight,
    });
    const annotation = createAnnotation(
      "Today.md",
      { quote: "important", prefix: "Read", suffix: "now", start: 5, end: 14 },
      "remember",
      1,
      "a-1",
    );

    const locations = controller.update([annotation]);
    expect(controller.strategy).toBe("custom");
    expect(locations[0]?.status).toBe("located");
    expect(locations[0]?.ranges[0]?.toString()).toBe("important");
    expect(registry.values.get(ANNOTATION_HIGHLIGHT_NAME)?.ranges).toHaveLength(1);
    expect(root.querySelectorAll("mark.moyang-annotation-hit")).toHaveLength(0);

    const scroll = vi.fn();
    if (locations[0]?.scrollTarget) locations[0].scrollTarget.scrollIntoView = scroll;
    expect(controller.scrollTo("a-1")).toBe(true);
    expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });

    controller.update([
      createAnnotation("Today.md", { quote: "gone", prefix: "", suffix: "", start: 0, end: 4 }, "", 1, "a-2"),
    ]);
    expect(registry.values.get(ANNOTATION_HIGHLIGHT_NAME)?.ranges).toBeUndefined();
    expect(controller.scrollTo("a-2")).toBe(false);
    controller.dispose();
  });

  it("falls back to DOM marks and reports stale anchors without dropping them", () => {
    const root = document.createElement("article");
    root.innerHTML = "<p>alpha beta</p>";
    document.body.appendChild(root);
    const controller = createAnnotationHighlightController(root);
    const annotation = createAnnotation(
      "Today.md",
      { quote: "beta", prefix: "alpha", suffix: "", start: 6, end: 10 },
      "",
      1,
      "a-1",
    );

    expect(controller.update([annotation])[0]?.status).toBe("located");
    expect(root.querySelectorAll("mark.moyang-annotation-hit")).toHaveLength(1);
    expect(root.textContent).toBe("alpha beta");

    const changedContext = createAnnotation(
      "Today.md",
      { quote: "beta", prefix: "different", suffix: "", start: 6, end: 10 },
      "",
      1,
      "a-context",
    );
    expect(controller.update([changedContext])[0]?.status).toBe("stale");

    const stale = createAnnotation(
      "Today.md",
      { quote: "missing", prefix: "", suffix: "", start: 0, end: 7 },
      "",
      1,
      "a-2",
    );
    expect(controller.update([stale])[0]?.status).toBe("stale");
    expect(root.querySelectorAll("mark.moyang-annotation-hit")).toHaveLength(0);
    controller.dispose();
  });
});
