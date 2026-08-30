import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PROGRESSIVE_READER_CHUNK_SIZE } from "../progressive-render";
import { ProgressiveReaderContent, type ProgressiveReaderContentHandle } from "./ProgressiveReaderContent";

function createLargeHtml(): string {
  const paragraph = "渐进渲染测试内容。".repeat(Math.ceil(PROGRESSIVE_READER_CHUNK_SIZE / 12));
  return Array.from(
    { length: 8 },
    (_, index) => `<h2 id="section-${index}">第 ${index + 1} 节</h2><p>${paragraph}</p>`,
  ).join("");
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("ProgressiveReaderContent", () => {
  it("mounts the first chunk before the rest and can finish on demand", () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const readerRef = createRef<ProgressiveReaderContentHandle>();
    const onReady = vi.fn();

    act(() => {
      root.render(<ProgressiveReaderContent ref={readerRef} html={createLargeHtml()} onReady={onReady} />);
    });

    const reader = container.querySelector<HTMLElement>('[data-progressive-reader="true"]');
    expect(reader?.dataset.progressiveReaderReady).toBe("false");
    expect(reader?.dataset.progressiveReaderMounted).toBe("1");
    expect(reader?.querySelectorAll(".progressive-reader-chunk")).toHaveLength(1);
    expect(onReady).not.toHaveBeenCalled();

    act(() => {
      readerRef.current?.revealAll();
    });

    expect(reader?.dataset.progressiveReaderReady).toBe("true");
    expect(reader?.querySelectorAll(".progressive-reader-chunk").length).toBeGreaterThan(1);
    expect(onReady).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    container.remove();
  });

  it("continues mounting one chunk per scheduled frame", () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<ProgressiveReaderContent html={createLargeHtml()} />);
    });

    const reader = container.querySelector<HTMLElement>('[data-progressive-reader="true"]');
    const initialCount = Number(reader?.dataset.progressiveReaderMounted);
    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(Number(reader?.dataset.progressiveReaderMounted)).toBe(initialCount + 1);
    expect(reader?.dataset.progressiveReaderReady).toBe("false");

    act(() => root.unmount());
    container.remove();
  });
});
