import type { AiDraft } from "./AiEditor";
import type { AiAsset } from "../../shared/ai-types";
type StoredDraft = Omit<AiDraft, "fields"> & { fields: Omit<AiDraft["fields"], "assets"> };
let database: Promise<IDBDatabase> | undefined;
const assetsWritten = new Map<string, AiAsset[]>();
function db() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("moyang-ai-drafts", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("drafts");
      request.result.createObjectStore("assets");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}
export async function readAiDrafts(): Promise<AiDraft[]> {
  const database = await db();
  const values = await new Promise<AiDraft[]>((resolve, reject) => {
    const tx = database.transaction(["drafts", "assets"], "readonly");
    const metadata = tx.objectStore("drafts").getAll();
    const resources = tx.objectStore("assets").getAll();
    const keys = tx.objectStore("assets").getAllKeys();
    tx.oncomplete = () =>
      resolve(
        (metadata.result as StoredDraft[]).map((d) => {
          const assets = (resources.result[keys.result.indexOf(d.key!)] ?? []) as AiAsset[];
          assetsWritten.set(d.key!, assets);
          return { ...d, fields: { ...d.fields, assets } };
        }),
      );
    tx.onerror = () => reject(tx.error);
  });
  const legacy = localStorage.getItem("moyang-ai-editing-draft");
  if (legacy) {
    try {
      const d = JSON.parse(legacy) as AiDraft;
      if (d.fields && !values.some((v) => (d.id ? v.id === d.id : v.key === d.key && !!d.key))) {
        d.key = crypto.randomUUID();
        values.push(d);
        await writeAiDraft(d);
      }
    } catch {
      /* Ignore a malformed legacy draft without replacing current drafts. */
    }
  }
  return values;
}
export async function writeAiDraft(draft: AiDraft) {
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(["drafts", "assets"], "readwrite");
    const { assets, ...fields } = draft.fields;
    tx.objectStore("drafts").put({ ...draft, fields }, draft.key!);
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
    const tx = database.transaction(["drafts", "assets"], "readwrite");
    tx.objectStore("drafts").delete(key);
    tx.objectStore("assets").delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  assetsWritten.delete(key);
}
