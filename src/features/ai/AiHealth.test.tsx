import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { aiRequest } from "../../platform/ai-bridge";
import { previewHealth } from "../../shared/ai-health";
import { emptyAiFields, type AiRecord, type AiStats } from "../../shared/ai-types";
import { AiHealth } from "./AiHealth";
vi.mock("../../platform/ai-bridge", () => ({ aiRequest: vi.fn() }));
const row: AiRecord = {
  ...emptyAiFields("memory"),
  id: "entry",
  title: "待核对资料",
  body: "正文",
  source: "",
  revision: 1,
  state: "active",
  created_at: 1,
  updated_at: 1,
};

it("returns to an existing page after archiving the last item on the final page", async () => {
  const host = document.createElement("div"),
    root = createRoot(host);
  document.body.append(host);
  let archived = false;
  vi.mocked(aiRequest).mockImplementation(async (op, payload) => {
    if (op === "state") {
      archived = true;
      return { ...row, state: "archived", revision: 2 };
    }
    const offset = (payload as { offset: number }).offset;
    const report = previewHealth([row], {});
    return {
      ...report,
      scanned: archived ? 30 : 31,
      total: archived ? 30 : 31,
      offset,
      items: archived && offset === 30 ? [] : report.items,
    };
  });
  const click = async (text: string) =>
    act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === text)!.click());
  try {
    await act(async () => root.render(<AiHealth onSelect={() => {}} notify={() => {}} />));
    await click("下一页");
    expect(host.textContent).toContain("第 2 / 2 页");
    await click("归档");
    const requests = vi.mocked(aiRequest).mock.calls.filter(([op]) => op === "health");
    expect(requests.at(-1)?.[1]).toEqual(expect.objectContaining({ offset: 0 }));
    expect(host.textContent).not.toContain("第 2 / 1 页");
    expect(host.textContent).toContain("待核对资料");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.clearAllMocks();
  }
});
it("discards late scope responses, retains results on retry failure and uses current revision to undo archiving", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const pending: Array<{ payload: any; resolve: (value: unknown) => void; reject: (reason: unknown) => void }> = [];
  const notify = vi.fn();
  vi.mocked(aiRequest).mockImplementation((op, payload) => {
    if (op === "state") return Promise.resolve({ ...row, revision: 2, state: "archived" });
    return new Promise((resolve, reject) => pending.push({ payload, resolve, reject }));
  });
  try {
    await act(async () =>
      root.render(
        <AiHealth stats={{ projects: ["p"], agents: [] } as unknown as AiStats} onSelect={() => {}} notify={notify} />,
      ),
    );
    const select = host.querySelector("select")!;
    await act(async () => {
      select.value = "p";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => pending[0].resolve(previewHealth([row], {})));
    expect(host.textContent).not.toContain("待核对资料");
    await act(async () => pending[1].resolve(previewHealth([{ ...row, project: "p" }], { project: "p" })));
    const click = async (text: string) =>
      act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === text)!.click());
    await click("重新检查");
    await act(async () => pending[2].reject(new Error("读取失败")));
    expect(host.textContent).toContain("已保留上次结果");
    expect(host.textContent).toContain("待核对资料");
    await click("归档");
    expect(aiRequest).toHaveBeenCalledWith("state", { id: "entry", expected_revision: 1, state: "archived" });
    await act(async () => pending[3].resolve(previewHealth([], {})));
    await click("撤销归档");
    expect(aiRequest).toHaveBeenCalledWith("state", { id: "entry", expected_revision: 2, state: "active" });
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.clearAllMocks();
  }
});
