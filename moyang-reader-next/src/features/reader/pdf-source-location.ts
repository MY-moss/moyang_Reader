import type { SourceChunk, SourceLocation } from "../../shared/bookroom-types";
import { locateText } from "./source-locator";

export function relocatePdfSource(location: SourceLocation, hash: string, chunks: SourceChunk[]) {
  if (!location.hash || location.hash === hash) return { page: location.page, status: "found" as const };
  if (!location.quote?.trim()) return { status: "changed" as const };
  const pages = new Map<number, SourceChunk[]>();
  for (const chunk of chunks) {
    const page = chunk.location.page;
    if (page) pages.set(page, [...(pages.get(page) ?? []), chunk]);
  }
  const matches: number[] = [];
  for (const [page, parts] of pages) {
    // Remove the indexing chunks' overlap before checking for unique evidence.
    let text = "";
    for (const part of parts) {
      const offset = part.location.offset ?? text.length;
      text += " ".repeat(Math.max(0, offset - text.length)) + part.text.slice(Math.max(0, text.length - offset));
    }
    const found = locateText(text, { ...location, offset: undefined, endOffset: undefined }, false);
    if (found.status === "ambiguous") return { status: "ambiguous" as const };
    if (found.status === "moved") matches.push(page);
  }
  return matches.length === 1
    ? { page: matches[0], status: "moved" as const }
    : { status: matches.length ? ("ambiguous" as const) : ("missing" as const) };
}
