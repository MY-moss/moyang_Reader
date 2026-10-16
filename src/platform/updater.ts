import type { DownloadEvent } from "@tauri-apps/plugin-updater";
import { invoke, Channel } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./bridge";

export type UpdateStatus = "idle" | "checking" | "available" | "downloading" | "ready" | "error" | "up-to-date";
export type Update = { version: string; body?: string; close: () => Promise<void> };
export async function previousUpdateFailure(): Promise<string | null> {
  return isTauriRuntime() ? invoke("online_update_failure") : null;
}

export async function getCurrentAppVersion(): Promise<string | null> {
  if (!isTauriRuntime()) return null;

  const { getVersion } = await import("@tauri-apps/api/app");
  return getVersion();
}

export async function checkForAppUpdate(): Promise<Update | null> {
  if (!isTauriRuntime()) return null;

  const found = await invoke<{ version: string; body?: string } | null>("online_update_check");
  return found ? { ...found, close: async () => undefined } : null;
}

export async function installAppUpdate(_update: Update, onEvent: (event: DownloadEvent) => void): Promise<void> {
  const channel = new Channel<DownloadEvent>();
  channel.onmessage = onEvent;
  await invoke("online_update_download", { channel });
}

export async function relaunchApp(): Promise<void> {
  if (!isTauriRuntime()) return;

  await invoke("online_update_activate");
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

  if (/endpoint|pubkey|updater.*config|not configured|plugin.*updater|updater.*not found/.test(message)) {
    return "更新服务尚未配置完成，当前版本仍可正常使用。";
  }

  if (/fetch|network|connection|timeout|404|not found|dns/.test(message)) {
    return "暂时无法连接更新服务器，请检查网络后重试。";
  }

  return "更新失败：" + raw;
}
