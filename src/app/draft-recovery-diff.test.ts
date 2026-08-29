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

  it("keeps separated edits as separate hunks", () => {
    const comparison = buildDraftComparison(
      "# Note\n\n第一段\n\n保持\n\n中间一\n中间二\n中间三\n中间四\n中间五\n中间六\n中间七\n中间八\n\n第二段\n\n结尾",
      "# Note\n\n第一段修改\n\n保持\n\n中间一\n中间二\n中间三\n中间四\n中间五\n中间六\n中间七\n中间八\n\n第二段\n新增内容\n\n结尾",
    );

    expect(comparison).toMatchObject({
      hasChanges: true,
      addedLineCount: 2,
      removedLineCount: 1,
      changeHunkCount: 2,
      precise: true,
    });
    expect(comparison.preview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "removed", text: "第一段" }),
        expect.objectContaining({ kind: "added", text: "第一段修改" }),
        expect.objectContaining({ kind: "added", text: "新增内容" }),
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

  it("marks a large ambiguous comparison as a fast summary", () => {
    const baseline = Array.from({ length: 250 }, () => "重复行").join("\n");
    const draft = Array.from({ length: 250 }, () => "另一组重复行").join("\n");
    const comparison = buildDraftComparison(baseline, draft);

    expect(comparison.hasChanges).toBe(true);
    expect(comparison.precise).toBe(false);
    expect(comparison.preview.length).toBeLessThanOrEqual(80);
  });
});
