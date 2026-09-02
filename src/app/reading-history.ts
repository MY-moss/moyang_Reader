import { normalizePathKey } from "./path-key";

export const READING_HISTORY_STORAGE_KEY = "moyang-reader-reading-history";
export const READING_HEARTBEAT_INTERVAL_MS = 60_000;
export const MAX_READING_HISTORY_ENTRIES = 256;
export const MAX_READING_HISTORY_DAYS = 366;

export type ReadingHistoryEntry = {
  path: string;
  seconds: number;
  lastReadAt: number;
  dailySeconds: Record<string, number>;
};

export type ReadingHistoryWriter = (path: string, seconds: number, at: number) => void;

type ReadingHistoryTimer = ReturnType<typeof globalThis.setInterval>;

export type ReadingHistoryTrackerOptions = {
  now?: () => number;
  isForeground?: () => boolean;
  write?: ReadingHistoryWriter;
  heartbeatMs?: number;
  setIntervalFn?: (callback: () => void, delay: number) => ReadingHistoryTimer;
  clearIntervalFn?: (handle: ReadingHistoryTimer) => void;
};

export type ReadingHistoryTracker = {
  start: () => void;
  pause: () => void;
  resume: () => void;
  heartbeat: () => void;
  stop: () => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTemporaryPath(path: string): boolean {
  return path.toLowerCase().startsWith("browser://");
}

function isValidTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function normalizeSeconds(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value));
}

function addSeconds(left: number, right: number): number {
  return Math.min(Number.MAX_SAFE_INTEGER, left + right);
}

function readingDayKey(timestamp: number): string | null {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidDayKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

function normalizeDailySeconds(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter(([day, seconds]) => isValidDayKey(day) && normalizeSeconds(seconds) > 0)
      .map(([day, seconds]) => [day, normalizeSeconds(seconds)] as const)
      .sort(([left], [right]) => right.localeCompare(left))
      .slice(0, MAX_READING_HISTORY_DAYS),
  );
}

function normalizeEntry(value: unknown): ReadingHistoryEntry | null {
  if (!isRecord(value) || typeof value.path !== "string") return null;

  const path = value.path.trim();
  if (!path || isTemporaryPath(path)) return null;

  const dailySeconds = normalizeDailySeconds(value.dailySeconds);
  const seconds = normalizeSeconds(value.seconds);
  const lastReadAt = isValidTimestamp(value.lastReadAt) ? value.lastReadAt : 0;
  if (seconds <= 0 && Object.keys(dailySeconds).length === 0) return null;

  return { path, seconds, lastReadAt, dailySeconds };
}

function mergeDailySeconds(left: Record<string, number>, right: Record<string, number>): Record<string, number> {
  const merged = { ...left };
  for (const [day, seconds] of Object.entries(right)) {
    merged[day] = addSeconds(merged[day] ?? 0, seconds);
  }
  return normalizeDailySeconds(merged);
}

function mergeEntries(left: ReadingHistoryEntry, right: ReadingHistoryEntry): ReadingHistoryEntry {
  return {
    path: left.path,
    seconds: addSeconds(left.seconds, right.seconds),
    lastReadAt: Math.max(left.lastReadAt, right.lastReadAt),
    dailySeconds: mergeDailySeconds(left.dailySeconds, right.dailySeconds),
  };
}

export function normalizeReadingHistory(value: unknown): ReadingHistoryEntry[] {
  if (!Array.isArray(value)) return [];

  const entries: ReadingHistoryEntry[] = [];
  const indexes = new Map<string, number>();
  for (const candidate of value) {
    const entry = normalizeEntry(candidate);
    if (!entry) continue;

    const key = normalizePathKey(entry.path);
    const existingIndex = indexes.get(key);
    if (existingIndex === undefined) {
      indexes.set(key, entries.length);
      entries.push(entry);
    } else {
      entries[existingIndex] = mergeEntries(entries[existingIndex], entry);
    }
  }

  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => right.entry.lastReadAt - left.entry.lastReadAt || left.index - right.index)
    .slice(0, MAX_READING_HISTORY_ENTRIES)
    .map(({ entry }) => entry);
}

export function loadReadingHistory(): ReadingHistoryEntry[] {
  try {
    const raw = localStorage.getItem(READING_HISTORY_STORAGE_KEY);
    return raw ? normalizeReadingHistory(JSON.parse(raw) as unknown) : [];
  } catch {
    return [];
  }
}

export function saveReadingHistory(entries: readonly ReadingHistoryEntry[]): void {
  try {
    localStorage.setItem(READING_HISTORY_STORAGE_KEY, JSON.stringify(normalizeReadingHistory(entries)));
  } catch {
    // Reading history is best-effort when local storage is unavailable or full.
  }
}

export function recordReadingSeconds(path: string, seconds: number, at = Date.now()): void {
  const normalizedPath = path.trim();
  const normalizedSeconds = normalizeSeconds(seconds);
  if (!normalizedPath || isTemporaryPath(normalizedPath) || normalizedSeconds <= 0 || !isValidTimestamp(at)) return;

  const key = normalizePathKey(normalizedPath);
  const history = loadReadingHistory();
  const current = history.find((entry) => normalizePathKey(entry.path) === key);
  const day = readingDayKey(at);
  const dailySeconds = current ? { ...current.dailySeconds } : {};
  if (day) dailySeconds[day] = addSeconds(dailySeconds[day] ?? 0, normalizedSeconds);

  const nextEntry: ReadingHistoryEntry = {
    path: current?.path ?? normalizedPath,
    seconds: addSeconds(current?.seconds ?? 0, normalizedSeconds),
    lastReadAt: Math.max(current?.lastReadAt ?? 0, at),
    dailySeconds: normalizeDailySeconds(dailySeconds),
  };
  saveReadingHistory([nextEntry, ...history.filter((entry) => normalizePathKey(entry.path) !== key)]);
}

function defaultIsForeground(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible" && (typeof document.hasFocus !== "function" || document.hasFocus());
}

function readClock(now: () => number): number | null {
  const current = now();
  return isValidTimestamp(current) ? current : null;
}

function fallbackTimestamp(): number {
  const current = Date.now();
  return isValidTimestamp(current) ? current : 0;
}

function normalizeHeartbeatMs(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.max(1, Math.floor(value))
    : READING_HEARTBEAT_INTERVAL_MS;
}

export function createReadingHistoryTracker(
  path: string,
  options: ReadingHistoryTrackerOptions = {},
): ReadingHistoryTracker {
  const normalizedPath = path.trim();
  if (!normalizedPath || isTemporaryPath(normalizedPath)) {
    return {
      start: () => undefined,
      pause: () => undefined,
      resume: () => undefined,
      heartbeat: () => undefined,
      stop: () => undefined,
    };
  }

  const now = options.now ?? Date.now;
  const isForeground = options.isForeground ?? defaultIsForeground;
  const write = options.write ?? ((documentPath, seconds, at) => recordReadingSeconds(documentPath, seconds, at));
  const heartbeatMs = normalizeHeartbeatMs(options.heartbeatMs);
  const setIntervalFn = options.setIntervalFn ?? ((callback, delay) => globalThis.setInterval(callback, delay));
  const clearIntervalFn = options.clearIntervalFn ?? ((handle) => globalThis.clearInterval(handle));

  let running = false;
  let activeSince: number | null = null;
  let pendingMilliseconds = 0;
  let timer: ReadingHistoryTimer | null = null;

  const safeIsForeground = (): boolean => {
    try {
      return isForeground();
    } catch {
      return false;
    }
  };

  const flushWholeSeconds = (at: number): void => {
    const seconds = Math.floor(pendingMilliseconds / 1_000);
    if (seconds <= 0) return;

    try {
      write(normalizedPath, seconds, at);
      pendingMilliseconds -= seconds * 1_000;
    } catch {
      // Keep the pending duration for a later flush when persistence fails.
    }
  };

  const accrueUntil = (at: number): void => {
    if (activeSince === null) return;
    const elapsed = at - activeSince;
    if (elapsed > 0) pendingMilliseconds += elapsed;
    activeSince = at;
  };

  const start = (): void => {
    if (running) return;
    running = true;
    const at = readClock(now);
    if (safeIsForeground() && at !== null) activeSince = at;
    timer = setIntervalFn(heartbeat, heartbeatMs);
  };

  const pause = (): void => {
    if (!running) return;
    const at = readClock(now);
    if (at === null) {
      activeSince = null;
      flushWholeSeconds(fallbackTimestamp());
      return;
    }
    accrueUntil(at);
    activeSince = null;
    flushWholeSeconds(at);
  };

  const resume = (): void => {
    if (!running || !safeIsForeground() || activeSince !== null) return;
    const at = readClock(now);
    if (at !== null) activeSince = at;
  };

  const heartbeat = (): void => {
    if (!running) return;
    const at = readClock(now);
    if (at === null) {
      activeSince = null;
      flushWholeSeconds(fallbackTimestamp());
      return;
    }
    if (!safeIsForeground()) {
      activeSince = null;
      flushWholeSeconds(at);
      return;
    }

    if (activeSince === null) {
      activeSince = at;
      return;
    }
    accrueUntil(at);
    flushWholeSeconds(at);
  };

  const stop = (): void => {
    if (!running) return;
    pause();
    running = false;
    if (timer !== null) {
      clearIntervalFn(timer);
      timer = null;
    }
  };

  return { start, pause, resume, heartbeat, stop };
}
