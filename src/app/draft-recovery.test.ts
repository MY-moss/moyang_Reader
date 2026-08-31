import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAllDraftSnapshots,
  clearDraftSnapshot,
  getDraftSnapshotState,
  findDraftSnapshot,
  formatDraftRecoveryTime,
  loadDraftSnapshots,
  MAX_DRAFT_CHARACTERS,
  MAX_DRAFT_STORAGE_BYTES,
  saveDraftSnapshot,
} from "./draft-recovery";

describe("draft recovery", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores and finds a changed draft without confusing path casing", () => {
    const snapshot = { path: "C:\\Notes\\Draft.md", draft: "new", baseSource: "old", savedAt: 1_000 };
    expect(saveDraftSnapshot(snapshot).ok).toBe(true);
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
        }).ok,
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

  it("clears all saved snapshots from the local recovery center", () => {
    saveDraftSnapshot({ path: "C:/Notes/one.md", draft: "one", baseSource: "", savedAt: 1 });
    saveDraftSnapshot({ path: "C:/Notes/two.md", draft: "two", baseSource: "", savedAt: 2 });

    clearAllDraftSnapshots();

    expect(loadDraftSnapshots()).toEqual([]);
  });

  it("does not store unchanged or oversized drafts", () => {
    expect(saveDraftSnapshot({ path: "C:/Notes/same.md", draft: "same", baseSource: "same", savedAt: 1 }).ok).toBe(
      true,
    );
    expect(
      saveDraftSnapshot({
        path: "C:/Notes/large.md",
        draft: "x".repeat(MAX_DRAFT_CHARACTERS + 1),
        baseSource: "",
        savedAt: 1,
      }).ok,
    ).toBe(false);
    expect(loadDraftSnapshots()).toEqual([]);
  });

  it("filters stale unchanged snapshots from the recovery center", () => {
    localStorage.setItem(
      "moyang-reader-drafts",
      JSON.stringify([
        { path: "C:/Notes/stale.md", draft: "same", baseSource: "same", savedAt: 2_000 },
        { path: "C:/Notes/changed.md", draft: "new", baseSource: "old", savedAt: 1_000 },
      ]),
    );

    expect(loadDraftSnapshots()).toEqual([
      { path: "C:/Notes/changed.md", draft: "new", baseSource: "old", savedAt: 1_000 },
    ]);
  });

  it("keeps the serialized draft store under the storage budget", () => {
    for (let index = 0; index < 8; index += 1) {
      expect(
        saveDraftSnapshot({
          path: `C:/Notes/${index}.md`,
          draft: "x".repeat(200_000),
          baseSource: "",
          savedAt: index + 1,
        }).ok,
      ).toBe(true);
    }

    const serialized = localStorage.getItem("moyang-reader-drafts") ?? "";
    expect(serialized.length * 2).toBeLessThanOrEqual(MAX_DRAFT_STORAGE_BYTES);
    expect(loadDraftSnapshots()).toHaveLength(7);
  });

  it("retries once after a quota error and drops the oldest draft", () => {
    const oldDraft = { path: "C:/Notes/old.md", draft: "old", baseSource: "", savedAt: 1 };
    const newDraft = { path: "C:/Notes/new.md", draft: "new", baseSource: "", savedAt: 2 };
    expect(saveDraftSnapshot(oldDraft).ok).toBe(true);

    const originalSetItem = Storage.prototype.setItem;
    let attempts = 0;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
      if (key === "moyang-reader-drafts" && attempts === 0) {
        attempts += 1;
        throw new DOMException("quota exceeded", "QuotaExceededError");
      }
      return originalSetItem.call(localStorage, key, value);
    });

    expect(saveDraftSnapshot(newDraft)).toMatchObject({ ok: true, prunedCount: 1, snapshots: [newDraft] });
    expect(loadDraftSnapshots()).toEqual([newDraft]);
    expect(attempts).toBe(1);
  });

  it("parses the persisted store once and reuses the in-memory snapshot state", () => {
    const original = { path: "C:/Notes/original.md", draft: "draft", baseSource: "source", savedAt: 1 };
    localStorage.setItem("moyang-reader-drafts", JSON.stringify([original]));
    const parseSpy = vi.spyOn(JSON, "parse");

    expect(getDraftSnapshotState(original.path, original.baseSource).snapshot).toEqual(original);
    expect(findDraftSnapshot(original.path, original.baseSource)).toEqual(original);
    expect(saveDraftSnapshot({ path: "C:/Notes/new.md", draft: "new", baseSource: "", savedAt: 2 }).snapshots).toEqual([
      { path: "C:/Notes/new.md", draft: "new", baseSource: "", savedAt: 2 },
      original,
    ]);

    expect(parseSpy).toHaveBeenCalledTimes(1);
  });
});
