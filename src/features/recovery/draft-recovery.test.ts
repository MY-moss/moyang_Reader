import { beforeEach, expect, it, vi } from "vitest";
import { readerDraftRequest } from "../../platform/reader-drafts";
import { draftSummary, type DraftSnapshot } from "../../shared/reader-draft-types";
import { normalizePathKey } from "../../platform/path-key";
vi.mock("../../platform/reader-drafts", () => ({ readerDraftRequest: vi.fn() }));
let api: typeof import("./draft-recovery");
let rows: Map<string, DraftSnapshot>;
const snapshot = (path = "C:/Notes/one.md", draft = "修改后的中文") => ({
  path,
  draft,
  baseSource: "原文",
  savedAt: 1000,
});
beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  rows = new Map();
  vi.mocked(readerDraftRequest).mockImplementation(async (action, p = {}) => {
    const key = normalizePathKey((p.path as string) ?? "");
    if (action === "list") return [...rows.values()].map(draftSummary);
    if (action === "get") return rows.get(key) ?? null;
    if (action === "clear") {
      rows.clear();
      return;
    }
    if (action === "delete") {
      if (p.expectedDraft === undefined || rows.get(key)?.draft === p.expectedDraft) rows.delete(key);
      return;
    }
    const item = p.snapshot as DraftSnapshot,
      id = normalizePathKey(item.path);
    if (action !== "import" || !rows.has(id)) rows.set(id, item);
  });
  api = await import("./draft-recovery");
});
it("saves individual drafts and retrieves full text only on demand", async () => {
  const one = snapshot();
  expect((await api.saveDraftSnapshot(one)).ok).toBe(true);
  await api.saveDraftSnapshot(snapshot("C:/Notes/two.md"));
  expect(api.loadDraftSnapshots()).toHaveLength(2);
  expect(api.loadDraftSnapshots()[0]).not.toHaveProperty("baseSource");
  expect(await api.findDraftSnapshot("c:\\notes\\ONE.md/", "原文")).toEqual(one);
  expect(await api.findDraftSnapshot(one.path, one.draft)).toBeNull();
  expect(api.loadDraftSnapshots()).toHaveLength(1);
});
it("imports legacy drafts once and keeps a rollback copy without resurrecting discarded drafts", async () => {
  const item = snapshot();
  localStorage.setItem("moyang-reader-drafts", JSON.stringify([item]));
  await api.initializeDrafts();
  expect(await api.findDraftSnapshot(item.path, "原文")).toEqual(item);
  await api.clearAllDraftSnapshots();
  vi.resetModules();
  api = await import("./draft-recovery");
  await api.initializeDrafts();
  expect(api.loadDraftSnapshots()).toEqual([]);
  expect(localStorage.getItem("moyang-reader-drafts")).toContain("修改后的中文");
});
it("retains existing and legacy drafts when storage fails and retries migration", async () => {
  localStorage.setItem("moyang-reader-drafts", JSON.stringify([snapshot()]));
  vi.mocked(readerDraftRequest).mockRejectedValueOnce(new Error("disk full"));
  await expect(api.initializeDrafts()).rejects.toThrow("disk full");
  expect(localStorage.getItem("moyang-reader-drafts-migrated")).toBeNull();
  await api.initializeDrafts();
  vi.mocked(readerDraftRequest).mockRejectedValueOnce(new Error("quota"));
  expect((await api.saveDraftSnapshot(snapshot("new.md"))).ok).toBe(false);
  expect(api.loadDraftSnapshots()).toHaveLength(1);
});
it("serializes write and cleanup, and stale save cleanup keeps newer text", async () => {
  const path = snapshot().path;
  await Promise.all([
    api.saveDraftSnapshot(snapshot()),
    api.saveDraftSnapshot(snapshot(path, "继续输入")),
    api.clearDraftSnapshot(path, "修改后的中文"),
  ]);
  expect((await api.findDraftSnapshot(path, "原文"))?.draft).toBe("继续输入");
  await api.clearAllDraftSnapshots();
  expect(api.loadDraftSnapshots()).toEqual([]);
});
