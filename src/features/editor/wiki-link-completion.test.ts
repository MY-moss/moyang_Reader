import { describe, expect, it } from "vitest";
import {
  buildWikiLinkCandidates,
  filterWikiLinkCandidates,
  formatWikiLinkInsert,
  matchWikiLinkTrigger,
  nextWikiCompletionIndex,
  wikiCompletionKeyAction,
} from "./wiki-link-completion";

describe("buildWikiLinkCandidates", () => {
  it("derives markdown candidates without file extensions", () => {
    const candidates = buildWikiLinkCandidates([
      { name: "Reading notes.md", relativePath: "notes/Reading notes.md", kind: "markdown" },
      { name: "draft.txt", relativePath: "draft.txt", kind: "text" },
    ]);

    expect(candidates).toEqual([{ value: "Reading notes", label: "Reading notes", detail: "notes/Reading notes.md" }]);
  });

  it("keeps duplicate names distinguishable by path and excludes the current document", () => {
    const candidates = buildWikiLinkCandidates(
      [
        { name: "index.md", relativePath: "a/index.md", kind: "markdown" },
        { name: "index.md", relativePath: "b/index.md", kind: "markdown" },
      ],
      "b/index.md",
    );

    expect(candidates).toEqual([{ value: "index", label: "index", detail: "a/index.md" }]);
  });

  it("excludes the current document by absolute path", () => {
    const candidates = buildWikiLinkCandidates(
      [
        { name: "current.md", path: "C:/Notes/current.md", relativePath: "current.md", kind: "markdown" },
        { name: "other.md", path: "C:/Notes/other.md", relativePath: "other.md", kind: "markdown" },
      ],
      "C:/Notes/current.md",
    );

    expect(candidates.map((candidate) => candidate.value)).toEqual(["other"]);
  });

  it("supports files without an explicit kind by checking extensions", () => {
    const candidates = buildWikiLinkCandidates([{ name: "legacy.markdown" }]);

    expect(candidates).toEqual([{ value: "legacy", label: "legacy" }]);
  });
});

describe("matchWikiLinkTrigger", () => {
  it("captures the query after an open wiki link", () => {
    expect(matchWikiLinkTrigger("参见 [[Rea")).toEqual({ query: "Rea" });
    expect(matchWikiLinkTrigger("Plain text")).toBeNull();
  });

  it("stops after a pipe, closing bracket or newline", () => {
    expect(matchWikiLinkTrigger("[[Note|Alias")).toBeNull();
    expect(matchWikiLinkTrigger("[[Note]] more")).toBeNull();
    expect(matchWikiLinkTrigger("[[No\n")).toBeNull();
  });
});

describe("filterWikiLinkCandidates", () => {
  const candidates = [
    { value: "Reading list", label: "Reading list" },
    { value: "Notes", label: "Notes", detail: "folder/Notes.md" },
    { value: "reading-room", label: "reading-room", detail: "rooms/reading-room.md" },
  ];

  it("ranks prefix matches before substring matches", () => {
    const filtered = filterWikiLinkCandidates(candidates, "read");

    expect(filtered.map((candidate) => candidate.value)).toEqual(["Reading list", "reading-room"]);
  });

  it("matches case-insensitively on label and detail", () => {
    expect(filterWikiLinkCandidates(candidates, "folder/")[0]?.value).toBe("Notes");
  });

  it("returns a bounded list for an empty query", () => {
    const many = Array.from({ length: 20 }, (_, index) => ({ value: `note-${index}`, label: `note-${index}` }));
    const filtered = filterWikiLinkCandidates(many, "");

    expect(filtered).toHaveLength(8);
  });
});

describe("wiki completion keyboard mapping", () => {
  it("maps overlay keys to actions", () => {
    expect(wikiCompletionKeyAction("ArrowDown")).toBe("next");
    expect(wikiCompletionKeyAction("ArrowUp")).toBe("previous");
    expect(wikiCompletionKeyAction("Enter")).toBe("accept");
    expect(wikiCompletionKeyAction("Tab")).toBe("accept");
    expect(wikiCompletionKeyAction("Escape")).toBe("dismiss");
    expect(wikiCompletionKeyAction("a")).toBeNull();
  });

  it("wraps the active index in both directions", () => {
    expect(nextWikiCompletionIndex(0, 3, "next")).toBe(1);
    expect(nextWikiCompletionIndex(2, 3, "next")).toBe(0);
    expect(nextWikiCompletionIndex(0, 3, "previous")).toBe(2);
    expect(nextWikiCompletionIndex(1, 0, "next")).toBe(0);
  });
});

describe("formatWikiLinkInsert", () => {
  it("builds a complete wiki link from a candidate", () => {
    expect(formatWikiLinkInsert({ value: "Reading notes", label: "Reading notes" })).toBe("[[Reading notes]]");
  });
});
