import { normalizePathKey } from "./path-key";

/**
 * A bookmark is a lightweight reading location, not a second copy of the
 * document. The document path remains the source of truth.
 */
export type DocumentBookmark = {
  path: string;
  headingId?: string;
  quote?: string;
  note?: string;
  createdAt: number;
};

export type BookmarkOptions = {
  headingId?: string | null;
  quote?: string | null;
  note?: string | null;
  createdAt?: number;
};

export const bookmarksStorageKey = "moyang-reader-bookmarks";
export const MAX_BOOKMARKS = 256;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function normalizeBookmark(value: unknown): DocumentBookmark | null {
  if (!isRecord(value) || typeof value.path !== "string") return null;

  const path = value.path.trim();
  const createdAt = value.createdAt;
  if (!path || typeof createdAt !== "number" || !Number.isFinite(createdAt) || createdAt < 0) return null;

  const headingId = optionalText(value.headingId);
  const quote = optionalText(value.quote);
  const note = optionalText(value.note);
  return {
    path,
    ...(headingId ? { headingId } : {}),
    ...(quote ? { quote } : {}),
    ...(note ? { note } : {}),
    createdAt,
  };
}

export function createBookmark(path: string, options: BookmarkOptions = {}): DocumentBookmark {
  const bookmark = normalizeBookmark({
    path,
    headingId: options.headingId,
    quote: options.quote,
    note: options.note,
    createdAt: options.createdAt ?? Date.now(),
  });
  if (!bookmark) throw new Error("无法创建空书签。");
  return bookmark;
}

/** Location identity deliberately excludes note and creation time. */
export function bookmarkIdentity(bookmark: Pick<DocumentBookmark, "path" | "headingId" | "quote">): string {
  return [normalizePathKey(bookmark.path.trim()), bookmark.headingId?.trim() ?? "", bookmark.quote?.trim() ?? ""].join(
    "\u0000",
  );
}

export function normalizeBookmarks(value: unknown): DocumentBookmark[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const bookmarks: DocumentBookmark[] = [];
  for (const candidate of value) {
    const bookmark = normalizeBookmark(candidate);
    if (!bookmark) continue;
    const identity = bookmarkIdentity(bookmark);
    if (seen.has(identity)) continue;
    seen.add(identity);
    bookmarks.push(bookmark);
    if (bookmarks.length >= MAX_BOOKMARKS) break;
  }
  return bookmarks;
}

export function hasBookmark(bookmarks: readonly DocumentBookmark[], target: DocumentBookmark): boolean {
  const identity = bookmarkIdentity(target);
  return bookmarks.some((bookmark) => bookmarkIdentity(bookmark) === identity);
}

export function addBookmark(bookmarks: readonly DocumentBookmark[], bookmark: DocumentBookmark): DocumentBookmark[] {
  const normalized = normalizeBookmark(bookmark);
  if (!normalized) return normalizeBookmarks(bookmarks);

  return normalizeBookmarks([normalized, ...bookmarks]);
}

export function removeBookmark(bookmarks: readonly DocumentBookmark[], target: DocumentBookmark): DocumentBookmark[] {
  const identity = bookmarkIdentity(target);
  return normalizeBookmarks(bookmarks).filter((bookmark) => bookmarkIdentity(bookmark) !== identity);
}

export function loadBookmarks(): DocumentBookmark[] {
  try {
    const raw = localStorage.getItem(bookmarksStorageKey);
    return raw
      ? normalizeBookmarks(JSON.parse(raw) as unknown).filter((bookmark) => !isTemporaryBrowserBookmark(bookmark))
      : [];
  } catch {
    return [];
  }
}

export function saveBookmarks(bookmarks: readonly DocumentBookmark[]): void {
  try {
    const persistable = normalizeBookmarks(bookmarks).filter((bookmark) => !isTemporaryBrowserBookmark(bookmark));
    localStorage.setItem(bookmarksStorageKey, JSON.stringify(persistable));
  } catch {
    // The current session still owns the in-memory list when storage is unavailable.
  }
}

function isTemporaryBrowserBookmark(bookmark: DocumentBookmark): boolean {
  return bookmark.path.toLowerCase().startsWith("browser://");
}
