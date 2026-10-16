import { useCallback } from "react";
import { isEditableDocument } from "../features/documents/rendering/document-adapters";
import {
  createEditorHistory,
  redoEditorChange,
  undoEditorChange,
  type EditorHistoryState,
} from "../features/editor/editor-history";
import { captureEditorViewport, restoreEditorViewport } from "../features/editor/editor-history-viewport";
import { isSameDocumentPath } from "../features/recovery/document-transition";
import { loadDraftSnapshots, saveDraftSnapshot, type DraftSaveResult } from "../features/recovery/draft-recovery";
import { DraftFlushOutcome, focusEditorSurface } from "./support";
import type { useReaderState } from "./useReaderState";
type Input = Pick<
  ReturnType<typeof useReaderState>,
  | "setError"
  | "setDraftSnapshots"
  | "setSettingsNotice"
  | "editorHistoryRef"
  | "setEditorHistory"
  | "contentAreaRef"
  | "sourceDraftRef"
  | "setSourceDraft"
  | "setDocumentState"
  | "documentStateRef"
>;
export function useEditorHistory({
  setError,
  setDraftSnapshots,
  setSettingsNotice,
  editorHistoryRef,
  setEditorHistory,
  contentAreaRef,
  sourceDraftRef,
  setSourceDraft,
  setDocumentState,
  documentStateRef,
}: Input) {
  const handleDraftSaveResult = useCallback(
    (result: DraftSaveResult): boolean => {
      if (!result.ok) {
        setError(`草稿自动保存失败，仍保留在当前窗口中。请先手动保存文档。${result.error ?? ""}`);
        return false;
      }

      const snapshots = loadDraftSnapshots();
      setDraftSnapshots(snapshots);
      if (result.prunedCount > 0) {
        setSettingsNotice(`草稿空间不足，仅保留最近 ${snapshots.length} 条。`);
      }
      return true;
    },
    [setDraftSnapshots, setError, setSettingsNotice],
  );

  const resetEditorHistory = useCallback(
    (documentKey: string, source: string) => {
      const nextHistory = createEditorHistory(documentKey, source);
      editorHistoryRef.current = nextHistory;
      setEditorHistory(nextHistory);
    },
    [editorHistoryRef, setEditorHistory],
  );

  const applyEditorHistoryState = useCallback(
    (nextHistory: EditorHistoryState, focusTarget?: Element | null) => {
      const activeEditor =
        focusTarget?.closest<HTMLElement>(".source-editor, .wysiwyg-editor") ??
        (typeof document !== "undefined"
          ? (document.activeElement?.closest<HTMLElement>(".source-editor, .wysiwyg-editor") ??
            document.querySelector<HTMLElement>(".source-editor, .wysiwyg-editor"))
          : null);
      const viewport = captureEditorViewport(contentAreaRef.current, activeEditor);
      const historyDocumentKey = nextHistory.documentKey;
      editorHistoryRef.current = nextHistory;
      setEditorHistory(nextHistory);
      sourceDraftRef.current = nextHistory.present;
      setSourceDraft(nextHistory.present);
      setDocumentState((current) =>
        current && isSameDocumentPath(current.path, nextHistory.documentKey)
          ? { ...current, modified: nextHistory.present !== current.source }
          : current,
      );
      const restoreViewport = () => {
        if (!isSameDocumentPath(documentStateRef.current?.path ?? "", historyDocumentKey)) return;
        restoreEditorViewport(viewport);
      };
      window.requestAnimationFrame(() => {
        if (!isSameDocumentPath(documentStateRef.current?.path ?? "", historyDocumentKey)) return;
        if (activeEditor) focusEditorSurface(activeEditor);
        restoreViewport();
        // Milkdown may rebuild its ProseMirror state in a passive effect after
        // the first frame; restore once more after that DOM update.
        window.requestAnimationFrame(() => {
          restoreViewport();
        });
      });
    },
    [
      contentAreaRef,
      documentStateRef,
      editorHistoryRef,
      setDocumentState,
      setEditorHistory,
      setSourceDraft,
      sourceDraftRef,
    ],
  );

  const undoEditor = useCallback(
    (focusTarget?: Element | null) => {
      const current = documentStateRef.current;
      const history = editorHistoryRef.current;
      if (!current || !isEditableDocument(current.kind) || !isSameDocumentPath(history.documentKey, current.path))
        return;

      const nextHistory = undoEditorChange(history);
      if (nextHistory !== history) applyEditorHistoryState(nextHistory, focusTarget);
    },
    [applyEditorHistoryState, documentStateRef, editorHistoryRef],
  );

  const redoEditor = useCallback(
    (focusTarget?: Element | null) => {
      const current = documentStateRef.current;
      const history = editorHistoryRef.current;
      if (!current || !isEditableDocument(current.kind) || !isSameDocumentPath(history.documentKey, current.path))
        return;

      const nextHistory = redoEditorChange(history);
      if (nextHistory !== history) applyEditorHistoryState(nextHistory, focusTarget);
    },
    [applyEditorHistoryState, documentStateRef, editorHistoryRef],
  );

  const flushCurrentDraft = useCallback(async (): Promise<DraftFlushOutcome> => {
    const current = documentStateRef.current;
    if (!current?.modified || !isEditableDocument(current.kind)) return "not-needed";
    if (current.path.startsWith("browser://")) return "unavailable";

    const result = await saveDraftSnapshot({
      path: current.path,
      draft: sourceDraftRef.current,
      baseSource: current.source,
      savedAt: Date.now(),
    });
    return handleDraftSaveResult(result) ? "saved" : "failed";
  }, [documentStateRef, handleDraftSaveResult, sourceDraftRef]);
  return { handleDraftSaveResult, resetEditorHistory, undoEditor, redoEditor, flushCurrentDraft };
}
