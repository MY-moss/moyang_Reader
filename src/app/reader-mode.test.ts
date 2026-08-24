import { describe, expect, it } from "vitest";
import { nextReaderModeAfterOpen } from "./reader-mode";

describe("reader mode after opening a document", () => {
  it("defaults new documents to rendered mode", () => {
    expect(nextReaderModeAfterOpen("source", false)).toBe("rendered");
  });

  it("preserves the current mode when reloading a document", () => {
    expect(nextReaderModeAfterOpen("source", true)).toBe("source");
    expect(nextReaderModeAfterOpen("rendered", true)).toBe("rendered");
  });
});
