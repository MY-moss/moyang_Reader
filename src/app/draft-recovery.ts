import { normalizePathKey } from "./path-key";

const draftStorageKey = "moyang-reader-drafts";
const maxDrafts = 8;
export const MAX_DRAFT_CHARACTERS = 1_000_000;
export const MAX_DRAFT_STORAGE_BYTES = 3_000_000;

export type DraftSnapshot = {
  path: string;
  draft: string;
  baseSource: string;
  savedAt: number;
};

export type DraftSaveResult =
  { ok: true; prunedCount: number; snapshots: DraftSnapshot[] } | { ok: false; prunedCount: 0 };

export type DraftSnapshotState = {
  snapshots: DraftSnapshot[];
  snapshot: DraftSnapshot | null;
};

type DraftStoreCache = {
  raw: string | null;
  snapshots: DraftSnapshot[];
};

let draftStoreCache: DraftStoreCache | null = null;

function comparablePath(path: string): string {
  return normalizePathKey(path);
}

function isDraftSnapshot(value: unknown): value is DraftSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const snapshot = value as Partial<DraftSnapshot>;
  return (
    typeof snapshot.path === "string" &&
    snapshot.path.trim().length > 0 &&
    typeof snapshot.draft === "string" &&
    typeof snapshot.baseSource === "string" &&
    typeof snapshot.savedAt === "number" &&
    Number.isFinite(snapshot.savedAt) &&
    snapshot.savedAt > 0
  );
}

function localStorageBytes(value: string): number {
  // localStorage is generally quota-counted as UTF-16 code units.
  return value.length * 2;
}

function isQuotaExceeded(cause: unknown): boolean {
  if (typeof DOMException !== "undefined" && cause instanceof DOMException) {
    return cause.name === "QuotaExceededError" || cause.code === 22;
  }
  return cause instanceof Error && /quota|storage/i.test(`${cause.name} ${cause.message}`);
}

function serializeDrafts(snapshots: DraftSnapshot[]): string | null {
  const serialized = JSON.stringify(snapshots);
  return localStorageBytes(serialized) <= MAX_DRAFT_STORAGE_BYTES ? serialized : null;
}

function parseDraftSnapshots(raw: string | null): DraftSnapshot[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const seen = new Set<string>();
    return parsed
      .filter(isDraftSnapshot)
      .filter((snapshot) => snapshot.draft !== snapshot.baseSource)
      .filter((snapshot) => {
        const key = comparablePath(snapshot.path);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, maxDrafts);
  } catch {
    return [];
  }
}

function readDraftSnapshots(): DraftSnapshot[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(draftStorageKey);
  } catch {
    return [];
  }

  if (draftStoreCache?.raw === raw) return draftStoreCache.snapshots;
  const snapshots = parseDraftSnapshots(raw);
  draftStoreCache = { raw, snapshots };
  return snapshots;
}

export function loadDraftSnapshots(): DraftSnapshot[] {
  return readDraftSnapshots();
}

export function getDraftSnapshotState(path: string, source: string): DraftSnapshotState {
  const snapshots = loadDraftSnapshots();
  const snapshot = snapshots.find((item) => comparablePath(item.path) === comparablePath(path));
  if (!snapshot) return { snapshots, snapshot: null };
  if (snapshot.draft === source) {
    return { snapshots: clearDraftSnapshot(path), snapshot: null };
  }
  return { snapshots, snapshot };
}

export function findDraftSnapshot(path: string, source: string): DraftSnapshot | null {
  return getDraftSnapshotState(path, source).snapshot;
}

export function saveDraftSnapshot(snapshot: DraftSnapshot): DraftSaveResult {
  if (snapshot.draft === snapshot.baseSource) {
    return { ok: true, prunedCount: 0, snapshots: clearDraftSnapshot(snapshot.path) };
  }
  if (
    snapshot.path.trim().length === 0 ||
    snapshot.draft.length > MAX_DRAFT_CHARACTERS ||
    !Number.isFinite(snapshot.savedAt) ||
    snapshot.savedAt <= 0
  ) {
    return { ok: false, prunedCount: 0 };
  }

  const key = comparablePath(snapshot.path);
  let next = [snapshot, ...loadDraftSnapshots().filter((item) => comparablePath(item.path) !== key)].sort(
    (left, right) => right.savedAt - left.savedAt,
  );
  let prunedCount = Math.max(0, next.length - maxDrafts);
  next = next.slice(0, maxDrafts);

  let serialized = serializeDrafts(next);
  while (!serialized && next.length > 1) {
    next = next.slice(0, -1);
    prunedCount += 1;
    serialized = serializeDrafts(next);
  }
  if (!serialized) return { ok: false, prunedCount: 0 };

  try {
    localStorage.setItem(draftStorageKey, serialized);
    draftStoreCache = { raw: serialized, snapshots: next };
    return { ok: true, prunedCount, snapshots: next };
  } catch (cause) {
    if (!isQuotaExceeded(cause) || next.length <= 1) return { ok: false, prunedCount: 0 };

    const retry = next.slice(0, -1);
    const retrySerialized = serializeDrafts(retry);
    if (!retrySerialized) return { ok: false, prunedCount: 0 };

    try {
      localStorage.setItem(draftStorageKey, retrySerialized);
      draftStoreCache = { raw: retrySerialized, snapshots: retry };
      return { ok: true, prunedCount: prunedCount + 1, snapshots: retry };
    } catch {
      return { ok: false, prunedCount: 0 };
    }
  }
}

export function clearDraftSnapshot(path: string): DraftSnapshot[] {
  try {
    const key = comparablePath(path);
    const next = loadDraftSnapshots().filter((snapshot) => comparablePath(snapshot.path) !== key);
    if (next.length > 0) {
      const serialized = JSON.stringify(next);
      localStorage.setItem(draftStorageKey, serialized);
      draftStoreCache = { raw: serialized, snapshots: next };
    } else {
      localStorage.removeItem(draftStorageKey);
      draftStoreCache = { raw: null, snapshots: [] };
    }
    return next;
  } catch {
    // Draft cleanup is best-effort when local storage is unavailable.
    return readDraftSnapshots();
  }
}

export function clearAllDraftSnapshots(): void {
  try {
    localStorage.removeItem(draftStorageKey);
    draftStoreCache = { raw: null, snapshots: [] };
  } catch {
    // Draft cleanup is best-effort when local storage is unavailable.
  }
}

export function formatDraftRecoveryTime(savedAt: number, now = Date.now()): string {
  const elapsedMinutes = Math.max(0, Math.floor((now - savedAt) / 60_000));
  if (elapsedMinutes < 1) return "刚刚";
  if (elapsedMinutes < 60) return `${elapsedMinutes} 分钟前`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} 小时前`;
  return `${Math.floor(elapsedHours / 24)} 天前`;
}
