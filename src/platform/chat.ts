import { Channel, invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./bridge";
import type { ChatProvider, ChatUsage } from "../shared/chat-types";
import { apiEndpoint, streamDecoder } from "../features/chat/protocol";

const keys = new Map<string, string>();
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("moyang-chat", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("providers", { keyPath: "id" });
      request.result.createObjectStore("threads", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("无法打开聊天记录，请检查本机存储权限。"));
  });
}

export async function chatRequest<T>(operation: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (isTauriRuntime()) return invoke("chat_request", { operation, payload });
  const db = await database(),
    providers = operation.includes("provider"),
    storeName = providers ? "providers" : "threads";
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite"),
      store = tx.objectStore(storeName);
    let result: unknown,
      error: string | null = null;
    const id = String(payload.id ?? "");
    const request = operation === "providers" || operation === "threads" ? store.getAll() : store.get(id);
    request.onsuccess = () => {
      const old = request.result;
      if (operation === "providers") result = old.map((p: ChatProvider) => ({ ...p, hasKey: keys.has(p.id) }));
      else if (operation === "threads")
        result = old
          .map((thread: Record<string, unknown>) => {
            const copy = { ...thread };
            delete copy.messages;
            return copy;
          })
          .sort((a: { updatedAt: number }, b: { updatedAt: number }) => b.updatedAt - a.updatedAt);
      else if (operation === "thread") result = old ?? null;
      else if (operation.startsWith("delete_")) {
        store.delete(id);
        result = null;
      } else if (operation === "save_provider") {
        const hasKey = payload.clearKey ? false : Boolean(payload.apiKey || keys.has(id));
        result = {
          id,
          name: payload.name,
          protocol: payload.protocol,
          baseUrl: payload.baseUrl,
          model: payload.model,
          hasKey,
        };
        store.put(result);
      } else if (operation === "save_thread") {
        if ((old?.revision ?? 0) !== (payload.revision ?? 0)) {
          error = "此会话已被另一窗口修改，请导出当前内容后重新打开。";
          tx.abort();
          return;
        }
        result = { ...payload, revision: Number(payload.revision ?? 0) + 1 };
        store.put(result);
      } else {
        error = "未知聊天操作。";
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      if (operation === "save_provider") {
        if (payload.clearKey) keys.delete(id);
        else if (payload.apiKey) keys.set(id, String(payload.apiKey));
      } else if (operation === "delete_provider") keys.delete(id);
      db.close();
      resolve(result as T);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(new Error(error || "聊天内容未能保存，请重试。"));
    };
  });
}

function headers(provider: ChatProvider): Record<string, string> {
  const key = keys.get(provider.id);
  return {
    "Content-Type": "application/json",
    ...(provider.protocol === "anthropic"
      ? {
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
          ...(key ? { "x-api-key": key } : {}),
        }
      : key
        ? { Authorization: `Bearer ${key}` }
        : {}),
  };
}

async function checkResponse(response: Response) {
  if (response.ok) return;
  throw new Error(
    response.status === 401 || response.status === 403
      ? "服务拒绝了连接，请检查 API 密钥和权限。"
      : response.status === 429
        ? "请求过多或额度不足，请稍后重试。"
        : `服务请求失败（${response.status}），请检查地址与模型。`,
  );
}

export async function chatModels(provider: ChatProvider): Promise<string[]> {
  if (isTauriRuntime()) return invoke("chat_models", { providerId: provider.id });
  const response = await fetch(apiEndpoint(provider.baseUrl, provider.protocol, true), {
    headers: headers(provider),
    signal: AbortSignal.timeout(20000),
    credentials: "omit",
    redirect: "error",
  });
  await checkResponse(response);
  const result = await response.json();
  return (result.data ?? []).map((item: { id: string }) => item.id).filter((id: unknown) => typeof id === "string");
}

export async function streamChat(
  provider: ChatProvider,
  body: unknown,
  signal: AbortSignal,
  onText: (text: string) => void,
  onUsage: (usage: ChatUsage) => void,
): Promise<void> {
  signal.throwIfAborted();
  const parser = streamDecoder(onText, onUsage);
  if (isTauriRuntime()) {
    const requestId = crypto.randomUUID(),
      channel = new Channel<number[]>();
    let parseError: unknown;
    const cancel = () => {
      void invoke("chat_cancel", { requestId }).catch(() => undefined);
    };
    channel.onmessage = (bytes) => {
      if (signal.aborted || parseError) return;
      try {
        parser.feed(new Uint8Array(bytes));
      } catch (cause) {
        parseError = cause;
        cancel();
      }
    };
    signal.addEventListener("abort", cancel, { once: true });
    try {
      await invoke("chat_stream", { requestId, providerId: provider.id, body, channel });
      if (parseError) throw parseError;
      signal.throwIfAborted();
      parser.finish();
    } catch (cause) {
      throw parseError ?? cause;
    } finally {
      signal.removeEventListener("abort", cancel);
    }
    return;
  }
  const response = await fetch(apiEndpoint(provider.baseUrl, provider.protocol), {
    method: "POST",
    headers: headers(provider),
    body: JSON.stringify(body),
    signal: AbortSignal.any([signal, AbortSignal.timeout(180000)]),
    credentials: "omit",
    redirect: "error",
  });
  await checkResponse(response);
  if (!response.body) throw new Error("服务未返回回答内容。");
  const reader = response.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.feed(value);
    }
    parser.finish();
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
