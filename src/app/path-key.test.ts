import { describe, expect, it } from "vitest";
import { isPathWithin, normalizePathKey } from "./path-key";

describe("normalizePathKey", () => {
  it("uses locale-independent casing for Windows-style path keys", () => {
    expect(normalizePathKey("C:/I-NOTES/INDEX.md")).toBe("c:\\i-notes\\index.md");
    expect(normalizePathKey("c:\\i-notes\\index.md")).toBe("c:\\i-notes\\index.md");
  });

  it("collapses repeated separators and a trailing separator", () => {
    expect(normalizePathKey("C:\\\\Notes///")).toBe("c:\\notes");
  });

  it("matches Windows extended-length paths with their display paths", () => {
    expect(normalizePathKey(String.raw`\\?\C:\Notes\index.md`)).toBe(normalizePathKey("C:/Notes/index.md"));
    expect(normalizePathKey(String.raw`\\?\UNC\server\share\index.md`)).toBe(
      normalizePathKey(String.raw`\\server\share\index.md`),
    );
  });
});

describe("isPathWithin", () => {
  it("matches normalized Windows paths and descendants", () => {
    expect(isPathWithin("C:/Notes/Projects/Today.md", "c:\\notes\\projects")).toBe(true);
    expect(isPathWithin(String.raw`\\server\share\Today.md`, String.raw`\\?\UNC\SERVER\SHARE`)).toBe(true);
  });

  it("rejects siblings that only share a textual prefix", () => {
    expect(isPathWithin("C:/NotesArchive/Today.md", "C:/Notes")).toBe(false);
    expect(isPathWithin("C:/Other/Today.md", "C:/Notes")).toBe(false);
  });

  it("does not treat an empty root as a workspace", () => {
    expect(isPathWithin("", "")).toBe(false);
    expect(isPathWithin("C:/Notes/Today.md", "")).toBe(false);
  });
});
