import type { DocumentKind, OpenDocument, RenderedMarkdown } from "./types";

/**
 * The first desktop benchmark shows that the rich Markdown editor becomes
 * unresponsive before the 1 MB test case can complete. Keep the threshold
 * below that measured failure so opening and editing a large document stays
 * responsive by default.
 */
export const LARGE_DOCUMENT_SOURCE_MODE_THRESHOLD_BYTES = 512 * 1024;

export function utf8ByteLength(source: string): number {
  return new TextEncoder().encode(source).byteLength;
}

export function isLargeMarkdownDocument(kind: DocumentKind, sourceBytes: number): boolean {
  return kind === "markdown" && sourceBytes >= LARGE_DOCUMENT_SOURCE_MODE_THRESHOLD_BYTES;
}

export function isLargeMarkdownOpenDocument(document: Pick<OpenDocument, "kind" | "source" | "sourceBytes">): boolean {
  return isLargeMarkdownDocument(document.kind, document.sourceBytes ?? utf8ByteLength(document.source));
}

/**
 * Large Markdown files remain fully available in the source editor. The
 * rendered payload is deliberately empty until an explicit, future export
 * path asks for rendering, so opening or saving does not parse the whole file.
 */
export function createSourceOnlyRenderedDocument(source: string): RenderedMarkdown {
  return {
    html: "",
    toc: [],
    wordCount: source.length,
    readingMinutes: Math.max(1, Math.ceil(source.length / 5_000)),
  };
}

export const LARGE_DOCUMENT_SOURCE_MODE_NOTICE = "文件较大，已保留源文本模式以避免高开销渲染；可使用编辑器原生查找。";

export const LARGE_DOCUMENT_SOURCE_MODE_BLOCKED_NOTICE =
  "该文件较大，暂不切换到阅读或所见即所得模式，以避免编辑器卡顿。";
