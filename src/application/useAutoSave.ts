import { useEffect, useRef } from "react";
import { isTauriRuntime } from "../platform/bridge";
import { saveDraftSnapshot } from "../features/recovery/draft-recovery";
import type { DocumentSessions } from "../features/reader/document-sessions";

export function useAutoSave(store: DocumentSessions, save: (overwrite?: boolean, path?: string) => Promise<boolean>) {
  const composing = useRef(false);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);
  useEffect(() => {
    const timers = new Map<string, { source: string; base: string; id: ReturnType<typeof setTimeout> }>();
    const schedule = () => {
      for (const [path, timer] of timers) {
        const session = store.get(path);
        if (
          store.isWriteHeld() ||
          !session?.document.modified ||
          session.draft !== timer.source ||
          session.document.externallyModified ||
          session.saveStatus === "error" ||
          composing.current
        ) {
          clearTimeout(timer.id);
          timers.delete(path);
        }
      }
      if (!isTauriRuntime() || composing.current || store.isWriteHeld()) return;
      for (const session of store.getSnapshot().sessions.values()) {
        const { document, draft } = session;
        if (
          !document.modified ||
          document.externallyModified ||
          document.path.startsWith("browser://") ||
          session.saveStatus === "saving" ||
          session.saveStatus === "error"
        )
          continue;
        if (timers.has(document.path)) continue;
        timers.set(document.path, {
          source: draft,
          base: document.source,
          id: setTimeout(async () => {
            timers.delete(document.path);
            if (composing.current) return;
            const latest = store.get(document.path);
            if (!latest?.document.modified || latest.document.externallyModified || latest.saveStatus === "error")
              return;
            const recovery = await saveDraftSnapshot({
              path: document.path,
              draft: latest.draft,
              baseSource: latest.document.source,
              savedAt: Date.now(),
            });
            if (!recovery.ok) {
              store.update(document.path, (current) => ({
                ...current,
                saveStatus: "error",
                saveError: "草稿备份失败，请手动保存",
              }));
              return;
            }
            if (!composing.current && !store.isWriteHeld()) void saveRef.current(false, document.path);
          }, 1200),
        });
      }
    };
    const start = (event: CompositionEvent) => {
      if (document.body.dataset.activeSpace === "ai") return;
      if (event.target instanceof Element && !event.target.closest(".source-editor,.wysiwyg-editor")) return;
      composing.current = true;
      store.setComposing(store.active()?.document.path ?? null);
      schedule();
    };
    const end = () => {
      composing.current = false;
      store.setComposing(null);
      schedule();
    };
    const unsubscribe = store.subscribe(schedule);
    window.addEventListener("compositionstart", start, true);
    window.addEventListener("compositionend", end, true);
    schedule();
    return () => {
      unsubscribe();
      store.setComposing(null);
      timers.forEach((timer) => clearTimeout(timer.id));
      window.removeEventListener("compositionstart", start, true);
      window.removeEventListener("compositionend", end, true);
    };
  }, [store]);
}
