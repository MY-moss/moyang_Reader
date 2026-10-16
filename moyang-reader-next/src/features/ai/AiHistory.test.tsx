import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { aiRequest } from "../../platform/ai-bridge";
import { emptyAiFields, type AiRecord } from "../../shared/ai-types";
import { AiHistory } from "./AiHistory";
vi.mock("../../platform/ai-bridge", () => ({ aiRequest: vi.fn() }));
vi.mock("../../shared/ai-resource-metadata", () => ({
  resourceMetadata: async (a: { path: string; encoding: string; content: string }) => ({
    ...a,
    size: a.content.length,
    fingerprint: a.content,
  }),
}));
afterEach(() => vi.clearAllMocks());

it("pages summaries and loads only the opened revision and selected historical resource", async () => {
  const record: AiRecord = {
    ...emptyAiFields("skill"),
    id: "skill",
    revision: 3,
    title: "review",
    body: "current body",
    created_at: 1,
    updated_at: 2,
    state: "active",
    assets: [{ path: "check.txt", encoding: "utf8", content: "new" }],
  };
  const summary = {
    revision: 2,
    title: "review",
    reason: "task evidence",
    recorded_at: 1,
    body_chars: 8,
    resource_count: 1,
  };
  vi.mocked(aiRequest).mockImplementation(async (op, payload) => {
    const p = payload as { before_revision?: number };
    if (op === "history_page")
      return p.before_revision
        ? { items: [{ ...summary, revision: 1 }], next_before: null }
        : { items: [summary], next_before: 2 };
    if (op === "revision_view")
      return {
        record: {
          ...record,
          revision: 2,
          body: "old body",
          assets: undefined,
          resources: [{ path: "check.txt", encoding: "utf8", size: 3, fingerprint: "old" }],
        },
        reason: "task evidence",
        recorded_at: 1,
      };
    if (op === "asset") return { path: "check.txt", encoding: "utf8", content: "old" };
    throw new Error(`Unexpected ${op}`);
  });
  const element = document.createElement("div");
  const root = createRoot(element);
  try {
    await act(async () => root.render(<AiHistory record={record} busy={false} onRestore={vi.fn()} />));
    expect(aiRequest).toHaveBeenCalledTimes(1);
    expect(element.textContent).not.toContain("old body");
    const entry = element.querySelector("details")!;
    await act(async () => {
      entry.open = true;
      entry.dispatchEvent(new Event("toggle"));
    });
    expect(aiRequest).toHaveBeenCalledWith("revision_view", { id: "skill", revision: 2 });
    expect(element.textContent).toContain("old body");
    expect(element.textContent).toContain("check.txt · 已修改");
    expect(vi.mocked(aiRequest).mock.calls.some(([op]) => op === "asset")).toBe(false);
    const resource = element.querySelector('[aria-label="资源版本变化"] details')! as HTMLDetailsElement;
    await act(async () => {
      resource.open = true;
      resource.dispatchEvent(new Event("toggle"));
    });
    expect(aiRequest).toHaveBeenCalledWith("asset", { id: "skill", revision: 2, path: "check.txt" });
    expect(Array.from(resource.querySelectorAll("pre"), (node) => node.textContent)).toEqual(["old", "new"]);
    const calls = vi.mocked(aiRequest).mock.calls.length;
    await act(async () => root.render(<AiHistory record={structuredClone(record)} busy={false} onRestore={vi.fn()} />));
    expect(aiRequest).toHaveBeenCalledTimes(calls);
    await act(async () =>
      Array.from(element.querySelectorAll("button"))
        .find((b) => b.textContent === "加载更早版本")!
        .click(),
    );
    expect(aiRequest).toHaveBeenLastCalledWith("history_page", { id: "skill", before_revision: 2 });
    expect(element.querySelectorAll(".ai-history > details")).toHaveLength(2);
  } finally {
    await act(async () => root.unmount());
  }
});
