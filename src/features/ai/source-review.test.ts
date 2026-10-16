import { expect, it, vi } from "vitest";
import { previewSourceInventory, sourceEntry } from "../../shared/ai-sources";
import { emptyAiFields, type AiRecord } from "../../shared/ai-types";
import { reviewSources, type SourceResult } from "./source-review";

const record = (id: string, project = "p"): AiRecord => ({
  ...emptyAiFields("knowledge"),
  id,
  title: id,
  project,
  body: "私有正文",
  revision: 1,
  state: "active",
  created_at: 1,
  updated_at: 1,
  snapshot: {
    uri: `D:/${id}.md`,
    format: "markdown",
    fingerprint: "old",
    imported_at: 1,
    checked_at: null,
    locations: [],
  },
});
it("lists only imported active knowledge with stable cursors and explicit global scope", () => {
  const records = [
    record("b"),
    record("a"),
    record("global", ""),
    record("other", "q"),
    { ...record("manual"), snapshot: null },
    { ...record("memory"), kind: "memory" as const },
    { ...record("archived"), state: "archived" as const },
  ];
  const first = previewSourceInventory(records, { project: "p", limit: 1 });
  expect(first.total).toBe(2);
  expect(first.items.map((r) => r.id)).toEqual(["a"]);
  expect(first.next_cursor).toBe("a");
  expect(
    previewSourceInventory(records, { project: "p", limit: 1, cursor: first.next_cursor! }).items.map((r) => r.id),
  ).toEqual(["b"]);
  expect(previewSourceInventory(records, { project: "p", include_global: true }).total).toBe(3);
  expect(previewSourceInventory(records, { project: "" }).items.map((r) => r.id)).toEqual(["global"]);
  expect(JSON.stringify(first)).not.toContain("私有正文");
  const scoped = [
    { ...record("private-a"), sharing: "legacy" as const, agent: "a" },
    { ...record("private-b"), sharing: "legacy" as const, agent: "b" },
    { ...record("shared"), sharing: "project" as const, agent: "b" },
  ];
  expect(previewSourceInventory(scoped, { project: "p", agent: "a" }).items.map((r) => r.id)).toEqual([
    "private-a",
    "shared",
  ]);
});
it("bounds work to two reads, stops scheduling and ignores late checks without keeping source bodies", async () => {
  const entries = ["a", "b", "c"].map((id) => sourceEntry(record(id)));
  const pending: Array<(value: AiRecord) => void> = [];
  const read = vi.fn(() => new Promise<AiRecord>((resolve) => pending.push(resolve)));
  const results: Record<string, SourceResult> = {};
  let stopped = false;
  const done = reviewSources(
    entries,
    (id, result) => {
      results[id] = result;
    },
    () => stopped,
    read,
  );
  expect(read).toHaveBeenCalledTimes(2);
  pending[0](record("a"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(read).toHaveBeenCalledTimes(3);
  expect(results.a.status).toBe("unchanged");
  stopped = true;
  pending[1](record("b"));
  pending[2](record("c"));
  await done;
  expect(results.b.status).toBe("checking");
  expect(results.c.status).toBe("checking");
  expect(JSON.stringify(results)).not.toContain("私有正文");
  const stopRead = vi.fn(async () => {
    stopped = true;
    return record("a");
  });
  stopped = false;
  await reviewSources(
    entries,
    () => {},
    () => stopped,
    stopRead,
  );
  expect(stopRead).toHaveBeenCalledTimes(1);
});
it("distinguishes changed, unreadable, empty and manual sources while continuing other checks", async () => {
  const results: Record<string, SourceResult> = {};
  await reviewSources(
    ["changed", "failure", "empty", "manual"].map((id) => sourceEntry(record(id))),
    (id, r) => {
      results[id] = r;
    },
    () => false,
    async (entry) => {
      if (entry.id === "failure") throw new Error("原文件已移动");
      if (entry.id === "manual") return null;
      if (entry.id === "empty") return { ...record(entry.id), body: "  " };
      return { ...record(entry.id), snapshot: { ...record(entry.id).snapshot!, fingerprint: "new" } };
    },
  );
  expect(results.changed.status).toBe("changed");
  expect(results.failure.status).toBe("error");
  expect(results.empty.status).toBe("error");
  expect(results.manual.status).toBe("manual");
  expect(results.failure.error).toContain("原文件已移动");
});
