import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { DocumentSessions } from "../../features/reader/document-sessions";
import { readPaneView } from "../../features/reader/pane-view-state";
import type { ReaderApplication } from "../useReaderApplication";
import type { WorkbenchPanes } from "../useWorkbenchPanes";
import { ReaderPane } from "./ReaderPane";

vi.mock("./DocumentViewport", () => ({
  DocumentViewport: ({
    pdfPage,
    onPdfPageChange,
    model,
  }: {
    pdfPage: number;
    onPdfPageChange: (page: number) => void;
    model: ReaderApplication;
  }) => (
    <div className="content-area" data-page={pdfPage}>
      <button
        className="advance-active"
        onClick={() => {
          onPdfPageChange(pdfPage + 1);
          model.setSourceLocation({ path: model.documentState!.path, page: pdfPage + 1 });
        }}
      >
        next
      </button>
    </div>
  ),
}));
vi.mock("./DocumentActions", () => ({ DocumentActions: () => null }));
vi.mock("../../shell/components/Tabs", () => ({ Tabs: () => null }));
vi.mock("../../features/reader/components/DocumentPreview", () => ({
  DocumentPreview: ({ page, onPageChange }: { page: number; onPageChange: (page: number) => void }) => (
    <div data-page={page}>
      <button className="advance-inactive" onClick={() => onPageChange(page + 1)}>
        next
      </button>
    </div>
  ),
}));

it("keeps each PDF page when panes activate, deactivate and reload their saved views", async () => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(callback, 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  const path = "C:/notes/independent-pages.pdf";
  const store = new DocumentSessions();
  store.setDocument({
    path,
    name: "pages.pdf",
    kind: "pdf",
    source: "",
    modified: false,
    externallyModified: false,
    rendered: { html: "", toc: [], wordCount: 0, readingMinutes: 0 },
  });
  let activate!: (index: 0 | 1) => void;
  function Harness() {
    const [activePane, setActivePane] = useState<0 | 1>(0);
    const [location, setLocation] = useState({ path, page: 1 });
    activate = (index) => {
      setActivePane(index);
      setLocation({ path, page: readPaneView(index, path).page });
    };
    const model = {
      documentSessions: store,
      documentState: store.active()!.document,
      mode: "rendered",
      sourceLocation: location,
      setSourceLocation: setLocation,
      preferences: {},
      openTabs: [],
      loading: false,
    } as unknown as ReaderApplication;
    const workbench = {
      activePane,
      panes: [0, 1].map((id) => ({ id, paths: [path], activePath: path, previewPath: null })),
      activate,
    } as unknown as WorkbenchPanes;
    return (
      <>
        <ReaderPane index={0} model={model} workbench={workbench} />
        <ReaderPane index={1} model={model} workbench={workbench} />
      </>
    );
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  const click = async (selector: string) =>
    act(async () => container.querySelector<HTMLButtonElement>(selector)!.click());
  const page = (index: number) =>
    container.querySelectorAll(".reader-pane")[index].querySelector("[data-page]")?.getAttribute("data-page");
  try {
    await act(async () => root.render(<Harness />));
    await click(".advance-active");
    await click(".advance-active");
    expect(page(0)).toBe("3");
    await act(async () => activate(1));
    expect(page(0)).toBe("3");
    expect(page(1)).toBe("1");
    await click(".advance-active");
    await click(".advance-inactive");
    expect(page(0)).toBe("4");
    expect(page(1)).toBe("2");
    await act(async () => activate(0));
    expect(page(0)).toBe("4");
    expect(page(1)).toBe("2");
    expect(readPaneView(0, path).page).toBe(4);
    expect(readPaneView(1, path).page).toBe(2);
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
