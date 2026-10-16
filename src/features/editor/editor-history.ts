export const MAX_EDITOR_HISTORY_ENTRIES = 100;
export const MAX_EDITOR_HISTORY_BYTES = 16 * 1024 * 1024;
export const MAX_TOTAL_HISTORY_BYTES = 64 * 1024 * 1024;
export function editorHistoryBytes(history: EditorHistoryState): number {
  return [...history.past, ...history.future].reduce((total, text) => total + text.length * 2, 0);
}
export function trimEditorHistory(history: EditorHistoryState, budget = MAX_EDITOR_HISTORY_BYTES): EditorHistoryState {
  let bytes = editorHistoryBytes(history);
  let pastStart = 0,
    futureEnd = history.future.length;
  while (bytes > budget && pastStart < history.past.length) bytes -= history.past[pastStart++].length * 2;
  while (bytes > budget && futureEnd > 0) bytes -= history.future[--futureEnd].length * 2;
  if (!pastStart && futureEnd === history.future.length) return history;
  return {
    ...history,
    past: history.past.slice(pastStart),
    future: history.future.slice(0, futureEnd),
    group: undefined,
  };
}

export type EditorHistoryState = {
  documentKey: string;
  past: string[];
  present: string;
  future: string[];
  group?: { time: number; started: number; position: number; kind: "insert" | "delete" };
};

export function createEditorHistory(documentKey: string, source: string): EditorHistoryState {
  return {
    documentKey,
    past: [],
    present: source,
    future: [],
  };
}

export function recordEditorChange(history: EditorHistoryState, nextSource: string, time?: number): EditorHistoryState {
  if (history.present === nextSource) return history;
  let group: EditorHistoryState["group"];
  let join = false;
  const delta = nextSource.length - history.present.length;
  if (time !== undefined && Math.abs(delta) > 0 && Math.abs(delta) <= 16) {
    let from = 0;
    const end = Math.min(nextSource.length, history.present.length);
    while (from < end && nextSource.charCodeAt(from) === history.present.charCodeAt(from)) from++;
    const inserted = delta > 0 ? nextSource.slice(from, from + delta) : history.present.slice(from, from - delta);
    const simple =
      delta > 0
        ? nextSource.slice(from + delta) === history.present.slice(from)
        : history.present.slice(from - delta) === nextSource.slice(from);
    if (simple && !inserted.includes("\n")) {
      const kind = delta > 0 ? "insert" : "delete";
      const old = history.group;
      join =
        !!old &&
        old.kind === kind &&
        time - old.time < 1000 &&
        time - old.started < 5000 &&
        (from === old.position || (kind === "delete" && from - delta === old.position)) &&
        history.past.length > 0;
      group = { time, started: join ? old!.started : time, position: delta > 0 ? from + delta : from, kind };
    }
  }
  return trimEditorHistory({
    ...history,
    past: join ? history.past : [...history.past, history.present].slice(-MAX_EDITOR_HISTORY_ENTRIES),
    present: nextSource,
    future: [],
    group,
  });
}

export function undoEditorChange(history: EditorHistoryState): EditorHistoryState {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;

  return trimEditorHistory({
    ...history,
    group: undefined,
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  });
}

export function redoEditorChange(history: EditorHistoryState): EditorHistoryState {
  const next = history.future[0];
  if (next === undefined) return history;

  const past = [...history.past, history.present];
  return trimEditorHistory({
    ...history,
    group: undefined,
    past: past.slice(-MAX_EDITOR_HISTORY_ENTRIES),
    present: next,
    future: history.future.slice(1),
  });
}

export function canUndoEditorChange(history: EditorHistoryState): boolean {
  return history.past.length > 0;
}

export function canRedoEditorChange(history: EditorHistoryState): boolean {
  return history.future.length > 0;
}
