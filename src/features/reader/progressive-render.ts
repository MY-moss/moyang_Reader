export const PROGRESSIVE_READER_THRESHOLD = 160_000;
export const PROGRESSIVE_READER_CHUNK_SIZE = 32_000;

function serializeNode(node: Node): string {
  if (node.nodeType === 1) return (node as Element).outerHTML;
  return node.textContent ?? "";
}

/**
 * Splits an HTML fragment only at top-level DOM nodes. A block is never cut in
 * the middle, so tables, code blocks and lists keep their original structure.
 */
export function splitHtmlIntoBlocks(html: string, maxChunkCharacters = PROGRESSIVE_READER_CHUNK_SIZE): string[] {
  if (!html || html.length <= maxChunkCharacters || typeof DOMParser === "undefined") return [html];

  const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const nodes = Array.from(parsed.body.childNodes);
  if (nodes.length <= 1) return [html];

  const chunks: string[] = [];
  let current = "";
  for (const node of nodes) {
    const serialized = serializeNode(node);
    if (!serialized) continue;

    if (current && current.length + serialized.length > maxChunkCharacters) {
      chunks.push(current);
      current = "";
    }

    current += serialized;
    if (current.length >= maxChunkCharacters) {
      chunks.push(current);
      current = "";
    }
  }

  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [html];
}

export function shouldUseProgressiveReader(html: string, threshold = PROGRESSIVE_READER_THRESHOLD): boolean {
  return html.length > threshold && typeof DOMParser !== "undefined";
}
