import { Buffer } from "node:buffer";

export const LARGE_DOCUMENT_CASES = Object.freeze([
  Object.freeze({ id: "1mb", fileName: "b02-large-1mb.md", targetBytes: 1 * 1024 * 1024 }),
  Object.freeze({ id: "10mb", fileName: "b02-large-10mb.md", targetBytes: 10 * 1024 * 1024 }),
]);

export function createLargeMarkdown(targetBytes, id) {
  const marker = `\n\nB02_SEARCH_MARKER_${id}\n`;
  const paragraph =
    "This deterministic large-document benchmark keeps ordinary Markdown paragraphs and a stable search marker.\n\n";
  const prefix = `# B02 large document ${id}\n\n`;
  const markerBytes = Buffer.byteLength(marker, "utf8");
  const availableBytes = targetBytes - markerBytes;
  const paragraphBytes = Buffer.byteLength(paragraph, "utf8");
  const prefixBytes = Buffer.byteLength(prefix, "utf8");
  const paragraphCount = Math.ceil(Math.max(0, availableBytes - prefixBytes) / paragraphBytes);
  const source = `${prefix}${paragraph.repeat(paragraphCount)}`;
  return `${source.slice(0, availableBytes)}${marker}`;
}
