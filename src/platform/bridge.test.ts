import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke, listen } = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen }));

import { fileMetadata, writeBinaryFile } from "./bridge";

describe("binary bridge", () => {
  beforeEach(() => {
    invoke.mockReset();
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
  });

  it("sends binary writes as a raw body with an encoded path header", async () => {
    const contents = Uint8Array.from([0, 1, 2, 255]);
    await writeBinaryFile("C:\\Notes\\你好.docx", contents);

    expect(invoke).toHaveBeenCalledWith("write_binary_file_raw", expect.any(ArrayBuffer), {
      headers: {
        "Content-Type": "application/octet-stream",
        path: "C%3A%5CNotes%5C%E4%BD%A0%E5%A5%BD.docx",
      },
    });
    const [, body] = invoke.mock.calls[0];
    expect(Array.from(new Uint8Array(body))).toEqual([0, 1, 2, 255]);
  });

  it("falls back to the authorized JSON binary command when raw IPC is unavailable", async () => {
    const contents = Uint8Array.from([9, 8, 7]);
    invoke.mockRejectedValueOnce("IPC 二进制写入需要原始字节请求体。");

    await writeBinaryFile("C:\\Notes\\fallback.docx", contents);

    expect(invoke).toHaveBeenNthCalledWith(2, "write_binary_file", {
      path: "C:\\Notes\\fallback.docx",
      contents: [9, 8, 7],
    });
  });

  it("reads the lightweight file stamp used by the document cache", async () => {
    invoke.mockResolvedValue({ size: 42, modifiedMs: 1_725_000_000_000 });

    await expect(fileMetadata("C:\\Notes\\Today.md")).resolves.toEqual({
      size: 42,
      modifiedMs: 1_725_000_000_000,
    });
    expect(invoke).toHaveBeenCalledWith("file_metadata", { path: "C:\\Notes\\Today.md" });
  });
});
