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
  changeHunkCount: number;
  preview: DraftDiffLine[];
  truncated: boolean;
  precise: boolean;
};

type DiffOperation = {
  kind: "equal" | "added" | "removed";
  text: string;
  lineNumber: number;
};

const MAX_PREVIEW_LINES = 80;
const CONTEXT_LINES = 3;
const MAX_EXACT_DIFF_CELLS = 40_000;

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

function pushOperation(operations: DiffOperation[], operation: DiffOperation): void {
  operations.push(operation);
}

function appendReplacement(
  operations: DiffOperation[],
  baseline: string[],
  draft: string[],
  baselineStart: number,
  baselineEnd: number,
  draftStart: number,
  draftEnd: number,
): void {
  for (let index = baselineStart; index < baselineEnd; index += 1) {
    pushOperation(operations, { kind: "removed", text: baseline[index] ?? "", lineNumber: index + 1 });
  }
  for (let index = draftStart; index < draftEnd; index += 1) {
    pushOperation(operations, { kind: "added", text: draft[index] ?? "", lineNumber: index + 1 });
  }
}

function appendExactDiff(
  operations: DiffOperation[],
  baseline: string[],
  draft: string[],
  baselineStart: number,
  baselineEnd: number,
  draftStart: number,
  draftEnd: number,
): void {
  const baselineLength = baselineEnd - baselineStart;
  const draftLength = draftEnd - draftStart;
  const width = draftLength + 1;
  const table = new Uint32Array((baselineLength + 1) * width);

  for (let baselineIndex = baselineLength - 1; baselineIndex >= 0; baselineIndex -= 1) {
    for (let draftIndex = draftLength - 1; draftIndex >= 0; draftIndex -= 1) {
      const tableIndex = baselineIndex * width + draftIndex;
      if (baseline[baselineStart + baselineIndex] === draft[draftStart + draftIndex]) {
        table[tableIndex] = table[(baselineIndex + 1) * width + draftIndex + 1] + 1;
      } else {
        table[tableIndex] = Math.max(
          table[(baselineIndex + 1) * width + draftIndex],
          table[baselineIndex * width + draftIndex + 1],
        );
      }
    }
  }

  let baselineIndex = 0;
  let draftIndex = 0;
  while (baselineIndex < baselineLength && draftIndex < draftLength) {
    const baselineLine = baseline[baselineStart + baselineIndex] ?? "";
    const draftLine = draft[draftStart + draftIndex] ?? "";
    if (baselineLine === draftLine) {
      pushOperation(operations, {
        kind: "equal",
        text: baselineLine,
        lineNumber: baselineStart + baselineIndex + 1,
      });
      baselineIndex += 1;
      draftIndex += 1;
      continue;
    }

    const removeScore = table[(baselineIndex + 1) * width + draftIndex];
    const addScore = table[baselineIndex * width + draftIndex + 1];
    if (removeScore >= addScore) {
      pushOperation(operations, {
        kind: "removed",
        text: baselineLine,
        lineNumber: baselineStart + baselineIndex + 1,
      });
      baselineIndex += 1;
    } else {
      pushOperation(operations, {
        kind: "added",
        text: draftLine,
        lineNumber: draftStart + draftIndex + 1,
      });
      draftIndex += 1;
    }
  }

  while (baselineIndex < baselineLength) {
    pushOperation(operations, {
      kind: "removed",
      text: baseline[baselineStart + baselineIndex] ?? "",
      lineNumber: baselineStart + baselineIndex + 1,
    });
    baselineIndex += 1;
  }
  while (draftIndex < draftLength) {
    pushOperation(operations, {
      kind: "added",
      text: draft[draftStart + draftIndex] ?? "",
      lineNumber: draftStart + draftIndex + 1,
    });
    draftIndex += 1;
  }
}

function appendGapDiff(
  operations: DiffOperation[],
  baseline: string[],
  draft: string[],
  baselineStart: number,
  baselineEnd: number,
  draftStart: number,
  draftEnd: number,
): boolean {
  let nextBaseline = baselineStart;
  let nextDraft = draftStart;
  while (nextBaseline < baselineEnd && nextDraft < draftEnd && baseline[nextBaseline] === draft[nextDraft]) {
    pushOperation(operations, {
      kind: "equal",
      text: baseline[nextBaseline] ?? "",
      lineNumber: nextBaseline + 1,
    });
    nextBaseline += 1;
    nextDraft += 1;
  }

  let remainingBaselineEnd = baselineEnd;
  let remainingDraftEnd = draftEnd;
  while (
    remainingBaselineEnd > nextBaseline &&
    remainingDraftEnd > nextDraft &&
    baseline[remainingBaselineEnd - 1] === draft[remainingDraftEnd - 1]
  ) {
    remainingBaselineEnd -= 1;
    remainingDraftEnd -= 1;
  }

  const baselineLength = remainingBaselineEnd - nextBaseline;
  const draftLength = remainingDraftEnd - nextDraft;
  if (baselineLength > 0 || draftLength > 0) {
    if (baselineLength * draftLength <= MAX_EXACT_DIFF_CELLS) {
      appendExactDiff(operations, baseline, draft, nextBaseline, remainingBaselineEnd, nextDraft, remainingDraftEnd);
    } else {
      appendReplacement(operations, baseline, draft, nextBaseline, remainingBaselineEnd, nextDraft, remainingDraftEnd);
      for (let index = remainingBaselineEnd; index < baselineEnd; index += 1) {
        pushOperation(operations, { kind: "equal", text: baseline[index] ?? "", lineNumber: index + 1 });
      }
      return false;
    }
  }

  for (let index = remainingBaselineEnd; index < baselineEnd; index += 1) {
    pushOperation(operations, { kind: "equal", text: baseline[index] ?? "", lineNumber: index + 1 });
  }
  return true;
}

function collectUniquePositions(lines: string[]): { positions: Map<string, number>; duplicates: Set<string> } {
  const positions = new Map<string, number>();
  const duplicates = new Set<string>();
  lines.forEach((line, index) => {
    if (positions.has(line)) duplicates.add(line);
    else positions.set(line, index);
  });
  return { positions, duplicates };
}

function selectIncreasingAnchors(
  anchors: Array<{ baselineIndex: number; draftIndex: number }>,
): Array<{ baselineIndex: number; draftIndex: number }> {
  const tails: number[] = [];
  const previous = new Array<number>(anchors.length).fill(-1);

  anchors.forEach((anchor, index) => {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (anchors[tails[middle] ?? 0]?.draftIndex < anchor.draftIndex) low = middle + 1;
      else high = middle;
    }
    previous[index] = low > 0 ? (tails[low - 1] ?? -1) : -1;
    tails[low] = index;
  });

  const selected: Array<{ baselineIndex: number; draftIndex: number }> = [];
  let cursor = tails.at(-1) ?? -1;
  while (cursor >= 0) {
    const anchor = anchors[cursor];
    if (anchor) selected.push(anchor);
    cursor = previous[cursor] ?? -1;
  }
  return selected.reverse();
}

function buildFastOperations(baseline: string[], draft: string[]): { operations: DiffOperation[]; precise: boolean } {
  const baselineUnique = collectUniquePositions(baseline);
  const draftUnique = collectUniquePositions(draft);
  const anchors = Array.from(baselineUnique.positions.entries())
    .filter(([line]) => !baselineUnique.duplicates.has(line) && !draftUnique.duplicates.has(line))
    .map(([line, baselineIndex]) => ({ baselineIndex, draftIndex: draftUnique.positions.get(line) ?? -1 }))
    .filter((anchor) => anchor.draftIndex >= 0)
    .sort((left, right) => left.baselineIndex - right.baselineIndex);
  const selectedAnchors = selectIncreasingAnchors(anchors);
  const operations: DiffOperation[] = [];
  let baselineCursor = 0;
  let draftCursor = 0;
  let precise = true;

  selectedAnchors.forEach((anchor) => {
    precise =
      appendGapDiff(
        operations,
        baseline,
        draft,
        baselineCursor,
        anchor.baselineIndex,
        draftCursor,
        anchor.draftIndex,
      ) && precise;
    pushOperation(operations, {
      kind: "equal",
      text: baseline[anchor.baselineIndex] ?? "",
      lineNumber: anchor.baselineIndex + 1,
    });
    baselineCursor = anchor.baselineIndex + 1;
    draftCursor = anchor.draftIndex + 1;
  });

  precise =
    appendGapDiff(operations, baseline, draft, baselineCursor, baseline.length, draftCursor, draft.length) && precise;
  return { operations, precise };
}

function buildOperations(baseline: string[], draft: string[]): { operations: DiffOperation[]; precise: boolean } {
  if (baseline.length * draft.length <= MAX_EXACT_DIFF_CELLS) {
    const operations: DiffOperation[] = [];
    appendExactDiff(operations, baseline, draft, 0, baseline.length, 0, draft.length);
    return { operations, precise: true };
  }
  return buildFastOperations(baseline, draft);
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

function buildPreview(operations: DiffOperation[]): {
  preview: DraftDiffLine[];
  changeHunkCount: number;
  truncated: boolean;
} {
  const intervals: Array<{ start: number; end: number }> = [];
  let lastChanged = -1;
  let intervalStart = -1;

  operations.forEach((operation, index) => {
    if (operation.kind === "equal") return;
    if (intervalStart < 0 || index - lastChanged > CONTEXT_LINES * 2 + 1) {
      if (intervalStart >= 0) {
        intervals.push({ start: intervalStart, end: Math.min(operations.length, lastChanged + CONTEXT_LINES + 1) });
      }
      intervalStart = Math.max(0, index - CONTEXT_LINES);
    }
    lastChanged = index;
  });
  if (intervalStart >= 0) {
    intervals.push({ start: intervalStart, end: Math.min(operations.length, lastChanged + CONTEXT_LINES + 1) });
  }

  const previewLines: DraftDiffLine[] = [];
  intervals.forEach((interval, intervalIndex) => {
    if (intervalIndex > 0) previewLines.push({ kind: "notice", text: "… 中间内容未变化，已折叠 …" });
    for (let index = interval.start; index < interval.end; index += 1) {
      const operation = operations[index];
      if (!operation) continue;
      previewLines.push({
        kind: operation.kind === "equal" ? "context" : operation.kind,
        text: operation.text,
        lineNumber: operation.lineNumber,
      });
    }
  });

  const limited = limitedPreview(previewLines);
  return { preview: limited.preview, changeHunkCount: intervals.length, truncated: limited.truncated };
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
      changeHunkCount: 0,
      preview: [],
      truncated: false,
      precise: true,
    };
  }

  const { operations, precise } = buildOperations(baselineLines, draftLines);
  const preview = buildPreview(operations);
  const addedLineCount = operations.filter((operation) => operation.kind === "added").length;
  const removedLineCount = operations.filter((operation) => operation.kind === "removed").length;
  return {
    hasChanges: true,
    baselineLineCount: baselineLines.length,
    draftLineCount: draftLines.length,
    addedLineCount,
    removedLineCount,
    characterDelta: comparableDraft.length - comparableBaseline.length,
    changeHunkCount: preview.changeHunkCount,
    preview: preview.preview,
    truncated: preview.truncated,
    precise,
  };
}
