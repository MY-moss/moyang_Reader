import { bookroomRequest } from "./bookroom-bridge";
import { isTauriRuntime } from "./bridge";
import { normalizePathKey } from "./path-key";
import {
  draftBytes,
  draftSummary,
  READER_DRAFT_BUDGET,
  type DraftSnapshot,
  type DraftSummary,
} from "../shared/reader-draft-types";

let opening: Promise<IDBDatabase> | undefined;
function database() {
  if (!opening)
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("moyang-reader-recovery", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("drafts");
        request.result.createObjectStore("summaries");
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("草稿库升级被其他窗口阻止，请关闭其他窗口后重试"));
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          opening = undefined;
        };
        resolve(db);
      };
    }).catch((error) => {
      opening = undefined;
      throw error;
    });
  return opening;
}
export async function readerDraftRequest<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const path = (payload.snapshot as DraftSnapshot | undefined)?.path ?? payload.path;
  const key = typeof path === "string" ? normalizePathKey(path) : "";
  if (isTauriRuntime()) return bookroomRequest<T>({ action: `draft.${action}`, ...payload, key });
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const write = ["put", "delete", "clear", "import"].includes(action);
    const tx = db.transaction(["drafts", "summaries"], write ? "readwrite" : "readonly");
    const drafts = tx.objectStore("drafts"),
      summaries = tx.objectStore("summaries");
    let result: unknown;
    let failure: Error | undefined;
    tx.oncomplete = () => resolve(result as T);
    tx.onabort = () => reject(failure ?? tx.error ?? new Error("草稿事务未完成"));
    tx.onerror = () => {
      /* onabort reports failure after rollback. */
    };
    if (action === "list") {
      summaries.getAll().onsuccess = (e) => {
        result = (e.target as IDBRequest).result as DraftSummary[];
      };
    } else if (action === "get")
      drafts.get(key).onsuccess = (e) => {
        result = (e.target as IDBRequest).result ?? null;
      };
    else if (action === "clear") {
      drafts.clear();
      summaries.clear();
    } else if (action === "delete") {
      drafts.get(key).onsuccess = (e) => {
        const current = (e.target as IDBRequest).result as DraftSnapshot | undefined;
        if (payload.expectedDraft !== undefined && current?.draft !== payload.expectedDraft) return;
        drafts.delete(key);
        summaries.delete(key);
      };
    } else if (action === "put" || action === "import") {
      const item = payload.snapshot as DraftSnapshot;
      const itemKey = normalizePathKey(item.path);
      summaries.getAll().onsuccess = (e) => {
        const existing = (e.target as IDBRequest).result as (DraftSummary & { key: string; bytes: number })[];
        if (action === "import" && existing.some((s) => s.key === itemKey)) return;
        const bytes = draftBytes(item);
        if (existing.filter((s) => s.key !== itemKey).reduce((n, s) => n + s.bytes, 0) + bytes > READER_DRAFT_BUDGET) {
          failure = new Error("草稿空间已达 256 MiB，请先保存或处理已有草稿");
          tx.abort();
          return;
        }
        drafts.put(item, itemKey);
        summaries.put({ ...draftSummary(item), key: itemKey, bytes }, itemKey);
      };
    } else {
      failure = new Error("未知草稿操作");
      tx.abort();
    }
  });
}
