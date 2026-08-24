const draftStorageKey = "moyang-reader-drafts";
const maxDrafts = 8;
const maxDraftCharacters = 2_000_000;

export type DraftSnapshot = {
  path: string;
  draft: string;
  baseSource: string;
  savedAt: number;
};

function comparablePath(path: string): string {
  return path
    .replace(/[\\/]+/g, "\\")
    .replace(/\\$/, "")
    .toLocaleLowerCase();
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

export function loadDraftSnapshots(): DraftSnapshot[] {
  try {
    const raw = localStorage.getItem(draftStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const seen = new Set<string>();
    return parsed
      .filter(isDraftSnapshot)
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

export function findDraftSnapshot(path: string, source: string): DraftSnapshot | null {
  const snapshot = loadDraftSnapshots().find((item) => comparablePath(item.path) === comparablePath(path));
  if (!snapshot) return null;
  if (snapshot.draft === source) {
    clearDraftSnapshot(path);
    return null;
  }
  return snapshot;
}

export function saveDraftSnapshot(snapshot: DraftSnapshot): boolean {
  if (snapshot.draft === snapshot.baseSource) {
    clearDraftSnapshot(snapshot.path);
    return true;
  }
  if (
    snapshot.path.trim().length === 0 ||
    snapshot.draft.length > maxDraftCharacters ||
    !Number.isFinite(snapshot.savedAt) ||
    snapshot.savedAt <= 0
  ) {
    return false;
  }

  try {
    const key = comparablePath(snapshot.path);
    const next = [snapshot, ...loadDraftSnapshots().filter((item) => comparablePath(item.path) !== key)].slice(
      0,
      maxDrafts,
    );
    localStorage.setItem(draftStorageKey, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function clearDraftSnapshot(path: string): void {
  try {
    const key = comparablePath(path);
    const next = loadDraftSnapshots().filter((snapshot) => comparablePath(snapshot.path) !== key);
    if (next.length > 0) localStorage.setItem(draftStorageKey, JSON.stringify(next));
    else localStorage.removeItem(draftStorageKey);
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
