export const ERROR_CODES = {
  FILE_READ_FAILED: "FILE_READ_FAILED",
  FILE_WRITE_FAILED: "FILE_WRITE_FAILED",
  FILE_CONFLICT: "FILE_CONFLICT",
  WORKSPACE_ACCESS_DENIED: "WORKSPACE_ACCESS_DENIED",
  WORKSPACE_OPERATION_FAILED: "WORKSPACE_OPERATION_FAILED",
  EXPORT_FAILED: "EXPORT_FAILED",
  UPDATE_SIGNATURE_INVALID: "UPDATE_SIGNATURE_INVALID",
  UPDATE_PERMISSION_DENIED: "UPDATE_PERMISSION_DENIED",
  UPDATE_CONFIGURATION_INVALID: "UPDATE_CONFIGURATION_INVALID",
  UPDATE_NETWORK_FAILED: "UPDATE_NETWORK_FAILED",
  UPDATE_FAILED: "UPDATE_FAILED",
  IPC_COMMAND_FAILED: "IPC_COMMAND_FAILED",
  IPC_INVALID_RESPONSE: "IPC_INVALID_RESPONSE",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

export type KnownErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export type AppErrorEnvelope = {
  code: string;
  message?: string;
  details?: unknown;
};

export class AppError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readEnvelope(value: unknown): AppErrorEnvelope | null {
  if (typeof value === "string") {
    try {
      return readEnvelope(JSON.parse(value) as unknown);
    } catch {
      return null;
    }
  }

  if (!isRecord(value) || typeof value.code !== "string" || value.code.length === 0) return null;
  return {
    code: value.code,
    message: typeof value.message === "string" ? value.message : undefined,
    details: value.details,
  };
}

function rawMessage(cause: unknown, fallback: string): string {
  if (cause instanceof Error && cause.message) return cause.message;
  if (typeof cause === "string" && cause) return cause;
  return fallback;
}

export function normalizeAppError(
  cause: unknown,
  fallbackCode: KnownErrorCode = ERROR_CODES.UNKNOWN_ERROR,
  fallbackMessage = "操作失败。",
): AppError {
  if (cause instanceof AppError) return cause;

  const envelope = readEnvelope(cause);
  if (envelope) {
    return new AppError(envelope.code, envelope.message || fallbackMessage, envelope.details);
  }

  return new AppError(fallbackCode, rawMessage(cause, fallbackMessage));
}

export function errorCodeForIpcCommand(command: string): KnownErrorCode {
  if (command === "authorize_stored_path") return ERROR_CODES.WORKSPACE_ACCESS_DENIED;
  if (command === "read_text_file" || command === "read_previous_version" || command === "read_binary_file") {
    return ERROR_CODES.FILE_READ_FAILED;
  }
  if (command === "write_text_file" || command === "write_binary_file") return ERROR_CODES.FILE_WRITE_FAILED;
  if (
    command === "write_binary_file_chunk" ||
    command === "write_binary_file_chunk_raw" ||
    command === "commit_binary_file" ||
    command === "discard_binary_file" ||
    command === "export_pdf_file"
  ) {
    return ERROR_CODES.EXPORT_FAILED;
  }
  if (
    command === "list_workspace_files" ||
    command === "list_workspace_entries" ||
    command === "list_workspace_directories" ||
    command === "search_workspace" ||
    command === "index_workspace" ||
    command === "refresh_workspace" ||
    command === "watch_workspace" ||
    command === "unwatch_workspace" ||
    command === "read_annotations" ||
    command === "write_annotations"
  ) {
    return ERROR_CODES.WORKSPACE_OPERATION_FAILED;
  }
  return ERROR_CODES.IPC_COMMAND_FAILED;
}
