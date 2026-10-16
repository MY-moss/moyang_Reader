import type { AiDraft } from "./AiEditor";
import type { AiAsset } from "../../shared/ai-types";
type StoredDraft = Omit<AiDraft, "fields"> & { fields: Omit<AiDraft["fields"], "assets"> };
let database: Promise<IDBDatabase> | undefined;
const assetsWritten = new Map<string, AiAsset[]>();
function summary(d: StoredDraft): AiDraft {
  return { ...d, baseBody: undefined, deferred: true, fields: { ...d.fields, body: "", snapshot: null, assets: [] } };
}
function db() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("moyang-ai-drafts", 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("drafts")) {
        request.result.createObjectStore("drafts");
        request.result.createObjectStore("assets");
      }
      const summaries = request.result.createObjectStore("summaries");
      const cursor = request.transaction!.objectStore("drafts").openCursor();
      cursor.onsuccess = () => {
        if (cursor.result) {
          summaries.put(summary(cursor.result.value), cursor.result.key);
          cursor.result.continue();
        }
      };
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = undefined;
      reject(request.error);
    };
  }));
}
export async function readAiDraft(key: string): Promise<AiDraft | null> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(["drafts", "assets"], "readonly");
    const draft = tx.objectStore("drafts").get(key),
      resources = tx.objectStore("assets").get(key);
    tx.oncomplete = () => {
      if (!draft.result) {
        resolve(null);
        return;
      }
      const assets = resources.result ?? [];
      assetsWritten.set(key, assets);
      resolve({ ...draft.result, deferred: false, fields: { ...draft.result.fields, assets } });
    };
    tx.onerror = () => reject(tx.error);
  });
}
export async function readAiDrafts(): Promise<AiDraft[]> {
  const database = await db();
  const values = await new Promise<AiDraft[]>((resolve, reject) => {
    const tx = database.transaction("summaries", "readonly"),
      request = tx.objectStore("summaries").getAll();
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
  });
  const legacy = localStorage.getItem("moyang-ai-editing-draft");
  if (legacy) {
    let d: AiDraft | null = null;
    try {
      d = JSON.parse(legacy);
    } catch {
      /* Preserve malformed legacy content for recovery. */
    }
    if (d?.fields && !values.some((v) => (d!.id ? v.id === d!.id : v.key === d!.key && !!d!.key))) {
      d.key ??= crypto.randomUUID();
      await writeAiDraft(d);
      values.push(summary(d));
    }
  }
  return values;
}
export async function writeAiDraft(draft: AiDraft) {
  if (draft.deferred) return; // A list placeholder must never overwrite a recoverable body.
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(["drafts", "assets", "summaries"], "readwrite");
    const { assets, ...fields } = draft.fields;
    tx.objectStore("drafts").put({ ...draft, fields }, draft.key!);
    tx.objectStore("summaries").put(summary({ ...draft, fields }), draft.key!);
    if (assetsWritten.get(draft.key!) !== assets) tx.objectStore("assets").put(assets, draft.key!);
    tx.oncomplete = () => {
      assetsWritten.set(draft.key!, assets);
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
  localStorage.removeItem("moyang-ai-editing-draft");
}
export async function removeAiDraft(key: string) {
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(["drafts", "assets", "summaries"], "readwrite");
    for (const name of ["drafts", "assets", "summaries"]) tx.objectStore(name).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  assetsWritten.delete(key);
}
