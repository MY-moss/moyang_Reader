import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke, listen } = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen }));

import { writeBinaryFile } from "./bridge";

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

    expect(invoke).toHaveBeenCalledWith("write_binary_file_raw", contents, {
      headers: { path: "C%3A%5CNotes%5C%E4%BD%A0%E5%A5%BD.docx" },
    });
  });
});
