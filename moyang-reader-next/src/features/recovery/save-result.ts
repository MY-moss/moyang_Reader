import type { OpenDocument, RenderedMarkdown } from "../../shared/types";
import { isSameDocumentPath } from "./document-transition";

/** A disk write acknowledges its snapshot, never input typed while it was pending. */
export function completeDocumentSave(
  latest: OpenDocument | null,
  original: OpenDocument,
  written: string,
  liveDraft: string,
  rendered: RenderedMarkdown,
): OpenDocument | null {
  if (!latest || !isSameDocumentPath(latest.path, original.path) || latest.source !== original.source) return latest;
  const modified = liveDraft !== written;
  return {
    ...latest,
    source: written,
    rendered: modified ? latest.rendered : rendered,
    modified,
    externallyModified: false,
  };
}
