import { isTauriRuntime } from "./bridge";
import type { DownloadEvent, Update } from "@tauri-apps/plugin-updater";
import { ERROR_CODES, normalizeAppError } from "./error-contract";
import { translate, type Locale } from "./i18n";

export type UpdateStatus = "idle" | "checking" | "available" | "downloading" | "ready" | "error" | "up-to-date";

export function updateActionForStatus(status: UpdateStatus): "check" | "open" {
  return status === "available" || status === "downloading" || status === "ready" ? "open" : "check";
}

export async function getCurrentAppVersion(): Promise<string | null> {
  if (!isTauriRuntime()) return null;

  const { getVersion } = await import("@tauri-apps/api/app");
  return getVersion();
}

export async function checkForAppUpdate(): Promise<Update | null> {
  if (!isTauriRuntime()) return null;

  const { check } = await import("@tauri-apps/plugin-updater");
  return check({ timeout: 8_000 });
}

export async function installAppUpdate(update: Update, onEvent: (event: DownloadEvent) => void): Promise<void> {
  await update.downloadAndInstall(onEvent, { timeout: 10 * 60_000 });
}

export async function relaunchApp(): Promise<void> {
  if (!isTauriRuntime()) return;

  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}

export function describeUpdateError(cause: unknown, locale: Locale = "zh-CN"): string {
  const error = normalizeAppError(cause, ERROR_CODES.UPDATE_FAILED, "更新失败。");
  switch (error.code) {
    case ERROR_CODES.UPDATE_SIGNATURE_INVALID:
      return translate(locale, "error.updateSignature");
    case ERROR_CODES.UPDATE_PERMISSION_DENIED:
      return translate(locale, "error.updatePermission");
    case ERROR_CODES.UPDATE_CONFIGURATION_INVALID:
      return translate(locale, "error.updateConfiguration");
    case ERROR_CODES.UPDATE_NETWORK_FAILED:
      return translate(locale, "error.updateNetwork");
    default:
      return translate(locale, "error.updateFailed") + error.message;
  }
}
