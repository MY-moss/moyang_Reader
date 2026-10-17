import { Channel, invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./bridge";
import type { ChatProvider, ChatUsage } from "../shared/chat-types";
import { providerModels } from "../shared/provider-models";
import { apiEndpoint, streamDecoder } from "../features/chat/protocol";

const keys = new Map<string, string>();
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("moyang-chat", 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("providers")) {
        request.result.createObjectStore("providers", { keyPath: "id" });
        request.result.createObjectStore("threads", { keyPath: "id" });
      }
      const summaries = request.result.createObjectStore("summaries", { keyPath: "id" });
      summaries.createIndex("recent", ["updatedAt", "id"]);
      const cursor = request.transaction!.objectStore("threads").openCursor();
      cursor.onsuccess = () => {
        if (cursor.result) {
          const copy = { ...cursor.result.value };
          delete copy.messages;
          summaries.put(copy);
          cursor.result.continue();
        }
      };
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
  if (operation === "threads_page")
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction("summaries", "readonly"),
        items: Record<string, unknown>[] = [];
      const before = payload.before as { updatedAt: number; id: string } | undefined;
      const cursor = tx
        .objectStore("summaries")
        .index("recent")
        .openCursor(before ? IDBKeyRange.upperBound([before.updatedAt, before.id], true) : null, "prev");
      let next: unknown = null;
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (!row) return;
        if (items.length === 20) {
          const last = items[19];
          next = { id: last.id, updatedAt: last.updatedAt };
          return;
        }
        items.push(row.value);
        row.continue();
      };
      tx.oncomplete = () => {
        db.close();
        resolve({ items, next } as T);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  return new Promise((resolve, reject) => {
    const tx = db.transaction(providers ? storeName : [storeName, "summaries"], "readwrite"),
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
        if (!providers) tx.objectStore("summaries").delete(id);
        result = null;
      } else if (operation === "save_provider") {
        const hasKey = payload.clearKey ? false : Boolean(payload.apiKey || keys.has(id));
        const modelOptions = structuredClone(payload.modelOptions ?? old?.modelOptions ?? {}) as NonNullable<
          ChatProvider["modelOptions"]
        >;
        if (
          old &&
          (old.baseUrl !== payload.baseUrl ||
            old.protocol !== payload.protocol ||
            payload.clearKey ||
            (payload.apiKey && payload.apiKey !== keys.get(id)))
        ) {
          for (const option of Object.values(modelOptions)) delete option.testedAt;
        }
        result = {
          id,
          name: payload.name,
          protocol: payload.protocol,
          baseUrl: payload.baseUrl,
          model: payload.model,
          models: providerModels({
            model: String(payload.model ?? ""),
            models: (payload.models ?? old?.models) as string[] | undefined,
          }),
          favorites: payload.favorites ?? old?.favorites ?? [],
          modelOptions,
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
        const summary = { ...(result as Record<string, unknown>) };
        delete summary.messages;
        tx.objectStore("summaries").put(summary);
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
  if ([400, 422].includes(response.status)) {
    const detail = await response
      .clone()
      .json()
      .catch(() => null);
    if (/stream_options|include_usage/i.test(String(detail?.error?.message ?? "")))
      throw new Error(`服务拒绝 stream_options（${response.status}）`);
  }
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

async function streamChatOnce(
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

export async function streamChat(
  provider: ChatProvider,
  body: unknown,
  signal: AbortSignal,
  onText: (text: string) => void,
  onUsage: (usage: ChatUsage) => void,
): Promise<void> {
  let received = false;
  const text = (chunk: string) => {
    received = true;
    onText(chunk);
  };
  try {
    await streamChatOnce(provider, body, signal, text, onUsage);
  } catch (error) {
    const options = body as Record<string, unknown>;
    // Retry only an explicit parameter rejection before any answer, never a timeout or quota error.
    if (
      !signal.aborted &&
      !received &&
      provider.protocol === "openai" &&
      options?.stream_options &&
      /(?:400|422)/.test(String(error)) &&
      /stream_options|include_usage/i.test(String(error))
    ) {
      const compatible = { ...options };
      delete compatible.stream_options;
      await streamChatOnce(provider, compatible, signal, onText, onUsage);
    } else throw error;
  }
}
