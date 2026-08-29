export type EditorInsertKind = "link" | "wikilink" | "image" | "table";

export type EditorInsertRequest =
  | { kind: "link"; label: string; href: string; title?: string }
  | { kind: "wikilink"; target: string; alias?: string }
  | { kind: "image"; src: string; alt: string; title?: string }
  | { kind: "table"; rows: number; columns: number };

export type MarkdownInsertionResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

export type MarkdownTable = {
  markdown: string;
  rows: number;
  columns: number;
  firstCellOffset: number;
};

export const MIN_TABLE_DIMENSION = 2;
export const MAX_TABLE_DIMENSION = 8;
export const DEFAULT_TABLE_DIMENSION = 3;

function cleanSingleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function escapeLabel(value: string): string {
  return cleanSingleLine(value).replace(/\\/g, "\\\\").replace(/\]/g, "\\]");
}

function safeDestination(value: string): string | null {
  const destination = cleanSingleLine(value);
  if (!destination || /^(?:javascript|vbscript|data):/i.test(destination)) return null;
  return destination;
}

function optionalTitle(value: string | undefined): string {
  const title = value ? cleanSingleLine(value).replace(/"/g, '\\"') : "";
  return title ? ` "${title}"` : "";
}

export function buildMarkdownLink(label: string, href: string, title?: string): string | null {
  const safeLabel = escapeLabel(label);
  const destination = safeDestination(href);
  if (!safeLabel || !destination) return null;
  return `[${safeLabel}](${destination}${optionalTitle(title)})`;
}

export function buildMarkdownWikiLink(target: string, alias?: string): string | null {
  const cleanTarget = cleanSingleLine(target).replace(/\]\]/g, "");
  const cleanAlias = alias ? cleanSingleLine(alias).replace(/\\/g, "").replace(/\]/g, "").replace(/\|/g, "｜") : "";
  if (!cleanTarget) return null;
  return cleanAlias ? `[[${cleanTarget}|${cleanAlias}]]` : `[[${cleanTarget}]]`;
}

export function buildMarkdownImage(src: string, alt: string, title?: string): string | null {
  const destination = safeDestination(src);
  const safeAlt = escapeLabel(alt);
  if (!destination) return null;
  return `![${safeAlt}](${destination}${optionalTitle(title)})`;
}

export function normalizeTableDimension(value: number | string, fallback = DEFAULT_TABLE_DIMENSION): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  const safeFallback = Number.isFinite(fallback) ? Math.round(fallback) : DEFAULT_TABLE_DIMENSION;
  const candidate = Number.isFinite(parsed) ? Math.round(parsed) : safeFallback;
  return Math.min(MAX_TABLE_DIMENSION, Math.max(MIN_TABLE_DIMENSION, candidate));
}

export function buildMarkdownTable(
  rowsInput = DEFAULT_TABLE_DIMENSION,
  columnsInput = DEFAULT_TABLE_DIMENSION,
): MarkdownTable {
  const rows = normalizeTableDimension(rowsInput);
  const columns = normalizeTableDimension(columnsInput);
  const headers = Array.from({ length: columns }, (_, index) => `列 ${index + 1}`);
  const separator = Array.from({ length: columns }, () => "---");
  const body = Array.from({ length: rows - 1 }, () => Array.from({ length: columns }, () => ""));
  const formatRow = (cells: string[]) => `| ${cells.join(" | ")} |`;
  const lines = [formatRow(headers), formatRow(separator), ...body.map(formatRow)];
  const markdown = lines.join("\n");
  const firstCellOffset = lines[0].length + 1 + lines[1].length + 1 + 2;
  return { markdown, rows, columns, firstCellOffset };
}

export function replaceMarkdownSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  replacement: string,
  selectionStartOffset = replacement.length,
  selectionEndOffset = selectionStartOffset,
): MarkdownInsertionResult {
  const next = `${value.slice(0, selectionStart)}${replacement}${value.slice(selectionEnd)}`;
  return {
    value: next,
    selectionStart: selectionStart + selectionStartOffset,
    selectionEnd: selectionStart + selectionEndOffset,
  };
}

export function insertMarkdownBlock(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  text: string,
  caretOffset: number,
): MarkdownInsertionResult {
  const needsLeadingBreak = selectionStart > 0 && value[selectionStart - 1] !== "\n";
  const needsTrailingBreak = selectionEnd < value.length && value[selectionEnd] !== "\n";
  const prefix = needsLeadingBreak ? "\n" : "";
  const suffix = needsTrailingBreak ? "\n" : "";
  const replacement = `${prefix}${text}${suffix}`;
  const offset = prefix.length + caretOffset;
  return replaceMarkdownSelection(value, selectionStart, selectionEnd, replacement, offset, offset);
}

export function applyEditorInsert(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  request: EditorInsertRequest,
): MarkdownInsertionResult | null {
  switch (request.kind) {
    case "link": {
      const markdown = buildMarkdownLink(request.label, request.href, request.title);
      return markdown ? replaceMarkdownSelection(value, selectionStart, selectionEnd, markdown) : null;
    }
    case "wikilink": {
      const markdown = buildMarkdownWikiLink(request.target, request.alias);
      return markdown ? replaceMarkdownSelection(value, selectionStart, selectionEnd, markdown) : null;
    }
    case "image": {
      const markdown = buildMarkdownImage(request.src, request.alt, request.title);
      return markdown ? replaceMarkdownSelection(value, selectionStart, selectionEnd, markdown) : null;
    }
    case "table": {
      const table = buildMarkdownTable(request.rows, request.columns);
      return insertMarkdownBlock(value, selectionStart, selectionEnd, table.markdown, table.firstCellOffset);
    }
  }
}
