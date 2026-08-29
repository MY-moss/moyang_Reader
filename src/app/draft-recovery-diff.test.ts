import { describe, expect, it } from "vitest";
import { buildDraftComparison } from "./draft-recovery-diff";

describe("draft recovery diff", () => {
  it("summarizes added and removed lines around a changed section", () => {
    const comparison = buildDraftComparison("# Note\n\n原始内容\n\n结尾", "# Note\n\n更新内容\n新增一行\n\n结尾");

    expect(comparison).toMatchObject({
      hasChanges: true,
      baselineLineCount: 5,
      draftLineCount: 6,
      addedLineCount: 2,
      removedLineCount: 1,
      characterDelta: 5,
      truncated: false,
    });
    expect(comparison.preview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "removed", text: "原始内容" }),
        expect.objectContaining({ kind: "added", text: "更新内容" }),
        expect.objectContaining({ kind: "added", text: "新增一行" }),
      ]),
    );
  });

  it("normalizes line endings and reports no changes for equivalent sources", () => {
    expect(buildDraftComparison("one\r\ntwo\r\n", "one\ntwo")).toMatchObject({
      hasChanges: false,
      baselineLineCount: 2,
      draftLineCount: 2,
      addedLineCount: 0,
      removedLineCount: 0,
      characterDelta: 0,
      preview: [],
    });
  });

  it("caps long previews while retaining the change summary", () => {
    const baseline = Array.from({ length: 100 }, (_, index) => `原文 ${index}`).join("\n");
    const draft = Array.from({ length: 100 }, (_, index) => `草稿 ${index}`).join("\n");
    const comparison = buildDraftComparison(baseline, draft);

    expect(comparison.truncated).toBe(true);
    expect(comparison.preview.some((line) => line.kind === "notice")).toBe(true);
    expect(comparison.preview.length).toBeLessThanOrEqual(80);
    expect(comparison.addedLineCount).toBe(100);
    expect(comparison.removedLineCount).toBe(100);
  });
});
