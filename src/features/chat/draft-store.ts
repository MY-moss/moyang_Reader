import type { ChatThread } from "../../shared/chat-types";
type Draft = { id: string; text: string; session?: ChatThread };
let opening: Promise<IDBDatabase> | undefined;
function database() {
  return (opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("moyang-chat-drafts", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      opening = undefined;
      reject(request.error);
    };
  }));
}
export async function writeChatDraft(value: Draft) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite");
    tx.objectStore("drafts").put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  localStorage.removeItem(`moyang.chat.draft.${value.id}`);
  localStorage.removeItem(`moyang.chat.session.${value.id}`);
}
export async function readChatDraft(id: string): Promise<Draft> {
  const db = await database();
  const value = await new Promise<Draft | undefined>((resolve, reject) => {
    const tx = db.transaction("drafts", "readonly"),
      request = tx.objectStore("drafts").get(id);
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
  });
  if (value) return value;
  const text = localStorage.getItem(`moyang.chat.draft.${id}`) ?? "";
  let session: ChatThread | undefined;
  try {
    const raw = JSON.parse(localStorage.getItem(`moyang.chat.session.${id}`) ?? "null");
    if (raw?.id === id && Array.isArray(raw.messages) && !raw.messages.length) session = raw;
  } catch {
    /* Keep malformed legacy data untouched. */
  }
  const draft = { id, text, session };
  if (text || session) await writeChatDraft(draft);
  return draft;
}
export async function removeChatDraft(id: string) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite");
    tx.objectStore("drafts").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  localStorage.removeItem(`moyang.chat.draft.${id}`);
  localStorage.removeItem(`moyang.chat.session.${id}`);
}
