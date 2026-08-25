import { describe, expect, it } from "vitest";
import { checkMarkdownEditorSafety } from "./markdown-editor-support";

describe("Markdown WYSIWYG safety", () => {
  it("allows ordinary Markdown and wiki links", () => {
    expect(checkMarkdownEditorSafety("# Title\n\n[[Next note]]\n\n- item").safe).toBe(true);
  });

  it("falls back for syntax the first editor slice cannot round-trip", () => {
    expect(checkMarkdownEditorSafety("---\ntags: [one]\n---\n# Note").safe).toBe(false);
    expect(checkMarkdownEditorSafety("![[image.png]]").safe).toBe(false);
    expect(checkMarkdownEditorSafety("$x^2$\n\n$$y$$").safe).toBe(false);
    expect(checkMarkdownEditorSafety("<mark>important</mark>").safe).toBe(false);
    expect(checkMarkdownEditorSafety("Paragraph ^block-id").safe).toBe(false);
  });
});
