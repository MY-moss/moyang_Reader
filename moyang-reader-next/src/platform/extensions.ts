import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./bridge";
import { emptyExtensionState, type ExtensionState, type McpConfiguration } from "../shared/extension-types";

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("moyang-extensions", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("state");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("无法打开扩展存储，请检查浏览器的存储权限。"));
  });
}
export async function loadExtensions(): Promise<ExtensionState> {
  if (isTauriRuntime()) return invoke("extension_request", { operation: "load", payload: {} });
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("state", "readonly"),
      request = transaction.objectStore("state").get("current");
    let result: ExtensionState;
    request.onsuccess = () => {
      result = request.result ?? emptyExtensionState();
    };
    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error ?? new Error("读取扩展已中断。"));
    };
  });
}
export async function saveExtensions(state: ExtensionState): Promise<ExtensionState> {
  if (isTauriRuntime()) return invoke("extension_request", { operation: "save", payload: state });
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("state", "readwrite"),
      store = transaction.objectStore("state");
    const request = store.get("current");
    let result: ExtensionState,
      conflict = false;
    request.onsuccess = () => {
      const old: ExtensionState = request.result ?? emptyExtensionState();
      if (old.revision !== state.revision) {
        conflict = true;
        transaction.abort();
        return;
      }
      result = { ...state, revision: state.revision + 1 };
      store.put(old, "previous");
      store.put(result, "current");
    };
    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      db.close();
      reject(new Error(conflict ? "扩展状态已在其他窗口更新，请重新加载后重试。" : "扩展未能保存，原状态仍保留。"));
    };
  });
}
export async function fetchExtensionJson(url: string): Promise<unknown> {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("目录地址必须是 HTTP 或 HTTPS。");
  if (isTauriRuntime()) return invoke("extension_request", { operation: "fetch", payload: { url } });
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), credentials: "omit" });
  if (!response.ok) throw new Error(`目录下载失败（${response.status}）。`);
  const content = await response.text();
  if (content.length > 16 * 1024 * 1024) throw new Error("目录超过 16 MB。");
  return JSON.parse(content);
}
export type McpInstallResult = { path: string; content: string; installed: boolean; owned: boolean; message: string };
export async function configureExtensionMcp(
  id: string,
  client: "codex" | "claude",
  action: "preview" | "install" | "remove",
  config: McpConfiguration,
): Promise<McpInstallResult> {
  if (!isTauriRuntime()) throw new Error("请在桌面版安装客户端配置；浏览器版可以复制通用配置。");
  return invoke("extension_request", { operation: "mcp", payload: { id, client, action, config } });
}
