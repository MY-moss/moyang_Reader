vi.mock("../platform/reader-drafts", () => ({
  readerDraftRequest: vi.fn(async (action: string) => (action === "get" ? null : [])),
}));
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentSessions } from "../features/reader/document-sessions";
import { useAutoSave } from "./useAutoSave";
vi.mock("../platform/bridge", () => ({ isTauriRuntime: () => true }));
let store: DocumentSessions;
let root: ReturnType<typeof createRoot>;
const add = (path: string) =>
  store.setDocument({
    path,
    name: path,
    kind: "markdown",
    source: "original",
    rendered: { html: "", toc: [], wordCount: 1, readingMinutes: 1 },
    modified: false,
    externallyModified: false,
  });
async function mount(save: (overwrite?: boolean, path?: string) => Promise<boolean>) {
  function Harness() {
    useAutoSave(store, save);
    return null;
  }
  root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Harness />));
}
beforeEach(() => {
  vi.useFakeTimers();
  store = new DocumentSessions();
  localStorage.clear();
  delete document.body.dataset.activeSpace;
  add("C:/notes/a.md");
});
afterEach(async () => {
  await act(async () => root?.unmount());
  vi.useRealTimers();
});
describe("automatic document saves", () => {
  it("does not pause reader saves while composing text in AI space", async () => {
    const save = vi.fn(async () => true);
    await mount(save);
    store.setDraft("pending reader edit");
    document.body.dataset.activeSpace = "ai";
    window.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(1200);
    expect(save).toHaveBeenCalledExactlyOnceWith(false, "C:/notes/a.md");
    expect(store.isComposing()).toBe(false);
  });
  it("waits for Chinese composition and the idle interval, then saves the original document after a switch", async () => {
    const save = vi.fn(async () => true);
    await mount(save);
    window.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    store.setDraft("中文组词");
    await vi.advanceTimersByTimeAsync(2500);
    expect(save).not.toHaveBeenCalled();
    expect(store.isComposing("c:\\notes\\a.md")).toBe(true);
    window.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    store.setDraft("中文组词完成");
    add("C:/notes/b.md");
    await vi.advanceTimersByTimeAsync(1199);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledExactlyOnceWith(false, "C:/notes/a.md");
  });
  it("waits for an in-flight save and schedules text typed during that save", async () => {
    let finish: () => void = () => undefined;
    const writes: string[] = [];
    const save = vi.fn(async (_overwrite?: boolean, path?: string) => {
      const draft = store.get(path!)!.draft;
      writes.push(draft);
      store.update(path!, (s) => ({ ...s, saveStatus: "saving" }));
      if (writes.length === 1)
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
      store.update(path!, (s) => ({
        ...s,
        saveStatus: "saved",
        document: { ...s.document, source: draft, modified: s.draft !== draft },
      }));
      return true;
    });
    await mount(save);
    store.setDraft("first edit");
    await vi.advanceTimersByTimeAsync(1200);
    store.setDraft("newer edit");
    await vi.advanceTimersByTimeAsync(3000);
    expect(writes).toEqual(["first edit"]);
    finish();
    await vi.advanceTimersByTimeAsync(1200);
    expect(writes).toEqual(["first edit", "newer edit"]);
    expect(store.active()?.document.modified).toBe(false);
  });
  it("does not overwrite an external change or write while rename holds the document queue", async () => {
    const save = vi.fn(async () => true);
    await mount(save);
    store.setDraft("local");
    const release = store.holdWrites();
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).not.toHaveBeenCalled();
    release();
    store.update("C:/notes/a.md", (s) => ({ ...s, document: { ...s.document, externallyModified: true } }));
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).not.toHaveBeenCalled();
  });
});
