import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { aiRequest } from "../../platform/ai-bridge";
import { loadExtensions, saveExtensions } from "../../platform/extensions";
import { emptyExtensionState, type ExtensionState, type ExtensionPackage } from "../../shared/extension-types";
import type { AiRecord } from "../../shared/ai-types";
import { parseSkill } from "../ai/transfers";
import { builtInCatalog } from "./catalog";
import { useExtensions } from "./useExtensions";

vi.mock("../../platform/extensions", () => ({
  loadExtensions: vi.fn(),
  saveExtensions: vi.fn(),
  fetchExtensionJson: vi.fn(),
  configureExtensionMcp: vi.fn(),
}));
let root: ReturnType<typeof createRoot>;
let disk: ExtensionState;
const source = "内置精选";
const original = builtInCatalog.find((pkg) => pkg.id === "moyang.evidence-memory")!;
const candidate: ExtensionPackage = {
  ...original,
  version: "1.1.0",
  skill: { ...original.skill!, body: original.skill!.body + "\n\n作者新增的方法。" },
};

beforeEach(() => {
  localStorage.clear();
  disk = emptyExtensionState();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  vi.mocked(loadExtensions).mockImplementation(async () => structuredClone(disk));
  vi.mocked(saveExtensions).mockImplementation(async (next) => {
    if (next.revision !== disk.revision) throw new Error("扩展状态已在其他窗口更新");
    disk = structuredClone({ ...next, revision: next.revision + 1 });
    return structuredClone(disk);
  });
});
afterEach(async () => {
  await act(async () => root?.unmount());
  localStorage.clear();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

async function installedSkill() {
  const parsed = parseSkill(original.skill!.body);
  const record = await aiRequest<AiRecord>("save", {
    ...parsed,
    assets: original.skill!.assets,
    source: original.homepage,
    skill_meta: { ...parsed.skill_meta, extension_id: original.id, extension_version: original.version },
  });
  disk.installed = [
    { package: original, enabled: true, installedAt: 1, source, skillId: record.id, skillRevision: record.revision },
  ];
  return record;
}
async function harness() {
  let manager!: ReturnType<typeof useExtensions>;
  function Harness() {
    manager = useExtensions();
    return null;
  }
  root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Harness />));
  return {
    get manager() {
      return manager;
    },
  };
}
function lateConflict() {
  vi.mocked(saveExtensions).mockImplementationOnce(async () => {
    disk.revision++;
    disk.installed.push({
      package: builtInCatalog.find((pkg) => pkg.kind === "theme")!,
      enabled: true,
      source,
      installedAt: 2,
    });
    throw new Error("扩展状态已在其他窗口更新");
  });
}

it("rejects an already-stale skill update before changing the AI library", async () => {
  const originalRecord = await installedSkill();
  const h = await harness();
  disk.revision++;
  await act(async () => expect(await h.manager.install(candidate, source)).toBe(false));
  expect(await aiRequest("get", { id: originalRecord.id })).toEqual(originalRecord);
  expect(saveExtensions).not.toHaveBeenCalled();
  expect(h.manager.error).toContain("重新读取安装状态");
});

it("reports a partial write and retries only the installation record after reopening", async () => {
  const originalRecord = await installedSkill();
  const h = await harness();
  lateConflict();
  await act(async () => expect(await h.manager.install(candidate, source)).toBe(false));
  expect(h.manager.error).toContain("技能内容已写入 AI 技能库");
  expect(h.manager.state.installed[0].package.version).toBe(original.version);
  const updated = await aiRequest<AiRecord>("get", { id: originalRecord.id });
  expect(updated.revision).toBe(originalRecord.revision + 1);
  expect(updated.body).toContain("作者新增的方法");
  await act(async () => root.unmount());
  const reopened = await harness();
  await act(async () => expect(await reopened.manager.install(candidate, source)).toBe(true));
  expect(disk.installed.find((item) => item.package.id === original.id)).toMatchObject({
    package: { version: candidate.version },
    skillId: updated.id,
    skillRevision: updated.revision,
  });
  expect(disk.installed.some((item) => item.package.kind === "theme")).toBe(true);
  expect(await aiRequest("get", { id: originalRecord.id })).toEqual(updated);
});

it("preserves edits after a partial write and lets the user install the author version as a copy", async () => {
  const originalRecord = await installedSkill();
  const h = await harness();
  lateConflict();
  await act(async () => expect(await h.manager.install(candidate, source)).toBe(false));
  const updated = await aiRequest<AiRecord>("get", { id: originalRecord.id });
  const edited = await aiRequest<AiRecord>("save", {
    ...updated,
    expected_revision: updated.revision,
    body: "用户后续核实的方法",
    reason: "用户编辑",
  });
  await act(async () => h.manager.reload());
  await act(async () => expect(await h.manager.install(candidate, source)).toBe(false));
  expect(h.manager.error).toContain("技能已经在本地或被 Agent 改进");
  expect(await aiRequest("get", { id: originalRecord.id })).toEqual(edited);
  await act(async () => expect(await h.manager.install(candidate, source, true)).toBe(true));
  expect(disk.installed.find((item) => item.package.id === original.id)?.skillId).not.toBe(edited.id);
  expect(await aiRequest("get", { id: originalRecord.id })).toEqual(edited);
});

it("retries an initial install after an installation-store failure without duplicating the skill", async () => {
  const h = await harness();
  vi.mocked(saveExtensions).mockRejectedValueOnce(new Error("扩展存储暂时无法写入"));
  await act(async () => expect(await h.manager.install(candidate, source)).toBe(false));
  const first = await aiRequest<{ records: AiRecord[] }>("backup");
  expect(first.records).toHaveLength(1);
  await act(async () => h.manager.reload());
  await act(async () => expect(await h.manager.install(candidate, source)).toBe(true));
  const retried = await aiRequest<{ records: AiRecord[] }>("backup");
  expect(retried.records).toEqual(first.records);
  expect(disk.installed[0].skillId).toBe(first.records[0].id);
});
