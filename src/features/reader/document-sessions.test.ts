import { describe, expect, it } from "vitest";
import { DocumentSessions } from "./document-sessions";
import { recordEditorChange } from "../editor/editor-history";
import type { OpenDocument } from "../../shared/types";
const doc = (path: string): OpenDocument => ({
  path,
  name: path,
  kind: "markdown",
  source: "initial",
  rendered: { html: "", toc: [], wordCount: 1, readingMinutes: 1 },
  modified: false,
  externallyModified: false,
});
describe("document sessions", () => {
  it("preserves independent drafts, editing modes and undo when switching", () => {
    const store = new DocumentSessions();
    store.setDocument(doc("C:/notes/a.md"));
    store.setDraft("unsaved a");
    store.setMode("source");
    store.setHistory((history) => recordEditorChange(history, "unsaved a"));
    store.setDocument(doc("C:/notes/b.md"));
    store.setDraft("unsaved b");
    expect(store.activate("c:\\notes\\a.md")).toBe(true);
    expect(store.active()?.draft).toBe("unsaved a");
    expect(store.active()?.mode).toBe("source");
    expect(store.active()?.history.past).toEqual(["initial"]);
    expect(store.get("C:/notes/b.md")?.draft).toBe("unsaved b");
  });
  it("updates a background save without touching the active document", () => {
    const store = new DocumentSessions();
    store.setDocument(doc("a.md"));
    store.setDraft("saved version");
    store.setDocument(doc("b.md"));
    store.update("a.md", (session) => ({
      ...session,
      document: { ...session.document, source: "saved version", modified: false },
    }));
    expect(store.documentRef.current?.path).toBe("b.md");
    expect(store.get("a.md")?.document.modified).toBe(false);
    expect(store.getSnapshot().sessions.size).toBe(2);
  });
});
