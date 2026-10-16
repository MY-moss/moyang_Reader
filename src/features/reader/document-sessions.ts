import { createEditorHistory, type EditorHistoryState } from "../editor/editor-history";
import { normalizePathKey } from "../../platform/path-key";
import type { OpenDocument, ReaderMode } from "../../shared/types";

export type DocumentSession = {
  document: OpenDocument;
  draft: string;
  mode: ReaderMode;
  history: EditorHistoryState;
  saveStatus: "idle" | "saving" | "saved" | "error";
  saveError?: string;
};
type Snapshot = { activeKey: string | null; sessions: ReadonlyMap<string, DocumentSession> };
type Update<T> = T | ((previous: T) => T);
const valueOf = <T>(update: Update<T>, value: T): T =>
  typeof update === "function" ? (update as (previous: T) => T)(value) : update;

/** One content owner per normalized path, independent of the pane displaying it. */
export class DocumentSessions {
  private state: Snapshot = { activeKey: null, sessions: new Map() };
  private writeHolds = 0;
  private composingPath: string | null = null;
  isComposing = (path?: string) =>
    this.composingPath !== null && (!path || normalizePathKey(path) === this.composingPath);
  setComposing = (path: string | null) => {
    this.composingPath = path ? normalizePathKey(path) : null;
    this.publish({ ...this.state });
  };
  isWriteHeld = () => this.writeHolds > 0;
  holdWrites = () => {
    this.writeHolds += 1;
    this.publish({ ...this.state });
    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.writeHolds -= 1;
        this.publish({ ...this.state });
      }
    };
  };
  private listeners = new Set<() => void>();
  readonly documentRef: { current: OpenDocument | null } = { current: null };
  readonly draftRef = { current: "" };
  readonly historyRef = { current: createEditorHistory("", "") };
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  get = (path: string) => this.state.sessions.get(normalizePathKey(path));
  active = () => (this.state.activeKey ? this.state.sessions.get(this.state.activeKey) : undefined);
  private publish(state: Snapshot) {
    this.state = state;
    const active = this.active();
    this.documentRef.current = active?.document ?? null;
    this.draftRef.current = active?.draft ?? "";
    this.historyRef.current = active?.history ?? createEditorHistory("", "");
    this.listeners.forEach((listener) => listener());
  }
  update = (path: string, change: (session: DocumentSession) => DocumentSession) => {
    const key = normalizePathKey(path);
    const current = this.state.sessions.get(key);
    if (!current) return;
    const next = change(current);
    if (next === current) return;
    const sessions = new Map(this.state.sessions);
    sessions.set(key, next);
    this.publish({ ...this.state, sessions });
  };
  activate = (path: string): boolean => {
    const key = normalizePathKey(path);
    if (!this.state.sessions.has(key)) return false;
    if (key !== this.state.activeKey) this.publish({ ...this.state, activeKey: key });
    return true;
  };
  rebase = (map: (session: DocumentSession) => DocumentSession) => {
    const sessions = new Map<string, DocumentSession>();
    let activeKey = this.state.activeKey;
    for (const [key, value] of this.state.sessions) {
      const next = map(value);
      const nextKey = normalizePathKey(next.document.path);
      sessions.set(nextKey, next);
      if (activeKey === key) activeKey = nextKey;
    }
    this.publish({ sessions, activeKey });
  };
  remove = (path: string) => {
    const key = normalizePathKey(path);
    const sessions = new Map(this.state.sessions);
    sessions.delete(key);
    this.publish({ activeKey: key === this.state.activeKey ? null : this.state.activeKey, sessions });
  };
  setDocument = (update: Update<OpenDocument | null>) => {
    const document = valueOf(update, this.active()?.document ?? null);
    if (!document) {
      this.publish({ ...this.state, activeKey: null });
      return;
    }
    const key = normalizePathKey(document.path);
    const current = this.state.sessions.get(key);
    const session: DocumentSession = current
      ? { ...current, document }
      : {
          document,
          draft: document.source,
          mode: "rendered",
          history: createEditorHistory(document.path, document.source),
          saveStatus: "idle",
        };
    const sessions = new Map(this.state.sessions);
    sessions.set(key, session);
    this.publish({ activeKey: key, sessions });
  };
  setDraft = (update: Update<string>) => {
    const active = this.active();
    if (active)
      this.update(active.document.path, (session) => {
        const draft = valueOf(update, session.draft);
        return {
          ...session,
          draft,
          document: { ...session.document, modified: draft !== session.document.source },
          saveError: undefined,
          saveStatus: session.saveStatus === "error" ? "idle" : session.saveStatus,
        };
      });
  };
  setMode = (update: Update<ReaderMode>) => {
    const active = this.active();
    if (active) this.update(active.document.path, (session) => ({ ...session, mode: valueOf(update, session.mode) }));
  };
  setHistory = (update: Update<EditorHistoryState>) => {
    const active = this.active();
    if (active)
      this.update(active.document.path, (session) => ({ ...session, history: valueOf(update, session.history) }));
  };
}
