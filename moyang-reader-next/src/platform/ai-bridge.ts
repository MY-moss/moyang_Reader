import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./bridge";
import type { AiConnection } from "../shared/ai-types";
export async function aiRequest<T>(operation: string, payload: unknown = {}): Promise<T> {
  if (isTauriRuntime()) return invoke<T>("ai_request", { operation, payload });
  const { previewRequest } = await import("./ai-preview");
  return previewRequest(operation, payload) as T;
}
export async function aiConnection(): Promise<AiConnection> {
  if (isTauriRuntime()) return invoke("ai_connection_info");
  return { directory: "浏览器独立存储", executable: "", available: false, native: false };
}
