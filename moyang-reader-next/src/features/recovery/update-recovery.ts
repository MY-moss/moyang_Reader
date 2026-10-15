const updateRecoveryKey = "moyang-reader-update-recovery";

export type UpdateRecoveryRecord = {
  attemptedVersion: string;
  currentVersion: string | null;
  failedAt: number;
  reason: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function loadUpdateRecovery(): UpdateRecoveryRecord | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(updateRecoveryKey) ?? "null");
    if (
      !isRecord(parsed) ||
      typeof parsed.attemptedVersion !== "string" ||
      !parsed.attemptedVersion.trim() ||
      (parsed.currentVersion !== null && typeof parsed.currentVersion !== "string") ||
      typeof parsed.failedAt !== "number" ||
      !Number.isFinite(parsed.failedAt) ||
      typeof parsed.reason !== "string"
    ) {
      return null;
    }
    return {
      attemptedVersion: parsed.attemptedVersion,
      currentVersion: parsed.currentVersion,
      failedAt: parsed.failedAt,
      reason: parsed.reason,
    };
  } catch {
    return null;
  }
}

export function saveUpdateRecovery(record: UpdateRecoveryRecord): void {
  try {
    localStorage.setItem(updateRecoveryKey, JSON.stringify(record));
  } catch {
    // Recovery guidance is best-effort when local storage is unavailable.
  }
}

export function clearUpdateRecovery(): void {
  try {
    localStorage.removeItem(updateRecoveryKey);
  } catch {
    // Ignore unavailable local storage.
  }
}

export function formatUpdateRecoveryNotice(record: UpdateRecoveryRecord): string {
  const version = record.attemptedVersion.replace(/^v/i, "");
  return `上次更新到 v${version} 没有完成，当前版本仍保留。请不要降级安装；修复后发布更高的补丁版本再重试。${record.reason ? ` 原因：${record.reason}` : ""}`;
}
