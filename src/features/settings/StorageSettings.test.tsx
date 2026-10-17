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
it("explains incomplete rollback and keeps original recovery paths visible", async () => {
  vi.mocked(storageInfo).mockResolvedValue({
    native: true,
    locations: [],
    report: {
      status: "error",
      message: "迁移中断",
      target: "D:/MoyangData",
      rollback_complete: false,
      rollback_errors: ["原位置被其他程序重新创建"],
      retained: ["C:/data.moyang-moved-original"],
    },
  });
  const container = document.createElement("div");
  root = createRoot(container);
  await act(async () => root.render(<StorageSettings />));
  const report = container.querySelector('[role="alert"]');
  expect(report?.textContent).toContain("不要删除这些数据");
  expect(report?.textContent).toContain("C:/data.moyang-moved-original");
  expect(report?.textContent).toContain("原位置被其他程序重新创建");
  expect(report?.textContent).not.toContain("可在确认新位置可用后处理");
});
it("does not mistake Windows casing, namespace or trailing separators for relocated data", async () => {
  vi.mocked(storageInfo).mockResolvedValue({
    native: true,
    locations: [{ key: "data", label: "Data", logical: "\\\\?\\C:\\DATA\\", physical: "C:/Data", bytes: 1, files: 1 }],
  });
  const container = document.createElement("div");
  root = createRoot(container);
  await act(async () => root.render(<StorageSettings />));
  expect(container.querySelector(".storage-alias")).toBeNull();
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
