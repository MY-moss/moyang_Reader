import { describe, expect, it } from "vitest";
import { nextReaderModeAfterOpen } from "./reader-mode";

describe("reader mode after opening a document", () => {
  it("opens editable documents directly and keeps binary documents in reading mode", () => {
    expect(nextReaderModeAfterOpen("rendered", false, "markdown")).toBe("wysiwyg");
    expect(nextReaderModeAfterOpen("rendered", false, "text")).toBe("source");
    expect(nextReaderModeAfterOpen("rendered", false, "pdf")).toBe("rendered");
  });

  it("reads unsupported editing syntax without mutating its source", () => {
    expect(nextReaderModeAfterOpen("rendered", false, "markdown", false)).toBe("source");
  });

  it("preserves the current mode when reloading a document", () => {
    expect(nextReaderModeAfterOpen("source", true, "markdown")).toBe("source");
    expect(nextReaderModeAfterOpen("wysiwyg", true, "markdown")).toBe("wysiwyg");
    expect(nextReaderModeAfterOpen("rendered", true, "markdown")).toBe("rendered");
    expect(nextReaderModeAfterOpen("wysiwyg", true, "markdown", false)).toBe("source");
  });
});
