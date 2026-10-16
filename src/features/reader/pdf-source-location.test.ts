import { describe, expect, it } from "vitest";
import { textChunks } from "../documents/source-chunks";
import { relocatePdfSource } from "./pdf-source-location";

describe("PDF source changes", () => {
  const original = { path: "a.pdf", hash: "old", page: 2, quote: "unique evidence" };
  it("keeps unchanged physical pages and relocates unique evidence after an inserted page", () => {
    expect(relocatePdfSource(original, "old", []).page).toBe(2);
    expect(relocatePdfSource(original, "new", textChunks("a.pdf", "unique evidence", "new", 3))).toEqual({
      status: "moved",
      page: 3,
    });
  });
  it("reports removed and ambiguous evidence without asserting a new page", () => {
    expect(relocatePdfSource(original, "new", [])).toEqual({ status: "missing" });
    expect(
      relocatePdfSource(original, "new", [
        ...textChunks("a.pdf", "unique evidence", "new", 2),
        ...textChunks("a.pdf", "unique evidence", "new", 3),
      ]),
    ).toEqual({ status: "ambiguous" });
    expect(
      relocatePdfSource(original, "new", textChunks("a.pdf", "unique evidence and unique evidence", "new", 2)),
    ).toEqual({ status: "ambiguous" });
  });
  it("requires verification when a page-only annotation's fingerprint changed", () => {
    expect(relocatePdfSource({ ...original, quote: undefined }, "new", [])).toEqual({ status: "changed" });
  });
  it("does not mistake overlapping index chunks for duplicate evidence", () => {
    const text = "x".repeat(1020) + "unique evidence" + "y".repeat(200);
    expect(relocatePdfSource(original, "new", textChunks("a.pdf", text, "new", 4))).toEqual({
      status: "moved",
      page: 4,
    });
  });
  it("keeps exact trimmed offsets and evidence spanning an overlap boundary", () => {
    const text = "   " + "x".repeat(1107) + "unique evidence" + "y".repeat(200);
    const chunks = textChunks("a.pdf", text, "new", 5);
    for (const chunk of chunks)
      expect(text.slice(chunk.location.offset!, chunk.location.offset! + chunk.text.length)).toBe(chunk.text);
    expect(relocatePdfSource(original, "new", chunks)).toEqual({ status: "moved", page: 5 });
  });
});
