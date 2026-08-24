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
  });
});
