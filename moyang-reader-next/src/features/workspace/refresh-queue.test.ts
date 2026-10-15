import { describe, expect, it, vi } from "vitest";
import { createRefreshQueue } from "./refresh-queue";

describe("workspace refresh queue", () => {
  it("keeps every scope when a deletion arrives during another delta", async () => {
    let finish!: () => void;
    const first = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const run = vi
      .fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValue(undefined);
    const queue = createRefreshQueue(run);
    const pending = queue(["added.md"]);
    void queue(["removed-folder"]);
    void queue(["removed-folder", "other.md"]);
    expect(run).toHaveBeenCalledTimes(1);
    finish();
    await pending;
    expect(run.mock.calls).toEqual([[["added.md"]], [["removed-folder", "other.md"]]]);
    await queue(["later.md"]);
    expect(run).toHaveBeenLastCalledWith(["later.md"]);
  });
});
