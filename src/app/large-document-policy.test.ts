import { describe, expect, it } from "vitest";
import {
  createSourceOnlyRenderedDocument,
  isLargeMarkdownDocument,
  LARGE_DOCUMENT_SOURCE_MODE_THRESHOLD_BYTES,
  utf8ByteLength,
} from "./large-document-policy";

describe("large document policy", () => {
  it("keeps the threshold explicit and only applies it to Markdown", () => {
    expect(LARGE_DOCUMENT_SOURCE_MODE_THRESHOLD_BYTES).toBe(512 * 1024);
    expect(isLargeMarkdownDocument("markdown", LARGE_DOCUMENT_SOURCE_MODE_THRESHOLD_BYTES)).toBe(true);
    expect(isLargeMarkdownDocument("text", LARGE_DOCUMENT_SOURCE_MODE_THRESHOLD_BYTES)).toBe(false);
    expect(isLargeMarkdownDocument("markdown", LARGE_DOCUMENT_SOURCE_MODE_THRESHOLD_BYTES - 1)).toBe(false);
  });

  it("uses UTF-8 byte size rather than JavaScript character count", () => {
    expect(utf8ByteLength("中文")).toBe(6);
  });

  it("keeps a large document render payload empty while retaining source metrics", () => {
    expect(createSourceOnlyRenderedDocument("a".repeat(5_001))).toEqual({
      html: "",
      toc: [],
      wordCount: 5_001,
      readingMinutes: 2,
    });
  });
});
