import { afterEach, describe, expect, it } from "vitest";
import {
  loadReadingHistory,
  recordReadingSeconds,
  READING_HISTORY_STORAGE_KEY,
  READING_HEARTBEAT_INTERVAL_MS,
  createReadingHistoryTracker,
} from "./reading-history";

afterEach(() => {
  localStorage.clear();
});

describe("reading history", () => {
  it("merges per-document seconds case-insensitively and keeps daily totals", () => {
    const firstRead = new Date(2026, 8, 2, 23, 59).getTime();
    const nextRead = new Date(2026, 8, 3, 0, 1).getTime();

    recordReadingSeconds("C:/Notes/Guide.md", 5, firstRead);
    recordReadingSeconds("c:\\notes\\guide.md", 7, nextRead);

    expect(loadReadingHistory()).toEqual([
      {
        path: "C:/Notes/Guide.md",
        seconds: 12,
        lastReadAt: nextRead,
        dailySeconds: {
          "2026-09-02": 5,
          "2026-09-03": 7,
        },
      },
    ]);
  });

  it("ignores temporary browser documents and malformed persisted records", () => {
    localStorage.setItem(
      READING_HISTORY_STORAGE_KEY,
      JSON.stringify([
        { path: "browser://preview.md", seconds: 40, lastReadAt: 4 },
        { path: "C:/Notes/invalid.md", seconds: -1, lastReadAt: 4 },
        {
          path: "C:/Notes/Guide.md",
          seconds: 12,
          lastReadAt: 6,
          dailySeconds: { "2026-09-02": 12, invalid: 99 },
        },
      ]),
    );

    expect(loadReadingHistory()).toEqual([
      {
        path: "C:/Notes/Guide.md",
        seconds: 12,
        lastReadAt: 6,
        dailySeconds: { "2026-09-02": 12 },
      },
    ]);

    localStorage.setItem(READING_HISTORY_STORAGE_KEY, "not-json");
    expect(loadReadingHistory()).toEqual([]);
  });

  it("counts foreground time on a 60-second heartbeat and pauses while hidden", () => {
    let now = 0;
    let foreground = true;
    let heartbeat: (() => void) | undefined;
    let clearedTimer: ReturnType<typeof setInterval> | undefined;
    const writes: Array<{ path: string; seconds: number; at: number }> = [];
    const timerId = 1 as unknown as ReturnType<typeof setInterval>;

    const tracker = createReadingHistoryTracker("C:/Notes/Guide.md", {
      now: () => now,
      isForeground: () => foreground,
      write: (path, seconds, at) => writes.push({ path, seconds, at }),
      setIntervalFn: (callback, delay) => {
        heartbeat = callback;
        expect(delay).toBe(READING_HEARTBEAT_INTERVAL_MS);
        return timerId;
      },
      clearIntervalFn: (handle) => {
        clearedTimer = handle;
      },
    });

    tracker.start();
    now = 60_000;
    heartbeat?.();
    expect(writes).toEqual([{ path: "C:/Notes/Guide.md", seconds: 60, at: 60_000 }]);

    foreground = false;
    now = 100_000;
    tracker.pause();
    expect(writes).toEqual([
      { path: "C:/Notes/Guide.md", seconds: 60, at: 60_000 },
      { path: "C:/Notes/Guide.md", seconds: 40, at: 100_000 },
    ]);

    now = 200_000;
    tracker.resume();
    foreground = true;
    tracker.resume();
    now = 260_000;
    heartbeat?.();
    expect(writes).toEqual([
      { path: "C:/Notes/Guide.md", seconds: 60, at: 60_000 },
      { path: "C:/Notes/Guide.md", seconds: 40, at: 100_000 },
      { path: "C:/Notes/Guide.md", seconds: 60, at: 260_000 },
    ]);

    now = 265_000;
    tracker.stop();
    expect(writes).toEqual([
      { path: "C:/Notes/Guide.md", seconds: 60, at: 60_000 },
      { path: "C:/Notes/Guide.md", seconds: 40, at: 100_000 },
      { path: "C:/Notes/Guide.md", seconds: 60, at: 260_000 },
      { path: "C:/Notes/Guide.md", seconds: 5, at: 265_000 },
    ]);
    expect(clearedTimer).toBe(timerId);
  });
});
