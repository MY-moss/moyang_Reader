import { act, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAnnotation, type TextAnnotation } from "./annotations";
import { useAnnotationController } from "./annotation-controller";

const currentAnnotation = createAnnotation(
  "Today.md",
  { quote: "beta", prefix: "alpha", suffix: "", start: 6, end: 10 },
  "current",
  1,
  "a-current",
);
const otherAnnotation = createAnnotation(
  "Other.md",
  { quote: "alpha", prefix: "", suffix: "", start: 0, end: 5 },
  "other",
  1,
  "a-other",
);

type AnnotationHarnessProps = {
  mode?: "rendered" | "source";
  annotations?: TextAnnotation[];
};

function AnnotationHarness({
  mode = "rendered",
  annotations: initialAnnotations = [currentAnnotation, otherAnnotation],
}: AnnotationHarnessProps) {
  const readerBodyRef = useRef<HTMLElement | null>(null);
  const [annotations, setAnnotations] = useState(initialAnnotations);
  const { annotationLocations, queueAnnotationFocus, scrollAnnotation } = useAnnotationController({
    readerBodyRef,
    documentPath: "C:\\workspace\\Today.md",
    workspacePath: "C:\\workspace",
    mode,
    progressiveReaderReady: true,
    annotationEnabled: true,
    renderedHtml: "article-v1",
    annotations,
  });

  return (
    <div>
      <article ref={readerBodyRef}>alpha beta</article>
      <button type="button" data-queue onClick={() => queueAnnotationFocus("a-current")}>
        定位批注
      </button>
      <button type="button" data-scroll onClick={() => setScrollResult(String(scrollAnnotation("a-current")))}>
        滚动批注
      </button>
      <button type="button" data-rerender onClick={() => setAnnotations((current) => [...current])}>
        重新定位
      </button>
      <output
        data-count={String(annotationLocations.length)}
        data-ids={annotationLocations.map((location) => location.annotation.id).join(",")}
        data-status={annotationLocations[0]?.status ?? ""}
      />
    </div>
  );
}

let scrollResult = "";

function setScrollResult(value: string) {
  scrollResult = value;
}

function renderHarness(props: AnnotationHarnessProps = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<AnnotationHarness {...props} />);
  });
  return { container, root };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  scrollResult = "";
});

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe("annotation controller", () => {
  it("filters annotations for the current document and reports located positions", () => {
    const { container, root } = renderHarness();
    const output = container.querySelector("output")!;

    expect(output.dataset.count).toBe("1");
    expect(output.dataset.ids).toBe("a-current");
    expect(output.dataset.status).toBe("located");
    expect(container.querySelectorAll("mark.moyang-annotation-hit")).toHaveLength(1);

    act(() => root.unmount());
  });

  it("queues a focus target, scrolls it, and clears the pending target after success", () => {
    const { container, root } = renderHarness();

    act(() => container.querySelector<HTMLButtonElement>("[data-queue]")?.click());
    act(() => container.querySelector<HTMLButtonElement>("[data-scroll]")?.click());

    expect(scrollResult).toBe("true");
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });

    act(() => root.unmount());
  });

  it("disposes highlights when the current surface is no longer readable", () => {
    const { container, root } = renderHarness();
    expect(container.querySelectorAll("mark.moyang-annotation-hit")).toHaveLength(1);

    act(() => {
      root.render(<AnnotationHarness mode="source" />);
    });

    expect(container.querySelector("output")?.dataset.count).toBe("0");
    expect(container.querySelectorAll("mark.moyang-annotation-hit")).toHaveLength(0);

    act(() => root.unmount());
  });

  it("applies a queued target after the annotation locations are refreshed", () => {
    const { container, root } = renderHarness();

    act(() => container.querySelector<HTMLButtonElement>("[data-queue]")?.click());
    act(() => container.querySelector<HTMLButtonElement>("[data-rerender]")?.click());

    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });

    act(() => root.unmount());
  });
});
