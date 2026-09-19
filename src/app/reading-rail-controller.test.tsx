import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useReadingRailController } from "./reading-rail-controller";

function defineScrollMetrics(
  element: HTMLElement,
  values: { clientHeight: number; scrollHeight: number; scrollTop: number },
) {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: values.clientHeight },
    scrollHeight: { configurable: true, value: values.scrollHeight },
    scrollTop: { configurable: true, writable: true, value: values.scrollTop },
  });
}

class TestIntersectionObserver {
  static instances: TestIntersectionObserver[] = [];

  readonly callback: IntersectionObserverCallback;
  readonly root: Element | Document | null;
  readonly rootMargin: string;
  readonly thresholds: readonly number[];
  readonly observed = new Set<Element>();
  disconnected = false;

  constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
    this.callback = callback;
    this.root = options.root ?? null;
    this.rootMargin = options.rootMargin ?? "";
    this.thresholds = Array.isArray(options.threshold) ? options.threshold : [options.threshold ?? 0];
    TestIntersectionObserver.instances.push(this);
  }

  observe(element: Element) {
    this.observed.add(element);
  }

  unobserve(element: Element) {
    this.observed.delete(element);
  }

  disconnect() {
    this.disconnected = true;
    this.observed.clear();
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  emit(entries: Partial<IntersectionObserverEntry>[]) {
    this.callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }
}

type RailHarnessProps = {
  mode?: "rendered" | "source";
  useObserver?: boolean;
};

function RailHarness({ mode = "rendered", useObserver = false }: RailHarnessProps) {
  const contentAreaRef = useRef<HTMLElement | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const readingHeadingsRef = useRef<HTMLElement[]>([]);
  const { currentHeading, currentHeadingId, readingProgress } = useReadingRailController({
    articleRef,
    contentAreaRef,
    documentKind: "markdown",
    documentPath: "notes/example.md",
    mode,
    progressiveReaderReady: true,
    readingHeadingsRef,
    renderedHtml: useObserver ? "observer" : "fallback",
  });

  return (
    <>
      <main ref={contentAreaRef}>
        <article ref={articleRef}>
          <h2 id="first">First chapter</h2>
          <h2 id="second">Second chapter</h2>
        </article>
      </main>
      <output
        data-heading={currentHeading ?? ""}
        data-heading-id={currentHeadingId ?? ""}
        data-progress={String(readingProgress)}
      />
    </>
  );
}

function renderHarness(props: RailHarnessProps = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<RailHarness {...props} />);
  });
  return { container, root };
}

afterEach(() => {
  document.body.replaceChildren();
  TestIntersectionObserver.instances = [];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("reading rail controller", () => {
  it("tracks progress and the active heading with a cached heading list", () => {
    const animationFrames: FrameRequestCallback[] = [];
    vi.stubGlobal("IntersectionObserver", undefined);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    const { container, root } = renderHarness();
    const contentArea = container.querySelector("main")!;
    const [firstHeading, secondHeading] = Array.from(container.querySelectorAll("h2"));
    defineScrollMetrics(contentArea, { clientHeight: 500, scrollHeight: 2_500, scrollTop: 740 });
    vi.spyOn(contentArea, "getBoundingClientRect").mockReturnValue({ top: 100 } as DOMRect);
    vi.spyOn(firstHeading, "getBoundingClientRect").mockReturnValue({ top: -900 } as DOMRect);
    vi.spyOn(secondHeading, "getBoundingClientRect").mockReturnValue({ top: 164 } as DOMRect);

    act(() => {
      contentArea.dispatchEvent(new Event("scroll"));
      animationFrames.shift()?.(0);
    });

    const output = container.querySelector("output")!;
    expect(output.dataset.progress).toBe("0.37");
    expect(output.dataset.heading).toBe("Second chapter");
    expect(output.dataset.headingId).toBe("second");

    act(() => root.unmount());
  });

  it("updates the active heading from the IntersectionObserver candidate", () => {
    vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
    const { container, root } = renderHarness({ useObserver: true });
    const contentArea = container.querySelector("main")!;
    const secondHeading = container.querySelector<HTMLElement>("#second")!;
    defineScrollMetrics(contentArea, { clientHeight: 500, scrollHeight: 2_500, scrollTop: 740 });
    const observer = TestIntersectionObserver.instances[0];

    act(() => {
      observer.emit([{ target: secondHeading, isIntersecting: true }]);
    });

    const output = container.querySelector("output")!;
    expect(observer.observed.size).toBe(2);
    expect(output.dataset.heading).toBe("Second chapter");
    expect(output.dataset.headingId).toBe("second");

    act(() => root.unmount());
    expect(observer.disconnected).toBe(true);
  });

  it("resets the rail when the current surface is not a rendered readable document", () => {
    const { container, root } = renderHarness();
    const contentArea = container.querySelector("main")!;
    defineScrollMetrics(contentArea, { clientHeight: 500, scrollHeight: 2_500, scrollTop: 740 });
    const output = container.querySelector("output")!;

    act(() => {
      root.render(<RailHarness mode="source" />);
    });

    expect(output.dataset.progress).toBe("0");
    expect(output.dataset.heading).toBe("");
    expect(output.dataset.headingId).toBe("");

    act(() => root.unmount());
  });
});
