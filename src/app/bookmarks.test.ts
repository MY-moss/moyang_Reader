import { afterEach, describe, expect, it } from "vitest";

import {
  addBookmark,
  bookmarkIdentity,
  createBookmark,
  hasBookmark,
  loadBookmarks,
  MAX_BOOKMARKS,
  normalizeBookmarks,
  removeBookmark,
  saveBookmarks,
} from "./bookmarks";

afterEach(() => localStorage.clear());

describe("document bookmarks", () => {
  it("normalizes Windows paths and keeps the newest bookmark first", () => {
    const first = createBookmark("C:/Vault/Note.md", { headingId: "intro", createdAt: 1 });
    const replacement = createBookmark("c:\\vault\\NOTE.md", { headingId: "intro", createdAt: 2 });

    const bookmarks = addBookmark([first], replacement);

    expect(bookmarks).toEqual([replacement]);
    expect(hasBookmark(bookmarks, first)).toBe(true);
    expect(bookmarkIdentity(first)).toBe(bookmarkIdentity(replacement));
  });

  it("treats different headings and quotes as separate reading locations", () => {
    const document = createBookmark("C:/Vault/Note.md", { createdAt: 1 });
    const heading = createBookmark("C:/Vault/Note.md", { headingId: "intro", createdAt: 2 });
    const quote = createBookmark("C:/Vault/Note.md", { quote: "important", createdAt: 3 });

    expect(normalizeBookmarks([document, heading, quote])).toHaveLength(3);
  });

  it("removes only the selected location", () => {
    const first = createBookmark("C:/Vault/Note.md", { headingId: "intro", createdAt: 1 });
    const second = createBookmark("C:/Vault/Note.md", { headingId: "next", createdAt: 2 });

    expect(removeBookmark([first, second], first)).toEqual([second]);
  });

  it("ignores malformed data and limits persisted growth", () => {
    const valid = createBookmark("C:/Vault/valid.md", { createdAt: 1 });
    const oversized = Array.from({ length: MAX_BOOKMARKS + 1 }, (_, index) =>
      createBookmark(`C:/Vault/${index}.md`, { createdAt: index + 2 }),
    );

    expect(normalizeBookmarks([null, { path: "", createdAt: 1 }, valid, ...oversized])).toHaveLength(MAX_BOOKMARKS);

    saveBookmarks([valid]);
    expect(loadBookmarks()).toEqual([valid]);
  });

  it("does not persist temporary browser preview locations", () => {
    const preview = createBookmark("browser://1/preview.md", { createdAt: 1 });

    saveBookmarks([preview]);

    expect(loadBookmarks()).toEqual([]);
  });
});
