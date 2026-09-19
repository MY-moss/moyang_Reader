import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useReadingPositionController } from "./reading-position-controller";
import type { ReadingPosition } from "./storage";

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

type PositionHarnessProps = {
  loadPosition: (path: string) => ReadingPosition | null;
  savePosition: (path: string, top: number, anchor?: Record<string, unknown>) => void;
  path?: string;
};

function PositionHarness({ loadPosition, savePosition, path = "notes/example.md" }: PositionHarnessProps) {
  const contentAreaRef = useRef<HTMLElement | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const readingHeadingsRef = useRef<HTMLElement[]>([]);

  useReadingPositionController({
    articleRef,
    contentAreaRef,
    loadPosition,
    mode: "rendered",
    path,
    progressiveReaderReady: true,
    readingHeadingsRef,
    renderedHtml: '<h2 id="chapter">Chapter</h2>',
    savePosition,
  });

  return (
    <main ref={contentAreaRef}>
      <article
        ref={(node) => {
          articleRef.current = node;
          readingHeadingsRef.current = node ? Array.from(node.querySelectorAll<HTMLElement>("h1, h2, h3, h4")) : [];
        }}
      >
        <h2 id="chapter">Chapter</h2>
      </article>
    </main>
  );
}

function renderHarness(props: PositionHarnessProps) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<PositionHarness {...props} />);
  });
  return { container, root };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("reading position controller", () => {
  it("restores a stored heading anchor after the reading surface is ready", () => {
    vi.useFakeTimers();
    const loadPosition = vi.fn(() => ({
      path: "notes/example.md",
      top: 180,
      headingId: "chapter",
      relativeOffset: 40,
      progressRatio: 0.5,
    }));
    const savePosition = vi.fn();
    const { container, root } = renderHarness({ loadPosition, savePosition });
    const contentArea = container.querySelector("main")!;
    const heading = container.querySelector("h2")!;

    defineScrollMetrics(contentArea, { clientHeight: 500, scrollHeight: 3_000, scrollTop: 0 });
    vi.spyOn(contentArea, "getBoundingClientRect").mockReturnValue({ top: 100 } as DOMRect);
    vi.spyOn(heading, "getBoundingClientRect").mockReturnValue({ top: 340 } as DOMRect);

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(loadPosition).toHaveBeenCalledWith("notes/example.md");
    expect(contentArea.scrollTop).toBe(200);

    act(() => root.unmount());
  });

  it("debounces the latest heading anchor while the reader scrolls", () => {
    vi.useFakeTimers();
    const loadPosition = vi.fn(() => null);
    const savePosition = vi.fn();
    const { container, root } = renderHarness({ loadPosition, savePosition });
    const contentArea = container.querySelector("main")!;
    const heading = container.querySelector("h2")!;

    defineScrollMetrics(contentArea, { clientHeight: 500, scrollHeight: 2_500, scrollTop: 740 });
    vi.spyOn(contentArea, "getBoundingClientRect").mockReturnValue({ top: 100 } as DOMRect);
    vi.spyOn(heading, "getBoundingClientRect").mockReturnValue({ top: 164 } as DOMRect);

    act(() => {
      contentArea.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(179);
    });
    expect(savePosition).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(savePosition).toHaveBeenCalledWith("notes/example.md", 740, {
      headingId: "chapter",
      relativeOffset: 64,
      progressRatio: 0.37,
    });

    act(() => root.unmount());
  });

  it("flushes the latest position when the reader controller unmounts", () => {
    vi.useFakeTimers();
    const savePosition = vi.fn();
    const { container, root } = renderHarness({ loadPosition: () => null, savePosition });
    const contentArea = container.querySelector("main")!;
    defineScrollMetrics(contentArea, { clientHeight: 500, scrollHeight: 2_500, scrollTop: 320 });

    act(() => {
      contentArea.dispatchEvent(new Event("scroll"));
      root.unmount();
    });

    expect(savePosition).toHaveBeenCalledWith("notes/example.md", 320, expect.any(Object));
  });
});
