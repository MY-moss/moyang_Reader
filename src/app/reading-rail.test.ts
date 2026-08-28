import { describe, expect, it } from "vitest";
import { readingHeadingFromElement, readingProgressPercent } from "./reading-rail";

describe("reading rail helpers", () => {
  it("reads a non-empty heading without changing its anchor", () => {
    const heading = document.createElement("h2");
    heading.id = "chapter-two";
    heading.textContent = "  Chapter two  ";

    expect(readingHeadingFromElement(heading)).toEqual({ id: "chapter-two", text: "Chapter two" });
  });

  it("ignores empty headings and clamps progress to integer percentages", () => {
    const heading = document.createElement("h2");
    expect(readingHeadingFromElement(heading)).toBeNull();
    expect(readingProgressPercent(-1)).toBe(0);
    expect(readingProgressPercent(0.246)).toBe(25);
    expect(readingProgressPercent(2)).toBe(100);
    expect(readingProgressPercent(Number.NaN)).toBe(0);
  });
});
