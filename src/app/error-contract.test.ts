import { describe, expect, it } from "vitest";
import { AppError, ERROR_CODES, errorCodeForIpcCommand, normalizeAppError } from "./error-contract";

describe("error contract", () => {
  it("preserves a structured envelope and diagnostic details", () => {
    const error = normalizeAppError({ code: "WORKSPACE_ACCESS_DENIED", message: "拒绝访问", details: { root: "x" } });

    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe("WORKSPACE_ACCESS_DENIED");
    expect(error.message).toBe("拒绝访问");
    expect(error.details).toEqual({ root: "x" });
  });

  it("accepts a JSON-encoded envelope from a legacy bridge", () => {
    const error = normalizeAppError('{"code":"EXPORT_FAILED","message":"导出失败"}');

    expect(error.code).toBe("EXPORT_FAILED");
    expect(error.message).toBe("导出失败");
  });

  it("uses a safe fallback for unknown causes", () => {
    const error = normalizeAppError({ unexpected: true }, ERROR_CODES.FILE_READ_FAILED, "读取失败");

    expect(error.code).toBe("FILE_READ_FAILED");
    expect(error.message).toBe("读取失败");
  });

  it("maps command boundaries to stable fallback codes", () => {
    expect(errorCodeForIpcCommand("read_text_file")).toBe("FILE_READ_FAILED");
    expect(errorCodeForIpcCommand("refresh_workspace")).toBe("WORKSPACE_OPERATION_FAILED");
    expect(errorCodeForIpcCommand("export_pdf_file")).toBe("EXPORT_FAILED");
    expect(errorCodeForIpcCommand("future_command")).toBe("IPC_COMMAND_FAILED");
  });
});
