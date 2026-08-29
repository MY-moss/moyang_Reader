export type DraftDiffLineKind = "context" | "added" | "removed" | "notice";

export type DraftDiffLine = {
  kind: DraftDiffLineKind;
  text: string;
  lineNumber?: number;
};

export type DraftComparison = {
  hasChanges: boolean;
  baselineLineCount: number;
  draftLineCount: number;
  addedLineCount: number;
  removedLineCount: number;
  characterDelta: number;
  preview: DraftDiffLine[];
  truncated: boolean;
};

const MAX_PREVIEW_LINES = 80;
const CONTEXT_LINES = 3;

function normalizeSource(source: string): string {
  return source.replace(/\r\n?/g, "\n");
}

function splitLines(source: string): string[] {
  const normalized = normalizeSource(source);
  if (normalized.length === 0) return [];
  const lines = normalized.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

function withoutTerminalLineEnding(source: string): string {
  return source.endsWith("\n") ? source.slice(0, -1) : source;
}

function limitedPreview(lines: DraftDiffLine[]): { preview: DraftDiffLine[]; truncated: boolean } {
  if (lines.length <= MAX_PREVIEW_LINES) return { preview: lines, truncated: false };

  const headCount = Math.floor((MAX_PREVIEW_LINES - 1) / 2);
  const tailCount = MAX_PREVIEW_LINES - headCount - 1;
  const hiddenCount = lines.length - headCount - tailCount;
  return {
    preview: [
      ...lines.slice(0, headCount),
      { kind: "notice", text: `… 已折叠 ${hiddenCount} 行未变化或变更内容 …` },
      ...lines.slice(-tailCount),
    ],
    truncated: true,
  };
}

export function buildDraftComparison(baselineSource: string, draftSource: string): DraftComparison {
  const baseline = normalizeSource(baselineSource);
  const draft = normalizeSource(draftSource);
  const comparableBaseline = withoutTerminalLineEnding(baseline);
  const comparableDraft = withoutTerminalLineEnding(draft);
  const baselineLines = splitLines(baseline);
  const draftLines = splitLines(draft);

  if (comparableBaseline === comparableDraft) {
    return {
      hasChanges: false,
      baselineLineCount: baselineLines.length,
      draftLineCount: draftLines.length,
      addedLineCount: 0,
      removedLineCount: 0,
      characterDelta: 0,
      preview: [],
      truncated: false,
    };
  }

  let prefix = 0;
  while (prefix < baselineLines.length && prefix < draftLines.length && baselineLines[prefix] === draftLines[prefix]) {
    prefix += 1;
  }

  let baselineEnd = baselineLines.length;
  let draftEnd = draftLines.length;
  while (baselineEnd > prefix && draftEnd > prefix && baselineLines[baselineEnd - 1] === draftLines[draftEnd - 1]) {
    baselineEnd -= 1;
    draftEnd -= 1;
  }

  const previewLines: DraftDiffLine[] = [];
  const contextStart = Math.max(0, prefix - CONTEXT_LINES);
  for (let index = contextStart; index < prefix; index += 1) {
    previewLines.push({ kind: "context", text: baselineLines[index] ?? "", lineNumber: index + 1 });
  }
  for (let index = prefix; index < baselineEnd; index += 1) {
    previewLines.push({ kind: "removed", text: baselineLines[index] ?? "", lineNumber: index + 1 });
  }
  for (let index = prefix; index < draftEnd; index += 1) {
    previewLines.push({ kind: "added", text: draftLines[index] ?? "", lineNumber: index + 1 });
  }
  const contextEnd = Math.min(draftLines.length, draftEnd + CONTEXT_LINES);
  for (let index = draftEnd; index < contextEnd; index += 1) {
    previewLines.push({ kind: "context", text: draftLines[index] ?? "", lineNumber: index + 1 });
  }

  const limited = limitedPreview(previewLines);
  return {
    hasChanges: true,
    baselineLineCount: baselineLines.length,
    draftLineCount: draftLines.length,
    addedLineCount: draftEnd - prefix,
    removedLineCount: baselineEnd - prefix,
    characterDelta: comparableDraft.length - comparableBaseline.length,
    preview: limited.preview,
    truncated: limited.truncated,
  };
}
