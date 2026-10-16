import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { watchAiChanges } from "./change-watch";
let stop: () => void;
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
});
afterEach(() => {
  stop?.();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("checks cheaply when idle and refreshes only after an external change", async () => {
  const read = vi.fn(async () => "1"),
    refresh = vi.fn();
  stop = watchAiChanges(read, refresh, vi.fn());
  await vi.advanceTimersByTimeAsync(24000);
  expect(read).toHaveBeenCalledTimes(3);
  expect(refresh).not.toHaveBeenCalled();
  read.mockResolvedValue("2");
  await vi.advanceTimersByTimeAsync(12000);
  expect(refresh).toHaveBeenCalledOnce();
});
it("suspends hidden work and checks immediately when visible again", async () => {
  const read = vi.fn(async () => "1"),
    refresh = vi.fn();
  stop = watchAiChanges(read, refresh, vi.fn());
  await vi.advanceTimersByTimeAsync(0);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(24000);
  expect(read).toHaveBeenCalledOnce();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(0);
  expect(refresh).toHaveBeenCalledOnce();
});
