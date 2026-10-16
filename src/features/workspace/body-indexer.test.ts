// @vitest-environment node
import { expect, it, vi } from "vitest";
import { BodyIndexer } from "./body-indexer";
import { bookroomRequest } from "../../platform/bookroom-bridge";
import { readTextFile } from "../../platform/bridge";
vi.mock("../../platform/bookroom-bridge", () => ({ bookroomRequest: vi.fn(async () => []) }));
vi.mock("../../platform/bridge", () => ({
  fileMetadata: async () => ({ size: 1, modifiedMs: 1 }),
  readTextFile: vi.fn(),
  readBinaryFile: vi.fn(),
}));
vi.mock("../documents/source-chunks", () => ({
  extractSourceChunks: async (_path: string, _kind: string, text: string) => ({ hash: text, text, chunks: [] }),
}));
it("drops superseded extraction and retries failed files without replacing a valid index", async () => {
  let release!: (text: string) => void;
  vi.mocked(readTextFile)
    .mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    )
    .mockRejectedValueOnce(new Error("暂时不可读"))
    .mockResolvedValue("最新正文");
  const report = vi.fn();
  const worker = new BodyIndexer("C:/notes", report);
  const file = { path: "C:/notes/a.txt", name: "a.txt", relativePath: "a.txt", kind: "text" as const, size: 1 };
  worker.update([file], []);
  await vi.waitFor(() => expect(readTextFile).toHaveBeenCalledTimes(1));
  worker.update([{ ...file }], []);
  release("已过时正文");
  await vi.waitFor(() => expect(report).toHaveBeenCalledWith("", [expect.stringContaining("暂时不可读")], false));
  expect(vi.mocked(bookroomRequest).mock.calls.filter(([r]) => r.action === "index.replace")).toHaveLength(0);
  worker.retry();
  await vi.waitFor(() =>
    expect(bookroomRequest).toHaveBeenCalledWith(
      expect.objectContaining({ action: "index.replace", text: "最新正文" }),
    ),
  );
  worker.dispose();
});
