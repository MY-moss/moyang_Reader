import type { DocumentKind, FileStamp, RenderedMarkdown } from "./types";
import { normalizePathKey } from "./path-key";

export const MAX_DOCUMENT_CACHE_ENTRIES = 32;
export const MAX_DOCUMENT_CACHE_BYTES = 64 * 1024 * 1024;

export type CachedDocument = {
  path: string;
  name: string;
  kind: DocumentKind;
  source: string;
  rendered: RenderedMarkdown;
  stamp: FileStamp;
  bytes?: Uint8Array;
};

function sameStamp(left: FileStamp, right: FileStamp): boolean {
  return left.size === right.size && left.modifiedMs === right.modifiedMs;
}

function estimateEntryBytes(entry: CachedDocument): number {
  const tocTextBytes = entry.rendered.toc.reduce((total, item) => total + item.text.length * 2, 0);
  return (
    1024 + entry.source.length * 2 + entry.rendered.html.length * 2 + tocTextBytes + (entry.bytes?.byteLength ?? 0)
  );
}

/**
 * Small in-memory cache for prepared documents. The cache is intentionally
 * session-only: the file on disk remains the source of truth.
 */
export class DocumentCache {
  private readonly entries = new Map<string, { document: CachedDocument; bytes: number }>();

  private totalBytes = 0;

  public readonly maxEntries: number;

  public readonly maxBytes: number;

  public constructor(maxEntries = MAX_DOCUMENT_CACHE_ENTRIES, maxBytes = MAX_DOCUMENT_CACHE_BYTES) {
    this.maxEntries = Math.max(1, Math.floor(maxEntries));
    this.maxBytes = Math.max(1, Math.floor(maxBytes));
  }

  public get size(): number {
    return this.entries.size;
  }

  public get bytes(): number {
    return this.totalBytes;
  }

  public get(path: string, stamp: FileStamp): CachedDocument | null {
    const key = normalizePathKey(path);
    const entry = this.entries.get(key);
    if (!entry) return null;

    if (!sameStamp(entry.document.stamp, stamp)) {
      this.removeByKey(key);
      return null;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.document;
  }

  public set(document: CachedDocument): void {
    const key = normalizePathKey(document.path);
    this.removeByKey(key);

    const bytes = estimateEntryBytes(document);
    if (bytes > this.maxBytes) return;

    this.entries.set(key, { document, bytes });
    this.totalBytes += bytes;
    this.prune();
  }

  public remove(path: string): CachedDocument | null {
    const key = normalizePathKey(path);
    const entry = this.entries.get(key);
    if (!entry) return null;
    this.removeByKey(key);
    return entry.document;
  }

  /** Invalidate a file or an entire directory subtree after watcher events. */
  public invalidate(paths: readonly string[]): void {
    const scopes = paths.map(normalizePathKey).filter(Boolean);
    if (scopes.length === 0) return;

    for (const key of this.entries.keys()) {
      if (scopes.some((scope) => key === scope || key.startsWith(`${scope}\\`))) {
        this.removeByKey(key);
      }
    }
  }

  public clear(): void {
    this.entries.clear();
    this.totalBytes = 0;
  }

  private removeByKey(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    this.totalBytes -= entry.bytes;
  }

  private prune(): void {
    while (this.entries.size > this.maxEntries || this.totalBytes > this.maxBytes) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) return;
      this.removeByKey(oldestKey);
    }
  }
}
