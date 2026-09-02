import { isTauriRuntime } from "./bridge";
import type { DownloadEvent, Update } from "@tauri-apps/plugin-updater";

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

export function describeUpdateError(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : String(cause);
  const message = raw.toLocaleLowerCase();

  if (/signature|public key|invalid key|verify/.test(message)) {
    return "更新包签名校验失败，已停止安装。请从 GitHub Release 页面手动下载可信版本。";
  }

  if (/permission|access denied|elevation|administrator/.test(message)) {
    return "更新需要系统权限，安装没有完成。可以稍后重试或从 GitHub Release 页面手动安装。";
  }

  if (/endpoint|pubkey|updater.*config|not configured/.test(message)) {
    return "更新服务尚未配置完成，当前版本仍可正常使用。";
  }

  if (/fetch|network|connection|timeout|404|not found|dns/.test(message)) {
    return "暂时无法连接更新服务器，请检查网络后重试。";
  }

  return "更新失败：" + raw;
}
