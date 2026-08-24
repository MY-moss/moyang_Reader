import { describe, expect, it } from "vitest";
import { estimatePrintPageCount, printPageContentHeightPx } from "./print-preview";

describe("print preview pagination helpers", () => {
  it("estimates a document at the page boundary without returning zero", () => {
    const pageHeight = printPageContentHeightPx("a4", "portrait", "standard");

    expect(estimatePrintPageCount(pageHeight - 1, "a4", "portrait", "standard")).toBe(1);
    expect(estimatePrintPageCount(pageHeight, "a4", "portrait", "standard")).toBe(1);
    expect(estimatePrintPageCount(pageHeight + 1, "a4", "portrait", "standard")).toBe(2);
  });

  it("accounts for orientation and margin choices", () => {
    const portrait = printPageContentHeightPx("a4", "portrait", "standard");
    const landscape = printPageContentHeightPx("a4", "landscape", "standard");
    const compact = printPageContentHeightPx("a4", "portrait", "compact");
    const wide = printPageContentHeightPx("a4", "portrait", "wide");

    expect(landscape).toBeLessThan(portrait);
    expect(compact).toBeGreaterThan(portrait);
    expect(wide).toBeLessThan(portrait);
  });

  it("returns null for missing or invalid layout measurements", () => {
    expect(estimatePrintPageCount(0, "a4", "portrait", "standard")).toBeNull();
    expect(estimatePrintPageCount(Number.NaN, "a4", "portrait", "standard")).toBeNull();
  });
});
