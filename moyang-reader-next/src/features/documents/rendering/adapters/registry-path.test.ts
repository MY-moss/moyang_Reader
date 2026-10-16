import { describe, expect, it } from "vitest";
import { documentAdapterForPath } from "./registry";
describe("document path formats", () => {
  it("recognizes extended Windows paths and literal hash marks in local names", () => {
    expect(documentAdapterForPath("\\\\?\\C:\\Notes\\中文.md")?.kind).toBe("markdown");
    expect(documentAdapterForPath("C:\\Notes\\chapter#1.md")?.kind).toBe("markdown");
    expect(documentAdapterForPath("https://example.com/chapter.md?download=1#heading")?.kind).toBe("markdown");
  });
});
