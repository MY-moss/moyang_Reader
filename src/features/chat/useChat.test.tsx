import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { chatRequest } from "../../platform/chat";
import { useChat } from "./useChat";
import type { ChatThread } from "../../shared/chat-types";
import { flushPendingWork } from "../../shared/pending-work";

vi.mock("../../platform/chat", () => ({ chatRequest: vi.fn(), streamChat: vi.fn() }));
let root: ReturnType<typeof createRoot>;
afterEach(async () => {
  await act(async () => root?.unmount());
  localStorage.clear();
  vi.resetAllMocks();
});

it("locks conversation edits until a delayed switch is complete and retains the original draft", async () => {
  let finish!: (thread: ChatThread) => void;
  let saved!: ChatThread;
  vi.mocked(chatRequest).mockImplementation(async (operation, payload) => {
    if (operation === "save_thread") {
      saved = payload as ChatThread;
      return new Promise((resolve) => {
        finish = resolve as (thread: ChatThread) => void;
      });
    }
    return [];
  });
  let model!: ReturnType<typeof useChat>;
  function Harness() {
    model = useChat([]);
    return null;
  }
  root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Harness />));
  const originalId = model.thread.id;
  await act(async () => model.setDraft("第一段未发送想法"));
  let opening!: Promise<void>;
  await act(async () => {
    opening = model.open();
  });
  await act(async () => model.setDraft("切换期间不应写进旧会话"));
  expect(localStorage.getItem(`moyang.chat.draft.${originalId}`)).toBe("第一段未发送想法");
  expect(model.switching).toBe(true);
  expect(model.open("another-conversation")).toBe(opening);
  let flushed = false;
  const closing = flushPendingWork().then(() => {
    flushed = true;
  });
  await act(async () => {
    await Promise.resolve();
  });
  expect(flushed).toBe(false);
  await act(async () => {
    finish({ ...saved, revision: 1 });
    await opening;
    await closing;
  });
  expect(flushed).toBe(true);
  expect(model.switching).toBe(false);
  expect(model.thread.id).not.toBe(originalId);
  expect(model.draft).toBe("");
  await act(async () => model.setDraft("第二段独立想法"));
  expect(localStorage.getItem(`moyang.chat.draft.${originalId}`)).toBe("第一段未发送想法");
  expect(localStorage.getItem(`moyang.chat.draft.${model.thread.id}`)).toBe("第二段独立想法");
});

it("keeps the current conversation editable after a failed switch save", async () => {
  vi.mocked(chatRequest).mockImplementation(async (operation) => {
    if (operation === "save_thread") throw new Error("disk unavailable");
    return [];
  });
  let model!: ReturnType<typeof useChat>;
  function Harness() {
    model = useChat([]);
    return null;
  }
  root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Harness />));
  const id = model.thread.id;
  await act(async () => model.setDraft("保存失败也必须保留"));
  await act(async () => {
    await expect(model.open()).rejects.toThrow("disk unavailable");
  });
  expect(model.switching).toBe(false);
  expect(model.thread.id).toBe(id);
  expect(model.draft).toBe("保存失败也必须保留");
  await act(async () => model.setDraft("仍能继续修改"));
  expect(localStorage.getItem(`moyang.chat.draft.${id}`)).toBe("仍能继续修改");
});

it("retries failed initial storage reads and restores the existing draft identity", async () => {
  localStorage.setItem("moyang.chat.last", "existing");
  localStorage.setItem("moyang.chat.draft.existing", "不要丢失的草稿");
  const thread = { id: "existing", title: "已有对话", messages: [], revision: 2 };
  vi.mocked(chatRequest)
    .mockRejectedValueOnce(new Error("database is locked"))
    .mockImplementation(async (operation) => (operation === "thread" ? thread : []));
  let model!: ReturnType<typeof useChat>;
  function Harness() {
    model = useChat([]);
    return null;
  }
  root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Harness />));
  expect(model.ready).toBe(false);
  expect(model.error).toContain("database is locked");
  expect(localStorage.getItem("moyang.chat.draft.existing")).toBe("不要丢失的草稿");
  await act(async () => model.reload());
  expect(model.ready).toBe(true);
  expect(model.error).toBe("");
  expect(model.thread.id).toBe("existing");
  expect(model.draft).toBe("不要丢失的草稿");
});
