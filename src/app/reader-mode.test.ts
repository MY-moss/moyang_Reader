import { describe, expect, it } from "vitest";
import { nextReaderModeAfterOpen } from "./reader-mode";

describe("reader mode after opening a document", () => {
  it("opens Markdown in the WYSIWYG editor and text in source mode", () => {
    expect(nextReaderModeAfterOpen("rendered", false, "markdown")).toBe("wysiwyg");
    expect(nextReaderModeAfterOpen("rendered", false, "text")).toBe("source");
    expect(nextReaderModeAfterOpen("rendered", false, "pdf")).toBe("rendered");
  });

  it("falls back to source mode when Markdown is not safe for WYSIWYG", () => {
    expect(nextReaderModeAfterOpen("rendered", false, "markdown", false)).toBe("source");
  });

  it("preserves the current mode when reloading a document", () => {
    expect(nextReaderModeAfterOpen("source", true, "markdown")).toBe("source");
    expect(nextReaderModeAfterOpen("wysiwyg", true, "markdown")).toBe("wysiwyg");
    expect(nextReaderModeAfterOpen("rendered", true, "markdown")).toBe("rendered");
    expect(nextReaderModeAfterOpen("wysiwyg", true, "markdown", false)).toBe("source");
  });
});
