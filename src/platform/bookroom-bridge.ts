import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./bridge";
/** Browser metadata is intentionally separate from the native reader database. */
export async function bookroomRequest<T>(request: Record<string, unknown>): Promise<T> {
  if (isTauriRuntime()) return invoke<T>("bookroom_request", { request });
  const key = `moyang.bookroom.${request.category}`;
  const items: Array<{ id: string }> = JSON.parse(localStorage.getItem(key) ?? "[]");
  if (request.action === "metadata.list") return items as T;
  if (request.action === "metadata.put") {
    const item = request.item as { id: string };
    localStorage.setItem(key, JSON.stringify([item, ...items.filter((entry) => entry.id !== item.id)]));
    return item as T;
  }
  if (request.action === "metadata.delete") {
    localStorage.setItem(key, JSON.stringify(items.filter((entry) => entry.id !== request.id)));
    return undefined as T;
  }
  if (request.action === "history.list" || request.action === "trash.list") return [] as T;
  throw new Error("此操作需要桌面版的本地文件访问能力。");
}
