import { normalizePathKey } from "../../platform/path-key";
import { readerDraftRequest } from "../../platform/reader-drafts";
import { draftSummary, type DraftSnapshot, type DraftSummary } from "../../shared/reader-draft-types";
export type { DraftSnapshot, DraftSummary } from "../../shared/reader-draft-types";
export const MAX_DRAFT_CHARACTERS = 8_000_000;
export type DraftSaveResult = { ok: boolean; prunedCount: number; error?: string };
const legacyKey = "moyang-reader-drafts";
let summaries: DraftSummary[] = [];
let initialized: Promise<void> | undefined;
let queue: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();
function publish(next: DraftSummary[]) {
  summaries = next.sort((a, b) => b.savedAt - a.savedAt);
  listeners.forEach((listener) => listener());
}
function valid(value: unknown): value is DraftSnapshot {
  if (!value || typeof value !== "object") return false;
  const item = value as DraftSnapshot;
  return (
    typeof item.path === "string" &&
    !!item.path.trim() &&
    typeof item.draft === "string" &&
    typeof item.baseSource === "string" &&
    Number.isFinite(item.savedAt) &&
    item.savedAt > 0
  );
}
export function initializeDrafts(): Promise<void> {
  if (!initialized)
    initialized = (async () => {
      const raw = localStorage.getItem(legacyKey);
      if (raw && !localStorage.getItem(`${legacyKey}-migrated`)) {
        const values: unknown = JSON.parse(raw);
        if (!Array.isArray(values) || !values.every(valid)) throw new Error("旧草稿格式无法识别，已保留原数据");
        for (const snapshot of [...values].sort((a, b) => b.savedAt - a.savedAt))
          await readerDraftRequest("import", { snapshot });
        // Retain the original copy for rollback; this marker prevents discarded drafts from reappearing.
        localStorage.setItem(`${legacyKey}-migrated`, "1");
      }
      publish(await readerDraftRequest<DraftSummary[]>("list"));
    })().catch((error) => {
      initialized = undefined;
      throw error;
    });
  return initialized;
}
function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const result = queue
    .catch(() => {})
    .then(async () => {
      await initializeDrafts();
      return work();
    });
  queue = result;
  return result;
}
export function subscribeDraftSnapshots(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function loadDraftSnapshots(): DraftSummary[] {
  return summaries;
}
export async function flushDraftWrites() {
  await queue;
}
export async function findDraftSnapshot(path: string, source: string): Promise<DraftSnapshot | null> {
  return enqueue(async () => {
    const item = await readerDraftRequest<DraftSnapshot | null>("get", { path });
    if (item?.draft === source) {
      await remove(path);
      return null;
    }
    return item;
  });
}
async function remove(path: string, expectedDraft?: string) {
  await readerDraftRequest("delete", { path, expectedDraft });
  // Conditional deletion may retain a newer draft. Summaries remain small.
  publish(await readerDraftRequest<DraftSummary[]>("list"));
}
export async function saveDraftSnapshot(snapshot: DraftSnapshot): Promise<DraftSaveResult> {
  if (
    !valid(snapshot) ||
    snapshot.draft.length > MAX_DRAFT_CHARACTERS ||
    snapshot.baseSource.length > MAX_DRAFT_CHARACTERS
  )
    return { ok: false, prunedCount: 0, error: "草稿超过单篇容量（800 万字符）" };
  try {
    await enqueue(async () => {
      if (snapshot.draft === snapshot.baseSource) {
        await remove(snapshot.path);
        return;
      }
      await readerDraftRequest("put", { snapshot });
      const key = normalizePathKey(snapshot.path);
      publish([draftSummary(snapshot), ...summaries.filter((s) => normalizePathKey(s.path) !== key)]);
    });
    return { ok: true, prunedCount: 0 };
  } catch (error) {
    return { ok: false, prunedCount: 0, error: String(error) };
  }
}
export function clearDraftSnapshot(path: string, expectedDraft?: string): Promise<void> {
  return enqueue(() => remove(path, expectedDraft));
}
export function clearAllDraftSnapshots(): Promise<void> {
  return enqueue(async () => {
    await readerDraftRequest("clear");
    publish([]);
  });
}

export function formatDraftRecoveryTime(savedAt: number, now = Date.now()): string {
  const elapsedMinutes = Math.max(0, Math.floor((now - savedAt) / 60_000));
  if (elapsedMinutes < 1) return "刚刚";
  if (elapsedMinutes < 60) return `${elapsedMinutes} 分钟前`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} 小时前`;
  return `${Math.floor(elapsedHours / 24)} 天前`;
}
