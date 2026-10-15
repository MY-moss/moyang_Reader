import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleSourceRender, SOURCE_RENDER_DEBOUNCE_MS } from "./source-render-scheduler";

describe("scheduleSourceRender", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits for the debounce window before rendering", () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    scheduleSourceRender(callback);

    vi.advanceTimersByTime(SOURCE_RENDER_DEBOUNCE_MS - 1);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending render when a newer draft supersedes it", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const cancel = scheduleSourceRender(callback);

    cancel();
    vi.advanceTimersByTime(SOURCE_RENDER_DEBOUNCE_MS);

    expect(callback).not.toHaveBeenCalled();
  });
});
