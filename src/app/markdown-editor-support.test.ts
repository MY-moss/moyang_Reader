import { describe, expect, it } from "vitest";
import { checkMarkdownEditorSafety, createEditorSourceSyncTracker } from "./markdown-editor-support";

describe("Markdown WYSIWYG safety", () => {
  it("allows ordinary Markdown and wiki links", () => {
    expect(checkMarkdownEditorSafety("# Title\n\n[[Next note]]\n\n- item").safe).toBe(true);
  });

  it("allows the GFM structures supported by the WYSIWYG preset", () => {
    const gfm = [
      "# GFM",
      "",
      "- [ ] todo",
      "- [x] done",
      "",
      "~~deleted~~",
      "",
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "",
      "Footnote[^1].",
      "",
      "[^1]: footnote text",
      "",
      "<https://example.com>",
    ].join("\n");

    expect(checkMarkdownEditorSafety(gfm)).toEqual({ safe: true });
  });

  it("falls back for syntax the first editor slice cannot round-trip", () => {
    expect(checkMarkdownEditorSafety("---\ntags: [one]\n---\n# Note").safe).toBe(false);
    expect(checkMarkdownEditorSafety("+++\ntitle = 'Note'\n+++\n# Note").safe).toBe(false);
    expect(checkMarkdownEditorSafety("![[image.png]]").safe).toBe(false);
    expect(checkMarkdownEditorSafety("$x^2$\n\n$$y$$").safe).toBe(false);
    expect(checkMarkdownEditorSafety("The value is $x^2$.").safe).toBe(false);
    expect(checkMarkdownEditorSafety("Inline \\(x^2\\)").safe).toBe(false);
    expect(checkMarkdownEditorSafety("<mark>important</mark>").safe).toBe(false);
    expect(checkMarkdownEditorSafety("Keep <mark>important</mark>.").safe).toBe(false);
    expect(checkMarkdownEditorSafety("> [!NOTE]\n> Keep this context.").safe).toBe(false);
    expect(checkMarkdownEditorSafety("Paragraph ^block-id").safe).toBe(false);
  });

  it("does not reapply the source emitted by the local editor", () => {
    const tracker = createEditorSourceSyncTracker("# Draft");

    tracker.markEditorSource("# Draft\n\nLocal edit");

    expect(tracker.shouldApplyExternalSource("# Draft\n\nLocal edit")).toBe(false);
  });

  it("applies an external source once and then treats it as the new baseline", () => {
    const tracker = createEditorSourceSyncTracker("# Draft");

    expect(tracker.shouldApplyExternalSource("# Changed externally")).toBe(true);
    expect(tracker.shouldApplyExternalSource("# Changed externally")).toBe(false);
  });
});
