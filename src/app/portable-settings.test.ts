import { describe, expect, it } from "vitest";
import { defaultReaderPreferences } from "./preferences";
import { createPortableSettingsBundle, parsePortableSettings, serializePortableSettings } from "./portable-settings";

const input = {
  preferences: { ...defaultReaderPreferences, readingScale: "large" as const },
  locale: "en-US" as const,
  theme: "dark" as const,
  workspacePath: "C:/Notes",
  lastDocumentPath: "C:/Notes/today.md",
  mountedWorkspaces: [
    { path: "C:/Notes", name: "Notes" },
    { path: "c:\\notes", name: "Duplicate" },
  ],
  workspaceSessions: [
    {
      path: "C:/Notes",
      tabs: [{ path: "C:/Notes/today.md", name: "today.md" }],
      activeDocumentPath: "C:/Notes/today.md",
    },
  ],
  openTabs: [{ path: "C:/Notes/today.md", name: "today.md" }],
  readingPositions: [
    { path: "C:/Notes/today.md", top: 420.6 },
    { path: "c:\\notes\\TODAY.md", top: 12 },
    { path: "C:/Notes/guide.md", top: 80 },
  ],
  bookmarks: [
    { path: "C:/Notes/today.md", headingId: "overview", createdAt: 1 },
    { path: "browser://preview.md", headingId: "temporary", createdAt: 2 },
  ],
};

describe("portable settings", () => {
  it("round-trips preferences and workspace metadata without document bodies", () => {
    const serialized = serializePortableSettings(createPortableSettingsBundle(input));
    const parsed = parsePortableSettings(serialized);

    expect(parsed.preferences.readingScale).toBe("large");
    expect(parsed.locale).toBe("en-US");
    expect(parsed.theme).toBe("dark");
    expect(parsed.mountedWorkspaces).toEqual([{ path: "C:/Notes", name: "Notes" }]);
    expect(parsed.workspaceSessions[0]?.tabs).toEqual([{ path: "C:/Notes/today.md", name: "today.md" }]);
    expect(parsed.readingPositions).toEqual([
      { path: "C:/Notes/today.md", top: 421 },
      { path: "C:/Notes/guide.md", top: 80 },
    ]);
    expect(parsed.bookmarks).toEqual([{ path: "C:/Notes/today.md", headingId: "overview", createdAt: 1 }]);
    expect(parsed.version).toBe(2);
    expect(serialized).not.toContain("正文");
  });

  it("rejects unknown formats and safely drops malformed metadata", () => {
    expect(() => parsePortableSettings(JSON.stringify({ format: "other", version: 1 }))).toThrow("版本不受支持");

    const parsed = parsePortableSettings(
      JSON.stringify({
        format: "moyang-reader-settings",
        version: 1,
        preferences: { allowRemoteResources: true },
        mountedWorkspaces: [
          { path: "C:/Notes", name: "Notes" },
          { path: "", name: "bad" },
        ],
        openTabs: [{ path: "browser://temporary.md", name: "temporary.md" }],
      }),
    );

    expect(parsed.preferences.allowRemoteResources).toBe(true);
    expect(parsed.mountedWorkspaces).toEqual([{ path: "C:/Notes", name: "Notes" }]);
    expect(parsed.openTabs).toEqual([]);
    expect(parsed.readingPositions).toEqual([]);
    expect(parsed.bookmarks).toEqual([]);
    expect(parsed.version).toBe(1);
  });

  it("clips and normalizes v2 reading positions while preserving v1 compatibility", () => {
    const parsed = parsePortableSettings(
      JSON.stringify({
        format: "moyang-reader-settings",
        version: 2,
        preferences: defaultReaderPreferences,
        readingPositions: [
          { path: "C:/Notes/first.md", top: 12.4 },
          { path: "c:\\notes\\FIRST.md", top: 99 },
          { path: "", top: 1 },
          { path: "C:/Notes/not-a-number.md", top: "20" },
          ...Array.from({ length: 40 }, (_, index) => ({ path: `C:/Notes/${index + 2}.md`, top: index })),
        ],
        bookmarks: [],
      }),
    );

    expect(parsed.readingPositions).toHaveLength(32);
    expect(parsed.readingPositions[0]).toEqual({ path: "C:/Notes/first.md", top: 12 });
    expect(parsed.readingPositions.some((item) => item.path === "C:/Notes/not-a-number.md")).toBe(false);
  });
});
