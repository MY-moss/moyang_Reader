import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DocumentSessions } from "../features/reader/document-sessions";
import { renderSource } from "../features/documents/rendering/document-adapters";
import { fileMetadata } from "../platform/bridge";
import { useDocumentSession } from "./useDocumentSession";

vi.mock("../platform/bridge", () => ({
  isTauriRuntime: () => true,
  readTextFile: vi.fn(async () => "external body"),
  fileMetadata: vi.fn(async () => ({ size: 13, modifiedMs: 100 })),
}));
vi.mock("../features/documents/rendering/document-adapters", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../features/documents/rendering/document-adapters")>()),
  renderSource: vi.fn(),
}));

const rendered = { html: "<p>external body</p>", toc: [], wordCount: 2, readingMinutes: 1 };
describe("document refresh races", () => {
  it.each(["metadata", "render"] as const)("keeps edits made while external refresh awaits %s", async (stage) => {
    const store = new DocumentSessions();
    const path = "C:/notes/race.md";
    store.setDocument({
      path,
      name: "race.md",
      kind: "markdown",
      source: "original",
      rendered,
      modified: false,
      externallyModified: false,
    });
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    vi.mocked(fileMetadata).mockImplementation(async () => {
      if (stage === "metadata") await gate;
      return { size: 13, modifiedMs: 100 };
    });
    vi.mocked(renderSource).mockImplementation(async () => {
      if (stage === "render") await gate;
      return rendered;
    });
    let session!: ReturnType<typeof useDocumentSession>;
    function Harness() {
      session = useDocumentSession({
        documentSessions: store,
        documentStateRef: store.documentRef,
        sourceDraftRef: store.draftRef,
        setDocumentState: store.setDocument,
        setSourceDraft: store.setDraft,
        setMode: store.setMode,
        preferencesRef: { current: { allowRemoteResources: false } },
        documentCacheRef: { current: { get: () => undefined, set: vi.fn() } },
        setLoading: vi.fn(),
        setError: vi.fn(),
        releaseDocumentResources: vi.fn(),
        resetEditorHistory: vi.fn(),
        setExternalChangePath: vi.fn(),
        setDraftRecovery: vi.fn(),
        setDraftSnapshots: vi.fn(),
        setOpenTabs: vi.fn(),
        setRecentFiles: vi.fn(),
        setSettingsNotice: vi.fn(),
        workspacePath: null,
      } as unknown as Parameters<typeof useDocumentSession>[0]);
      return null;
    }
    const root = createRoot(document.createElement("div"));
    try {
      await act(async () => root.render(<Harness />));
      const opening = session.openPath(path, true);
      if (stage === "render") await vi.waitFor(() => expect(renderSource).toHaveBeenCalled());
      store.setDraft("new local edit");
      finish();
      expect(await opening).toBe(false);
      expect(store.get(path)?.draft).toBe("new local edit");
      expect(store.get(path)?.document.modified).toBe(true);
      expect(store.get(path)?.document.externallyModified).toBe(true);
    } finally {
      await act(async () => root.unmount());
      vi.clearAllMocks();
    }
  });
});
