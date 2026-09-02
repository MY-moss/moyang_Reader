import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { ReadingHistoryPanel } from "./ReadingHistoryPanel";

function localDayKey(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function renderPanel(entries: Parameters<typeof ReadingHistoryPanel>[0]["entries"]) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const onRequestClear = vi.fn();

  act(() => {
    root.render(<ReadingHistoryPanel entries={entries} onRequestClear={onRequestClear} />);
  });

  return { container, root, onRequestClear };
}

function cleanup(container: HTMLElement, root: ReturnType<typeof createRoot>) {
  act(() => root.unmount());
  container.remove();
}

describe("ReadingHistoryPanel", () => {
  it("shows an empty local state and keeps clearing disabled", () => {
    const { container, root } = renderPanel([]);

    expect(container.querySelector("#reading-history-title")?.textContent).toBe("本周阅读");
    expect(container.querySelector('[aria-label="本周每日阅读时长"]')?.children).toHaveLength(7);
    expect(container.textContent).toContain("还没有本机阅读记录。");
    expect(container.querySelector<HTMLButtonElement>('[data-testid="reading-history-clear"]')?.disabled).toBe(true);
    cleanup(container, root);
  });

  it("exposes the weekly summary and requests local history clearing", () => {
    const now = new Date();
    const { container, root, onRequestClear } = renderPanel([
      {
        path: "C:/Notes/Guide.md",
        seconds: 125,
        lastReadAt: now.getTime(),
        dailySeconds: { [localDayKey(now)]: 125 },
      },
    ]);

    expect(container.querySelector('[aria-label^="本周阅读摘要"]')?.getAttribute("aria-label")).toContain("1 篇文档");
    expect(container.querySelector('[aria-label^="本周阅读摘要"]')?.getAttribute("aria-label")).toContain("2 分钟");
    expect(container.querySelectorAll('[role="progressbar"]')).toHaveLength(7);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="reading-history-clear"]')?.click();
    });
    expect(onRequestClear).toHaveBeenCalledTimes(1);
    cleanup(container, root);
  });
});
