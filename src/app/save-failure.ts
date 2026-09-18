import { ERROR_CODES, normalizeAppError } from "./error-contract";

export type SaveFailureKind = "conflict" | "disk-full" | "read-only" | "missing" | "permission" | "unknown";

function failureText(cause: unknown): { code: string; message: string; details: string } {
  const error = normalizeAppError(cause, ERROR_CODES.FILE_WRITE_FAILED, "保存失败。");
  const details =
    typeof error.details === "string" ? error.details : error.details ? JSON.stringify(error.details) : "";
  return { code: error.code, message: error.message, details };
}

export function classifySaveFailure(cause: unknown): SaveFailureKind {
  const { code, message, details } = failureText(cause);
  const text = `${code} ${message} ${details}`.toLocaleLowerCase();

  if (code === ERROR_CODES.FILE_CONFLICT || /conflict|冲突|外部修改|其他程序修改/.test(text)) return "conflict";
  if (/disk full|no space|enospc|edquot|磁盘空间不足|磁盘已满|空间不足|磁盘配额/.test(text)) return "disk-full";
  if (/read.?only|write.?protect|readonly|只读|写保护|不可写/.test(text)) return "read-only";
  if (/not found|no such file|file not found|不存在|找不到|被删除|已移走|路径.*不存在/.test(text)) return "missing";
  if (/permission denied|access denied|权限|拒绝访问/.test(text)) return "permission";
  return "unknown";
}

const FAILURE_COPY: Record<SaveFailureKind, string> = {
  conflict: "文件版本发生冲突，原文件没有被自动覆盖。",
  "disk-full": "磁盘空间不足，原文件没有被覆盖。",
  "read-only": "文件或所在文件夹不可写（可能是只读或写保护状态），原文件没有被覆盖。",
  missing: "原文件已不存在或被移走，当前内容没有被写回原路径。",
  permission: "当前路径没有写入权限，原文件没有被覆盖。",
  unknown: "保存没有完成，原文件没有被静默覆盖。",
};

export function formatSaveFailure(cause: unknown, draftSaved: boolean): string {
  const { message } = failureText(cause);
  const kind = classifySaveFailure(cause);
  const detail = message && message !== FAILURE_COPY[kind] ? `系统提示：${message}` : "";
  const recovery = draftSaved
    ? "当前内容已保留到草稿恢复中心。"
    : "当前内容仍保留在编辑区，请立即使用“另存为”保存副本。";
  return [FAILURE_COPY[kind], detail, recovery].filter(Boolean).join(" ");
}
