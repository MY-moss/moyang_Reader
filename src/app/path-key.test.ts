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
});
