import { describe, expect, it } from "vitest";
import { normalizePathKey } from "./path-key";

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
