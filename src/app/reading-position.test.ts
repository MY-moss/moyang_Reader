import { describe, expect, it, vi } from "vitest";
import { createReadingPositionTracker } from "./reading-position";

describe("createReadingPositionTracker", () => {
  it("flushes the last known position instead of reading a changed DOM value", () => {
    const write = vi.fn();
    const tracker = createReadingPositionTracker("notes/old.md", 120, write);

    tracker.update(640);
    tracker.flush();

    expect(write).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith("notes/old.md", 640);
  });

  it("normalizes invalid and negative positions", () => {
    const write = vi.fn();
    const tracker = createReadingPositionTracker("notes/example.md", -20, write);

    expect(tracker.current()).toBe(0);
    tracker.update(Number.NaN);
    tracker.flush();

    expect(write).toHaveBeenCalledWith("notes/example.md", 0);
  });
});
