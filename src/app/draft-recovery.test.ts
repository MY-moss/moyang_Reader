import { beforeEach, describe, expect, it } from "vitest";
import {
  clearDraftSnapshot,
  findDraftSnapshot,
  formatDraftRecoveryTime,
  loadDraftSnapshots,
  saveDraftSnapshot,
} from "./draft-recovery";

describe("draft recovery", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores and finds a changed draft without confusing path casing", () => {
    const snapshot = { path: "C:\\Notes\\Draft.md", draft: "new", baseSource: "old", savedAt: 1_000 };
    expect(saveDraftSnapshot(snapshot)).toBe(true);
    expect(findDraftSnapshot("c:/notes/draft.md/", "old")).toEqual(snapshot);
    expect(findDraftSnapshot(snapshot.path, "new")).toBeNull();
  });

  it("replaces the same path and limits snapshots to the newest eight", () => {
    for (let index = 0; index < 10; index += 1) {
      expect(
        saveDraftSnapshot({
          path: `C:/Notes/${index}.md`,
          draft: `draft-${index}`,
          baseSource: "",
          savedAt: index + 1,
        }),
      ).toBe(true);
    }
    expect(loadDraftSnapshots()).toHaveLength(8);
    expect(loadDraftSnapshots()[0]?.path).toBe("C:/Notes/9.md");
  });

  it("clears a snapshot after normal save and formats recovery age", () => {
    const snapshot = { path: "C:/Notes/Draft.md", draft: "new", baseSource: "old", savedAt: 1_000 };
    saveDraftSnapshot(snapshot);
    clearDraftSnapshot(snapshot.path);
    expect(loadDraftSnapshots()).toEqual([]);
    expect(formatDraftRecoveryTime(60_000, 60_000)).toBe("刚刚");
    expect(formatDraftRecoveryTime(0, 3_660_000)).toBe("1 小时前");
  });

  it("does not store unchanged or oversized drafts", () => {
    expect(saveDraftSnapshot({ path: "C:/Notes/same.md", draft: "same", baseSource: "same", savedAt: 1 })).toBe(true);
    expect(
      saveDraftSnapshot({
        path: "C:/Notes/large.md",
        draft: "x".repeat(2_000_001),
        baseSource: "",
        savedAt: 1,
      }),
    ).toBe(false);
    expect(loadDraftSnapshots()).toEqual([]);
  });
});
