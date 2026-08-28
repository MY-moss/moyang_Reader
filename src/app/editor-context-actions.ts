import type { EditorContextAction } from "./editor-context-menu";

export type SourceEditorActionResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

export function formatEditorDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function replaceSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  replacement: string,
  selectionStartOffset = replacement.length,
  selectionEndOffset = selectionStartOffset,
): SourceEditorActionResult {
  const next = `${value.slice(0, selectionStart)}${replacement}${value.slice(selectionEnd)}`;
  return {
    value: next,
    selectionStart: selectionStart + selectionStartOffset,
    selectionEnd: selectionStart + selectionEndOffset,
  };
}

function wrapSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string,
  suffix = prefix,
): SourceEditorActionResult {
  const selected = value.slice(selectionStart, selectionEnd);
  const before = value.slice(Math.max(0, selectionStart - prefix.length), selectionStart);
  const after = value.slice(selectionEnd, selectionEnd + suffix.length);
  if (selected && before === prefix && after === suffix) {
    const next = `${value.slice(0, selectionStart - prefix.length)}${selected}${value.slice(selectionEnd + suffix.length)}`;
    return {
      value: next,
      selectionStart: selectionStart - prefix.length,
      selectionEnd: selectionEnd - prefix.length,
    };
  }
  return replaceSelection(
    value,
    selectionStart,
    selectionEnd,
    `${prefix}${selected}${suffix}`,
    prefix.length,
    prefix.length + selected.length,
  );
}

function lineBounds(value: string, selectionStart: number, selectionEnd: number) {
  const lineStart = value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
  const nextBreak = value.indexOf("\n", Math.max(selectionEnd, selectionStart));
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  return { lineStart, lineEnd };
}

function stripBlockPrefix(line: string): string {
  const indentation = line.match(/^\s*/)?.[0] ?? "";
  return `${indentation}${line.slice(indentation.length).replace(/^(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s?)/, "")}`;
}

function stripInlineFormatting(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1$2")
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1$2");
}

function clearLineFormatting(line: string): string {
  const indentation = line.match(/^\s*/)?.[0] ?? "";
  const body = line.slice(indentation.length);
  const withoutTask = stripBlockPrefix(body).replace(/^\[[ xX]\]\s+/, "");
  return `${indentation}${stripInlineFormatting(withoutTask)}`;
}

function taskListLine(line: string): string {
  const indentation = line.match(/^\s*/)?.[0] ?? "";
  const body = line.slice(indentation.length);
  if (/^(?:[-*+]\s+)?\[[ xX]\]\s+/.test(body)) return line;
  return `${indentation}- [ ] ${stripBlockPrefix(body)}`;
}

function transformLines(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  transform: (line: string, index: number) => string,
): SourceEditorActionResult {
  const { lineStart, lineEnd } = lineBounds(value, selectionStart, selectionEnd);
  const lines = value.slice(lineStart, lineEnd).split("\n");
  const replacement = lines.map(transform).join("\n");
  const next = `${value.slice(0, lineStart)}${replacement}${value.slice(lineEnd)}`;
  return {
    value: next,
    selectionStart: lineStart,
    selectionEnd: lineStart + replacement.length,
  };
}

function insertBlock(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  text: string,
  caretOffset: number,
): SourceEditorActionResult {
  const needsLeadingBreak = selectionStart > 0 && value[selectionStart - 1] !== "\n";
  const needsTrailingBreak = selectionEnd < value.length && value[selectionEnd] !== "\n";
  const prefix = needsLeadingBreak ? "\n" : "";
  const suffix = needsTrailingBreak ? "\n" : "";
  const replacement = `${prefix}${text}${suffix}`;
  const offset = prefix.length + caretOffset;
  return replaceSelection(value, selectionStart, selectionEnd, replacement, offset, offset);
}

export function applySourceEditorAction(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  action: EditorContextAction,
  insertionText?: string,
): SourceEditorActionResult | null {
  switch (action) {
    case "undo":
    case "redo":
    case "cut":
    case "copy":
    case "paste":
    case "select-all":
    case "find-selection":
      return null;
    case "bold":
      return wrapSelection(value, selectionStart, selectionEnd, "**");
    case "italic":
      return wrapSelection(value, selectionStart, selectionEnd, "*");
    case "strike":
      return wrapSelection(value, selectionStart, selectionEnd, "~~");
    case "inline-code":
      return wrapSelection(value, selectionStart, selectionEnd, "`");
    case "paragraph":
      return transformLines(value, selectionStart, selectionEnd, (line) => stripBlockPrefix(line));
    case "heading-1":
      return transformLines(value, selectionStart, selectionEnd, (line) => `# ${stripBlockPrefix(line)}`);
    case "heading-2":
      return transformLines(value, selectionStart, selectionEnd, (line) => `## ${stripBlockPrefix(line)}`);
    case "heading-3":
      return transformLines(value, selectionStart, selectionEnd, (line) => `### ${stripBlockPrefix(line)}`);
    case "bullet-list":
      return transformLines(value, selectionStart, selectionEnd, (line) => `- ${stripBlockPrefix(line)}`);
    case "ordered-list":
      return transformLines(
        value,
        selectionStart,
        selectionEnd,
        (line, index) => `${index + 1}. ${stripBlockPrefix(line)}`,
      );
    case "quote":
      return transformLines(value, selectionStart, selectionEnd, (line) => `> ${stripBlockPrefix(line)}`);
    case "code-block": {
      const selected = value.slice(selectionStart, selectionEnd);
      const text = selected ? `\`\`\`\n${selected.replace(/\n?$/, "")}\n\`\`\`` : "```\n\n```";
      return insertBlock(value, selectionStart, selectionEnd, text, selected ? 4 : 4);
    }
    case "clear-format":
      return transformLines(value, selectionStart, selectionEnd, clearLineFormatting);
    case "task-list":
      return transformLines(value, selectionStart, selectionEnd, taskListLine);
    case "horizontal-rule":
      return insertBlock(value, selectionStart, selectionEnd, "---", 3);
    case "insert-date":
      return replaceSelection(value, selectionStart, selectionEnd, formatEditorDate());
    case "table":
      return insertBlock(
        value,
        selectionStart,
        selectionEnd,
        "| 列 1 | 列 2 | 列 3 |\n| --- | --- | --- |\n|  |  |  |",
        2,
      );
    case "wikilink":
      return replaceSelection(
        value,
        selectionStart,
        selectionEnd,
        insertionText ? `[[${insertionText}]]` : "[[目标笔记]]",
        insertionText ? insertionText.length + 4 : 2,
        insertionText ? insertionText.length + 4 : 2,
      );
    case "image":
      return replaceSelection(
        value,
        selectionStart,
        selectionEnd,
        insertionText ? `![](${insertionText})` : "![](图片路径)",
        insertionText ? insertionText.length + 5 : 4,
        insertionText ? insertionText.length + 5 : 4,
      );
    case "link":
      return null;
  }
}
