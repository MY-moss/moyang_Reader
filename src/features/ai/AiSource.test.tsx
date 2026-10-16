import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { AiSource } from "./AiSource";
import { importAiPath } from "./transfers";
import { aiRequest } from "../../platform/ai-bridge";
import { emptyAiFields, type AiRecord, type AiFields } from "../../shared/ai-types";
vi.mock("./transfers", () => ({ importAiPath: vi.fn(), importAiFile: vi.fn(), importAiWeb: vi.fn() }));
vi.mock("../../platform/ai-bridge", () => ({ aiRequest: vi.fn() }));
vi.mock("../../platform/bridge", () => ({ isTauriRuntime: () => true, openExternalUrl: vi.fn() }));
const entry = (id: string): AiRecord => ({
  ...emptyAiFields("knowledge"),
  id,
  title: id,
  body: "原文",
  revision: 1,
  created_at: 1,
  updated_at: 1,
  state: "active",
  snapshot: { uri: `D:/${id}.md`, format: "md", fingerprint: "old", imported_at: 1, checked_at: null, locations: [] },
});
it("does not attach a late source comparison to a different record or revision", async () => {
  const host = document.createElement("div"),
    root = createRoot(host);
  document.body.append(host);
  const onChange = vi.fn(),
    notify = vi.fn();
  let resolve!: (r: AiFields) => void;
  vi.mocked(importAiPath).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const render = async (record: AiRecord) =>
    act(async () => root.render(<AiSource key={record.id} record={record} onChange={onChange} notify={notify} />));
  const check = async () =>
    act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "检查来源更新")!.click());
  try {
    await render(entry("A"));
    await check();
    await render(entry("B"));
    await act(async () =>
      resolve({ ...entry("A"), body: "A 的新来源", snapshot: { ...entry("A").snapshot!, fingerprint: "new" } }),
    );
    expect(host.textContent).not.toContain("A 的新来源");
    await check();
    await act(async () =>
      resolve({ ...entry("B"), body: "B 的新来源", snapshot: { ...entry("B").snapshot!, fingerprint: "new" } }),
    );
    expect(host.textContent).toContain("B 的新来源");
    await render({ ...entry("B"), revision: 2 });
    expect(host.textContent).not.toContain("更新快照并保留历史");
    expect(aiRequest).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.clearAllMocks();
  }
});
it("finishes an authorized source save without moving a later selection back to the old record", async () => {
  const host = document.createElement("div"),
    root = createRoot(host);
  document.body.append(host);
  const onChange = vi.fn(),
    notify = vi.fn();
  let resolve!: (r: AiRecord) => void;
  vi.mocked(importAiPath).mockResolvedValue({
    ...entry("A"),
    body: "A 的新来源",
    snapshot: { ...entry("A").snapshot!, fingerprint: "new" },
  });
  vi.mocked(aiRequest).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const render = async (record: AiRecord) =>
    act(async () => root.render(<AiSource key={record.id} record={record} onChange={onChange} notify={notify} />));
  try {
    await render(entry("A"));
    await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "检查来源更新")!.click());
    await act(async () =>
      [...host.querySelectorAll("button")].find((b) => b.textContent === "更新快照并保留历史")!.click(),
    );
    expect(aiRequest).toHaveBeenCalledWith("save", expect.objectContaining({ id: "A", expected_revision: 1 }));
    await render(entry("B"));
    await act(async () => resolve({ ...entry("A"), revision: 2 }));
    expect(onChange).not.toHaveBeenCalled();
    expect(host.textContent).toContain("D:/B.md");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.clearAllMocks();
  }
});
