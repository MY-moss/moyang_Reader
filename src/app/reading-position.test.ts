import { describe, expect, it, vi } from "vitest";
import { captureReadingPosition, createReadingPositionTracker, resolveReadingPositionTop } from "./reading-position";

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

describe("createReadingPositionTracker", () => {
  it("flushes the last known position instead of reading a changed DOM value", () => {
    const write = vi.fn();
    const tracker = createReadingPositionTracker("notes/old.md", 120, write);

    tracker.update(640);
    tracker.flush();

    expect(write).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith("notes/old.md", 640);
  });

  it("flushes the latest stable anchor with the reading position", () => {
    const write = vi.fn();
    const tracker = createReadingPositionTracker("notes/example.md", 120, write);

    tracker.update(640, { headingId: "chapter-two", relativeOffset: -24, progressRatio: 0.42 });
    tracker.flush();

    expect(write).toHaveBeenCalledWith("notes/example.md", 640, {
      headingId: "chapter-two",
      relativeOffset: -24,
      progressRatio: 0.42,
    });
  });

  it("normalizes invalid and negative positions", () => {
    const write = vi.fn();
    const tracker = createReadingPositionTracker("notes/example.md", -20, write);

    expect(tracker.current()).toBe(0);
    tracker.update(Number.NaN);
    tracker.flush();

    expect(write).toHaveBeenCalledWith("notes/example.md", 0);
  });

  it("captures the active heading, its viewport offset, and a proportional fallback", () => {
    const contentArea = document.createElement("main");
    const first = document.createElement("h2");
    first.id = "first";
    const second = document.createElement("h2");
    second.id = "second";
    defineScrollMetrics(contentArea, { clientHeight: 500, scrollHeight: 2_500, scrollTop: 740 });
    vi.spyOn(contentArea, "getBoundingClientRect").mockReturnValue({ top: 100 } as DOMRect);
    vi.spyOn(first, "getBoundingClientRect").mockReturnValue({ top: -900 } as DOMRect);
    vi.spyOn(second, "getBoundingClientRect").mockReturnValue({ top: 164 } as DOMRect);

    expect(captureReadingPosition(contentArea, [first, second])).toEqual({
      top: 740,
      headingId: "second",
      relativeOffset: 64,
      progressRatio: 0.37,
    });
  });

  it("restores to the same heading offset before using proportional or absolute fallback", () => {
    const contentArea = document.createElement("main");
    defineScrollMetrics(contentArea, { clientHeight: 500, scrollHeight: 3_000, scrollTop: 0 });
    vi.spyOn(contentArea, "getBoundingClientRect").mockReturnValue({ top: 100 } as DOMRect);
    const heading = document.createElement("h2");
    vi.spyOn(heading, "getBoundingClientRect").mockReturnValue({ top: 420 } as DOMRect);

    expect(
      resolveReadingPositionTop(contentArea, heading, {
        top: 200,
        relativeOffset: 64,
        progressRatio: 0.5,
      }),
    ).toBe(256);
    expect(resolveReadingPositionTop(contentArea, null, { top: 200, progressRatio: 0.5 })).toBe(1_250);
    expect(resolveReadingPositionTop(contentArea, null, { top: 200 })).toBe(200);
  });
});
