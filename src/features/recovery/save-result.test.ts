import { expect, it } from "vitest";
import type { OpenDocument } from "../../shared/types";
import { completeDocumentSave } from "./save-result";
const doc: OpenDocument = {
  path: "C:/note.md",
  name: "note.md",
  kind: "markdown",
  source: "old",
  modified: true,
  externallyModified: false,
  rendered: { html: "old", toc: [], wordCount: 3, readingMinutes: 1 },
};
it("keeps edits typed during a pending disk save dirty", () => {
  const next = completeDocumentSave(doc, doc, "written", "typed later", { ...doc.rendered, html: "written" });
  expect(next?.source).toBe("written");
  expect(next?.modified).toBe(true);
  expect(next?.rendered.html).toBe("old");
});
it("does not replace a newly opened or externally reloaded document", () => {
  const other = { ...doc, path: "C:/other.md" };
  expect(completeDocumentSave(other, doc, "written", "written", doc.rendered)).toBe(other);
  const reloaded = { ...doc, source: "external" };
  expect(completeDocumentSave(reloaded, doc, "written", "written", doc.rendered)).toBe(reloaded);
  expect(completeDocumentSave(doc, doc, "written", "written", doc.rendered)?.modified).toBe(false);
});
