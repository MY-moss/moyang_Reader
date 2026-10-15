import { describe, expect, it } from "vitest";
import {
  clipboardAssetFileName,
  clipboardAssetPath,
  clipboardAssetReference,
  insertTextAtSelection,
} from "./clipboard-image";

describe("clipboard image helpers", () => {
  it("creates a timestamped PNG name with a content fingerprint", () => {
    expect(clipboardAssetFileName(Uint8Array.from([1, 2, 3]), new Date(2026, 7, 25, 10, 11, 12))).toBe(
      "20260825-101112-56cf37ab.png",
    );
  });

  it("builds native asset paths while keeping Markdown references portable", () => {
    expect(clipboardAssetPath("C:\\Notes\\Today.md", "clip.png")).toBe("C:\\Notes\\assets\\clip.png");
    expect(clipboardAssetPath("/notes/Today.md", "clip.png")).toBe("/notes/assets/clip.png");
    expect(clipboardAssetReference("clip.png")).toBe("![[assets/clip.png]]");
  });

  it("replaces the selected source range without changing surrounding text", () => {
    expect(insertTextAtSelection("before after", 7, 12, "![[assets/clip.png]]")).toBe("before ![[assets/clip.png]]");
  });
});
