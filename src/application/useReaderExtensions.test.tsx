import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { useReaderExtensions } from "./useReaderExtensions";
import type { ReaderApplication } from "./useReaderApplication";
import type { ExtensionManager } from "../features/extensions/useExtensions";
import { DocumentSessions } from "../features/reader/document-sessions";
import { builtInCatalog } from "../features/extensions/catalog";
import { runExtension } from "../features/extensions/runtime";
vi.mock("../features/extensions/runtime", () => ({ runExtension: vi.fn() }));
let root: ReturnType<typeof createRoot>;
afterEach(async () => {
  await act(async () => root?.unmount());
  vi.clearAllMocks();
});
async function harness() {
  const store = new DocumentSessions();
  const doc = {
    path: "C:/notes/current.md",
    name: "current.md",
    kind: "markdown" as const,
    source: "original",
    rendered: { html: "", toc: [], wordCount: 1, readingMinutes: 1 },
    modified: false,
    externallyModified: false,
  };
  store.setDocument(doc);
  const updateSource = vi.fn((draft: string, path: string) => store.update(path, (s) => ({ ...s, draft })));
  let api: ReturnType<typeof useReaderExtensions>;
  function Harness() {
    api = useReaderExtensions(
      { documentState: doc, canEdit: true, documentSessions: store, updateSource } as unknown as ReaderApplication,
      {
        state: {
          installed: [{ package: builtInCatalog.find((p) => p.id === "moyang.tidy-markdown")!, enabled: true }],
        },
      } as ExtensionManager,
    );
    return null;
  }
  root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Harness />));
  return {
    store,
    updateSource,
    get api() {
      return api!;
    },
  };
}
it("never overwrites edits made while a plugin is running", async () => {
  let finish!: (r: { replacement: string }) => void;
  vi.mocked(runExtension).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const h = await harness();
  await act(async () => h.api.execute("extension:moyang.tidy-markdown:tidy"));
  h.store.update("C:/notes/current.md", (s) => ({ ...s, draft: "later edit" }));
  await act(async () => finish({ replacement: "plugin change" }));
  await act(async () => h.api.apply());
  expect(h.updateSource).not.toHaveBeenCalled();
  expect(h.api.run?.error).toContain("已有新修改");
  expect(h.store.get("C:/notes/current.md")?.draft).toBe("later edit");
});
it("applies through the normal document session and ignores a cancelled result", async () => {
  vi.mocked(runExtension).mockResolvedValue({ replacement: "plugin change" });
  const h = await harness();
  await act(async () => h.api.execute("extension:moyang.tidy-markdown:tidy"));
  await act(async () => h.api.apply());
  expect(h.updateSource).toHaveBeenCalledWith("plugin change", "C:/notes/current.md");
  let finish!: (r: { replacement: string }) => void;
  vi.mocked(runExtension).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => h.api.execute("extension:moyang.tidy-markdown:tidy"));
  await act(async () => h.api.close());
  await act(async () => finish({ replacement: "cancelled" }));
  expect(h.api.run).toBeNull();
  expect(h.updateSource).toHaveBeenCalledTimes(1);
});
