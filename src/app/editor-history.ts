export const MAX_EDITOR_HISTORY_ENTRIES = 100;
export const MAX_EDITOR_HISTORY_BYTES = 8 * 1024 * 1024;
export const EDITOR_HISTORY_GROUP_WINDOW_MS = 400;

export type EditorHistoryState = {
  documentKey: string;
  past: string[];
  present: string;
  future: string[];
  pastBytes: number;
  futureBytes: number;
  lastChangeAt: number | null;
};

export type EditorHistoryChangeOptions = {
  /** Merge with the previous change when it is part of the same typing burst. */
  merge?: boolean;
  /** Injectable clock for deterministic tests and replayable editor behavior. */
  timestamp?: number;
};

function sourceBytes(source: string): number {
  // JavaScript strings are UTF-16; this matches the memory pressure we need to bound.
  return source.length * 2;
}

function trimHistoryBuffers(
  past: string[],
  pastBytes: number,
  future: string[],
  futureBytes: number,
): { past: string[]; pastBytes: number; future: string[]; futureBytes: number } {
  let nextPast = past;
  let nextPastBytes = pastBytes;
  let nextFuture = future;
  let nextFutureBytes = futureBytes;

  while (
    nextPast.length + nextFuture.length > MAX_EDITOR_HISTORY_ENTRIES ||
    nextPastBytes + nextFutureBytes > MAX_EDITOR_HISTORY_BYTES
  ) {
    if (nextPast.length > 0) {
      const removed = nextPast[0];
      nextPast = nextPast.slice(1);
      nextPastBytes -= sourceBytes(removed);
      continue;
    }

    if (nextFuture.length === 0) break;
    const removed = nextFuture[nextFuture.length - 1];
    nextFuture = nextFuture.slice(0, -1);
    nextFutureBytes -= sourceBytes(removed);
  }

  return { past: nextPast, pastBytes: nextPastBytes, future: nextFuture, futureBytes: nextFutureBytes };
}

export function createEditorHistory(documentKey: string, source: string): EditorHistoryState {
  return {
    documentKey,
    past: [],
    present: source,
    future: [],
    pastBytes: 0,
    futureBytes: 0,
    lastChangeAt: null,
  };
}

export function recordEditorChange(
  history: EditorHistoryState,
  nextSource: string,
  options: EditorHistoryChangeOptions = {},
): EditorHistoryState {
  if (history.present === nextSource) return history;

  const timestamp = options.timestamp ?? Date.now();
  const canMerge =
    options.merge === true &&
    history.future.length === 0 &&
    history.lastChangeAt !== null &&
    timestamp >= history.lastChangeAt &&
    timestamp - history.lastChangeAt <= EDITOR_HISTORY_GROUP_WINDOW_MS;
  let past = canMerge ? history.past : [...history.past, history.present];
  let pastBytes = canMerge ? history.pastBytes : history.pastBytes + sourceBytes(history.present);
  const trimmed = trimHistoryBuffers(past, pastBytes, [], 0);
  past = trimmed.past;
  pastBytes = trimmed.pastBytes;

  return {
    ...history,
    past,
    pastBytes,
    present: nextSource,
    future: [],
    futureBytes: 0,
    lastChangeAt: options.merge === true ? timestamp : null,
  };
}

export function undoEditorChange(history: EditorHistoryState): EditorHistoryState {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;

  const past = history.past.slice(0, -1);
  const future = [history.present, ...history.future];
  const trimmed = trimHistoryBuffers(
    past,
    history.pastBytes - sourceBytes(previous),
    future,
    history.futureBytes + sourceBytes(history.present),
  );
  return { ...history, ...trimmed, present: previous, lastChangeAt: null };
}

export function redoEditorChange(history: EditorHistoryState): EditorHistoryState {
  const next = history.future[0];
  if (next === undefined) return history;

  const past = [...history.past, history.present];
  const future = history.future.slice(1);
  const trimmed = trimHistoryBuffers(
    past,
    history.pastBytes + sourceBytes(history.present),
    future,
    history.futureBytes - sourceBytes(next),
  );
  return { ...history, ...trimmed, present: next, lastChangeAt: null };
}

export function canUndoEditorChange(history: EditorHistoryState): boolean {
  return history.past.length > 0;
}

export function canRedoEditorChange(history: EditorHistoryState): boolean {
  return history.future.length > 0;
}
