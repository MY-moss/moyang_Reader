import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { registerSourceSelection } from "../features/editor/source-selection";
import { extractSourceChunks } from "../features/documents/source-chunks";
import type { ReaderApplication } from "./useReaderApplication";
import type { WorkbenchPanes } from "./useWorkbenchPanes";
import { useBookroom } from "./useBookroom";

vi.mock("../platform/bookroom-bridge", () => ({ bookroomRequest: async () => [] }));
vi.mock("../platform/bridge", async (original) => ({
  ...(await original<typeof import("../platform/bridge")>()),
  readBinaryFile: vi.fn(async () => new Uint8Array([1])),
}));
vi.mock("../features/documents/source-chunks", async (original) => ({
  ...(await original<typeof import("../features/documents/source-chunks")>()),
  extractSourceChunks: vi.fn(),
}));

describe("bookroom source coordinates", () => {
  it.each(["markdown", "text"])(
    "restores the selected repeat in an unsaved %s draft using its live fingerprint",
    async (kind) => {
      const path = `C:/notes/source-selection.${kind === "text" ? "txt" : "md"}`;
      const text = "# heading\n**selected evidence**\n**selected evidence**\nlast";
      const from = text.lastIndexOf("selected"),
        to = from + "selected evidence".length;
      const setSourceLocation = vi.fn(),
        setMode = vi.fn(),
        reveal = vi.fn();
      let bookroom!: ReturnType<typeof useBookroom>;
      const model = {
        workspacePath: null,
        documentState: { path, kind, modified: true, sourceHash: "older-disk-fingerprint" },
        mode: "source",
        sourceDraft: text,
        sourceLocation: null,
        articleRef: { current: null },
        setSettingsNotice: vi.fn(),
        setSourceLocation,
        setMode,
        setSearchOpen: vi.fn(),
        setSearchQuery: vi.fn(),
        documentSessions: { active: () => ({ document: { path } }) },
      } as unknown as ReaderApplication;
      const panes = { openFile: vi.fn(async () => undefined) } as unknown as WorkbenchPanes;
      function Harness() {
        bookroom = useBookroom(model, panes);
        return null;
      }
      const pane = document.createElement("section");
      pane.className = "reader-pane is-active";
      const editor = pane.appendChild(document.createElement("div"));
      document.body.append(pane);
      const remove = registerSourceSelection(editor, { read: () => ({ text, from, to }), reveal });
      const root = createRoot(document.createElement("div"));
      try {
        await act(async () => root.render(<Harness />));
        const location = (await bookroom.currentLocation())!;
        expect(location).toMatchObject({ path, source: true, offset: from, endOffset: to, quote: "selected evidence" });
        await act(async () => bookroom.navigate(location));
        expect(setMode).toHaveBeenCalledWith("source");
        model.sourceLocation = location;
        await act(async () => root.render(<Harness />));
        await vi.waitFor(() => expect(reveal).toHaveBeenCalledWith(from, to));
        reveal.mockClear();
        model.sourceDraft += "new text typed after navigation";
        await act(async () => root.render(<Harness />));
        expect(reveal).not.toHaveBeenCalled();
      } finally {
        await act(async () => root.unmount());
        remove();
        pane.remove();
      }
    },
  );
  it.each([true, false])(
    "handles changed PDF sources in the real navigation hook (has quote: %s)",
    async (hasQuote) => {
      const path = "C:/notes/changed.pdf";
      const setSourceLocation = vi.fn(),
        setSettingsNotice = vi.fn();
      vi.mocked(extractSourceChunks).mockResolvedValue({
        hash: "new",
        text: "unique evidence",
        chunks: [{ text: "unique evidence", location: { path, page: 3, offset: 0 } }],
      });
      const model = {
        workspacePath: null,
        documentState: { path, kind: "pdf", sourceHash: "new" },
        mode: "rendered",
        sourceDraft: "",
        sourceLocation: { path, page: 2, hash: "old", quote: hasQuote ? "unique evidence" : undefined },
        articleRef: { current: null },
        setSettingsNotice,
        setSourceLocation,
      } as unknown as ReaderApplication;
      function Harness() {
        useBookroom(model, {} as WorkbenchPanes);
        return null;
      }
      const root = createRoot(document.createElement("div"));
      try {
        await act(async () => root.render(<Harness />));
        if (hasQuote) {
          await vi.waitFor(() =>
            expect(setSourceLocation).toHaveBeenCalledWith(expect.objectContaining({ page: 3, hash: "new" })),
          );
          expect(setSettingsNotice).toHaveBeenCalledWith(expect.stringContaining("重新定位"));
        } else {
          expect(setSourceLocation).not.toHaveBeenCalled();
          expect(setSettingsNotice).toHaveBeenCalledWith(expect.stringContaining("原页码可能不再对应"));
        }
      } finally {
        await act(async () => root.unmount());
      }
    },
  );
});
