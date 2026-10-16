import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { aiRequest } from "../../platform/ai-bridge";
import { emptyAiFields, type AiRecord } from "../../shared/ai-types";
import { sourceEntry } from "../../shared/ai-sources";
import { importAiPath } from "./transfers";
import { AiSources } from "./AiSources";
vi.mock("../../platform/ai-bridge", () => ({ aiRequest: vi.fn() }));
vi.mock("../../platform/bridge", () => ({ isTauriRuntime: () => true, openExternalUrl: vi.fn() }));
vi.mock("./transfers", () => ({ importAiPath: vi.fn(), importAiWeb: vi.fn(), importAiFile: vi.fn() }));
const entry: AiRecord = {
  ...emptyAiFields("knowledge"),
  id: "source",
  title: "项目文档",
  body: "已保存的正文",
  revision: 1,
  state: "active",
  created_at: 1,
  updated_at: 1,
  snapshot: {
    uri: "D:/source.md",
    format: "markdown",
    fingerprint: "old",
    imported_at: 1,
    checked_at: null,
    locations: [],
  },
};
it("checks without writes, previews fresh content, retains failed saves and updates with revision/history", async () => {
  const host = document.createElement("div"),
    root = createRoot(host);
  document.body.append(host);
  let current = entry;
  let failSave = true;
  const notify = vi.fn();
  vi.mocked(aiRequest).mockImplementation(async (op, payload: any) => {
    if (op === "source_inventory") return { items: [sourceEntry(current)], total: 1, next_cursor: null };
    if (op === "get") return current;
    if (op === "save") {
      if (failSave) throw new Error("记录已更新");
      current = { ...payload, revision: 2 };
      return current;
    }
    throw new Error(op);
  });
  vi.mocked(importAiPath).mockResolvedValue({
    ...entry,
    body: "新的正文",
    snapshot: { ...entry.snapshot!, fingerprint: "new" },
  });
  const click = async (text: string) =>
    act(async () => {
      [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(text))!.click();
    });
  try {
    await act(async () => root.render(<AiSources notify={notify} />));
    await click("检查全部来源");
    expect(host.textContent).toContain("来源已变化");
    expect(vi.mocked(aiRequest).mock.calls.some(([op]) => op === "save")).toBe(false);
    await click("查看差异");
    expect(host.textContent).toContain("已保存的正文");
    expect(host.textContent).toContain("新的正文");
    await click("更新快照并保留历史");
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("记录已更新"), true);
    expect(host.textContent).toContain("新的正文");
    failSave = false;
    await click("更新快照并保留历史");
    expect(aiRequest).toHaveBeenCalledWith(
      "save",
      expect.objectContaining({
        id: entry.id,
        expected_revision: 1,
        reason: "检查差异后更新来源快照",
        snapshot: expect.objectContaining({ checked_at: expect.any(Number) }),
      }),
    );
    await click("返回来源列表");
    expect(host.textContent).toContain("没有变化");
    expect(host.textContent).not.toContain("新的正文");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.clearAllMocks();
  }
});
it("does not reopen a comparison after leaving it during a delayed reread", async () => {
  const host = document.createElement("div"),
    root = createRoot(host);
  document.body.append(host);
  let resolve!: (value: AiRecord) => void;
  vi.mocked(aiRequest).mockImplementation(async (op) =>
    op === "source_inventory" ? { items: [sourceEntry(entry)], total: 1, next_cursor: null } : entry,
  );
  vi.mocked(importAiPath).mockResolvedValue({
    ...entry,
    body: "新内容",
    snapshot: { ...entry.snapshot!, fingerprint: "new" },
  });
  const click = async (text: string) =>
    act(async () => {
      [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(text))!.click();
    });
  try {
    await act(async () => root.render(<AiSources notify={() => {}} />));
    await click("查看来源");
    vi.mocked(importAiPath).mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    await click("重新读取与比较");
    await click("返回来源列表");
    await act(async () => resolve({ ...entry, body: "迟到的正文" }));
    expect(host.textContent).not.toContain("迟到的正文");
    expect(host.textContent).not.toContain("返回来源列表");
    expect(host.textContent).toContain("检查全部来源");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.clearAllMocks();
  }
});
