import { useState, useSyncExternalStore } from "react";
import { DocumentSessions } from "../features/reader/document-sessions";

export function useDocumentSessions() {
  const [documentSessions] = useState(() => new DocumentSessions());
  const sessionSnapshot = useSyncExternalStore(documentSessions.subscribe, documentSessions.getSnapshot);
  const active = sessionSnapshot.activeKey ? sessionSnapshot.sessions.get(sessionSnapshot.activeKey) : undefined;
  return {
    documentSessions,
    sessionSnapshot,
    documentState: active?.document ?? null,
    sourceDraft: active?.draft ?? "",
    mode: active?.mode ?? "rendered",
    editorHistory: active?.history ?? documentSessions.historyRef.current,
    setDocumentState: documentSessions.setDocument,
    setSourceDraft: documentSessions.setDraft,
    setMode: documentSessions.setMode,
    setEditorHistory: documentSessions.setHistory,
    documentStateRef: documentSessions.documentRef,
    sourceDraftRef: documentSessions.draftRef,
    editorHistoryRef: documentSessions.historyRef,
  };
}
