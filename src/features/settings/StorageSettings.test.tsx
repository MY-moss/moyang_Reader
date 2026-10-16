import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { StorageSettings } from "./StorageSettings";
import {
  chooseStorageTarget,
  prepareStorageMove,
  startStorageMove,
  storageInfo,
} from "../../platform/storage-management";
vi.mock("../../platform/storage-management", () => ({
  storageInfo: vi.fn(),
  chooseStorageTarget: vi.fn(),
  prepareStorageMove: vi.fn(),
  startStorageMove: vi.fn(),
}));
let root: ReturnType<typeof createRoot>;
afterEach(async () => {
  await act(async () => root?.unmount());
  vi.resetAllMocks();
});
it("requires a checked plan and completed saves before starting a storage move", async () => {
  vi.mocked(storageInfo).mockResolvedValue({
    native: true,
    locations: [{ key: "data", label: "AI 与聊天", logical: "C:/Data", physical: "D:/Data", bytes: 1000, files: 3 }],
  });
  vi.mocked(chooseStorageTarget).mockResolvedValue("E:/MoyangData");
  vi.mocked(prepareStorageMove).mockResolvedValue({ target: "E:/MoyangData", items: [], bytes: 1000, free: 100000 });
  const beforeRestart = vi.fn().mockRejectedValueOnce(new Error("文档冲突尚未处理")).mockResolvedValue(undefined);
  const container = document.createElement("div");
  root = createRoot(container);
  await act(async () => root.render(<StorageSettings beforeRestart={beforeRestart} />));
  const click = async (text: string) => {
    const button = [...container.querySelectorAll("button")].find((b) => b.textContent === text);
    expect(button).toBeTruthy();
    await act(async () => button!.click());
  };
  expect(container.textContent).toContain("D:/Data");
  expect(container.textContent).not.toContain("保存并迁移");
  await click("选择新位置");
  await click("检查迁移");
  await click("保存并迁移");
  expect(startStorageMove).not.toHaveBeenCalled();
  expect(container.textContent).toContain("文档冲突尚未处理");
  await click("保存并迁移");
  expect(startStorageMove).toHaveBeenCalledOnce();
});
