import { act, useEffect, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentSessions } from "../features/reader/document-sessions";
import { savePaneView } from "../features/reader/pane-view-state";
import { useWorkbenchPanes, type WorkbenchPanes } from "./useWorkbenchPanes";
import type { ReaderApplication } from "./useReaderApplication";

const store = new DocumentSessions();
const open = (path: string) =>
  store.setDocument({
    path,
    name: path.split(/[\\/]/).at(-1)!,
    kind: "markdown",
    source: "body",
    rendered: { html: "<p>body</p>", toc: [], wordCount: 1, readingMinutes: 1 },
    modified: false,
    externallyModified: false,
  });
let panes: WorkbenchPanes;
let root: ReturnType<typeof createRoot>;
function Harness() {
  useSyncExternalStore(store.subscribe, store.getSnapshot);
  const state = useWorkbenchPanes({
    documentSessions: store,
    documentState: store.active()?.document ?? null,
    openTabs: [...store.getSnapshot().sessions.values()].map(({ document }) => ({
      path: document.path,
      name: document.name,
    })),
    handleSelectTab: async (path: string) => {
      open(path.replace(/^\\\\\?\\/, ""));
    },
    handleCloseTabs: async (paths: string[]) => {
      paths.forEach(store.remove);
      return true;
    },
    setSourceLocation: vi.fn(),
  } as unknown as ReaderApplication);
  useEffect(() => {
    panes = state;
  }, [state]);
  return null;
}
afterEach(async () => {
  await act(async () => root?.unmount());
  localStorage.clear();
  [...store.getSnapshot().sessions.values()].forEach(({ document }) => store.remove(document.path));
});
describe("workbench path identity", () => {
  it("restores the focused right pane without replacing the left pane's selected document", async () => {
    open("C:/notes/left.md");
    open("C:/notes/right.md");
    savePaneView(1, "C:/notes/right.md", { mode: "source", page: 3, scroll: 50 });
    localStorage.setItem(
      "moyang.workbench.panes.v1",
      JSON.stringify({
        split: true,
        activePane: 1,
        ratio: 60,
        panes: [
          { id: 0, paths: ["C:/notes/left.md"], activePath: "C:/notes/left.md", previewPath: null },
          { id: 1, paths: ["C:/notes/right.md"], activePath: "C:/notes/right.md", previewPath: null },
        ],
      }),
    );
    root = createRoot(document.createElement("div"));
    await act(async () => root.render(<Harness />));
    expect(panes.activePane).toBe(1);
    expect(panes.split).toBe(true);
    expect(panes.panes[0].activePath).toBe("C:/notes/left.md");
    expect(panes.panes[1].activePath).toBe("C:/notes/right.md");
    expect(store.active()?.mode).toBe("source");
  });
  it("assigns the canonical document to its pane when a workspace supplies an extended Windows path", async () => {
    localStorage.clear();
    open("C:\\Notes\\initial.md");
    root = createRoot(document.createElement("div"));
    await act(async () => root.render(<Harness />));
    await act(async () => panes.openFile("\\\\?\\C:\\Notes\\next.md"));
    expect(panes.panes[0].activePath).toBe("C:\\Notes\\next.md");
    expect(panes.panes[0].previewPath).toBe("C:\\Notes\\next.md");
    await act(async () => panes.openFile("\\\\?\\C:\\Notes\\last.md"));
    expect(panes.panes[0].activePath).toBe("C:\\Notes\\last.md");
    expect(panes.panes[0].paths).toEqual(["C:\\Notes\\initial.md", "C:\\Notes\\last.md"]);
    expect(store.get("C:/Notes/next.md")).toBeUndefined();
  });
});
