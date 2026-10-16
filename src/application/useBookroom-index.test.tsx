import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useBookroom } from "./useBookroom";
import type { ReaderApplication } from "./useReaderApplication";
import type { WorkbenchPanes } from "./useWorkbenchPanes";
import { fileMetadata } from "../platform/bridge";
import { bookroomRequest } from "../platform/bookroom-bridge";

vi.mock("../platform/bridge", () => ({
  isTauriRuntime: () => true,
  fileMetadata: vi.fn(async () => ({ size: 1, modifiedMs: 1 })),
  readTextFile: vi.fn(async () => "正文"),
  readBinaryFile: vi.fn(),
}));
vi.mock("../features/documents/source-chunks", () => ({ contentHash: vi.fn(), extractSourceChunks: vi.fn() }));
vi.mock("../platform/bookroom-bridge", () => ({ bookroomRequest: vi.fn() }));

it("does not rescan unchanged files after a bookmark or single-file change", async () => {
  const files = Array.from({ length: 3 }, (_, i) => ({
    path: `C:/library/${i}.txt`,
    name: `${i}.txt`,
    kind: "text" as const,
    size: 1,
    relativePath: `${i}.txt`,
  }));
  vi.mocked(bookroomRequest).mockImplementation(async (r) =>
    r.action === "index.manifest"
      ? files.map((f) => ({ path: f.path, stamp: JSON.stringify({ size: 1, modifiedMs: 1 }), tags: "[]" }))
      : [],
  );
  const model = {
    workspacePath: "C:/library",
    workspaceFiles: files,
    workspaceIndex: [],
    articleRef: { current: null },
  } as unknown as ReaderApplication;
  let room!: ReturnType<typeof useBookroom>;
  function Harness() {
    room = useBookroom(model, {} as WorkbenchPanes);
    return null;
  }
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => {
      root.render(<Harness />);
    });
    const cold = vi.mocked(fileMetadata).mock.calls.length;
    vi.mocked(fileMetadata).mockClear();
    await act(async () => room.bookmarkSearch());
    const favorite = vi.mocked(fileMetadata).mock.calls.length;
    vi.mocked(fileMetadata).mockClear();
    model.workspaceFiles = files.map((f, i) => (i === 1 ? { ...f } : f));
    await act(async () => root.render(<Harness />));
    const changed = vi.mocked(fileMetadata).mock.calls.length;
    expect(cold).toBe(3);
    expect(favorite).toBe(0);
    expect(changed).toBe(1);
  } finally {
    await act(async () => root.unmount());
  }
});
