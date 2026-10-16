import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { chatRequest } from "../../platform/chat";
import { useChat } from "./useChat";

vi.mock("../../platform/chat", () => ({ chatRequest: vi.fn(), streamChat: vi.fn() }));
let root: ReturnType<typeof createRoot>;
afterEach(async () => {
  await act(async () => root?.unmount());
  localStorage.clear();
  vi.resetAllMocks();
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
