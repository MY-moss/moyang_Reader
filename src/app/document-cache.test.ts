import { describe, expect, it } from "vitest";
import { DocumentCache } from "./document-cache";
import type { CachedDocument } from "./document-cache";

function document(path: string, size = 10, modifiedMs: number | null = 1, source = "# Note"): CachedDocument {
  return {
    path,
    name: path.split(/[\\/]/).pop() ?? path,
    kind: "markdown",
    source,
    rendered: {
      html: `<h1>${source}</h1>`,
      toc: [],
      wordCount: 1,
      readingMinutes: 1,
    },
    stamp: { size, modifiedMs },
  };
}

describe("DocumentCache", () => {
  it("returns a matching document and rejects a stale stamp", () => {
    const cache = new DocumentCache();
    cache.set(document("C:\\Notes\\Today.md"));

    expect(cache.get("c:/notes/today.md", { size: 10, modifiedMs: 1 })?.source).toBe("# Note");
    expect(cache.get("C:\\Notes\\Today.md", { size: 11, modifiedMs: 1 })).toBeNull();
    expect(cache.size).toBe(0);
  });

  it("promotes hits and evicts the least recently used entry", () => {
    const cache = new DocumentCache(2);
    cache.set(document("C:\\Notes\\one.md"));
    cache.set(document("C:\\Notes\\two.md"));
    expect(cache.get("C:\\Notes\\one.md", { size: 10, modifiedMs: 1 })).not.toBeNull();

    cache.set(document("C:\\Notes\\three.md"));

    expect(cache.get("C:\\Notes\\two.md", { size: 10, modifiedMs: 1 })).toBeNull();
    expect(cache.get("C:\\Notes\\one.md", { size: 10, modifiedMs: 1 })).not.toBeNull();
    expect(cache.get("C:\\Notes\\three.md", { size: 10, modifiedMs: 1 })).not.toBeNull();
  });

  it("invalidates a file and all cached descendants of a changed folder", () => {
    const cache = new DocumentCache();
    cache.set(document("C:\\Notes\\one.md"));
    cache.set(document("C:\\Notes\\sub\\two.md"));
    cache.set(document("C:\\NotesArchive\\keep.md"));

    cache.invalidate(["c:/notes"]);

    expect(cache.get("C:\\Notes\\one.md", { size: 10, modifiedMs: 1 })).toBeNull();
    expect(cache.get("C:\\Notes\\sub\\two.md", { size: 10, modifiedMs: 1 })).toBeNull();
    expect(cache.get("C:\\NotesArchive\\keep.md", { size: 10, modifiedMs: 1 })).not.toBeNull();
  });

  it("does not retain a single entry over the memory budget", () => {
    const cache = new DocumentCache(32, 1024);
    cache.set({ ...document("C:\\Notes\\large.md"), bytes: new Uint8Array(1) });

    expect(cache.size).toBe(0);
    expect(cache.bytes).toBe(0);
  });
});
