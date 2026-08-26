export const MAX_EDITOR_HISTORY_ENTRIES = 100;

export type EditorHistoryState = {
  documentKey: string;
  past: string[];
  present: string;
  future: string[];
};

export function createEditorHistory(documentKey: string, source: string): EditorHistoryState {
  return {
    documentKey,
    past: [],
    present: source,
    future: [],
  };
}

export function recordEditorChange(history: EditorHistoryState, nextSource: string): EditorHistoryState {
  if (history.present === nextSource) return history;

  const past = [...history.past, history.present];
  return {
    ...history,
    past: past.slice(-MAX_EDITOR_HISTORY_ENTRIES),
    present: nextSource,
    future: [],
  };
}

export function undoEditorChange(history: EditorHistoryState): EditorHistoryState {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;

  return {
    ...history,
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoEditorChange(history: EditorHistoryState): EditorHistoryState {
  const next = history.future[0];
  if (next === undefined) return history;

  const past = [...history.past, history.present];
  return {
    ...history,
    past: past.slice(-MAX_EDITOR_HISTORY_ENTRIES),
    present: next,
    future: history.future.slice(1),
  };
}

export function canUndoEditorChange(history: EditorHistoryState): boolean {
  return history.past.length > 0;
}

export function canRedoEditorChange(history: EditorHistoryState): boolean {
  return history.future.length > 0;
}
