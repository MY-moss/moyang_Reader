import { expect, it } from "vitest";
import { emptyAiFields, type AiRecord } from "./ai-types";
import { previewHealth } from "./ai-health";
const record = (id: string, fields: Partial<AiRecord> = {}): AiRecord => ({
  ...emptyAiFields("memory"),
  id,
  title: id,
  body: "相同正文",
  revision: 1,
  state: "active",
  created_at: 1,
  updated_at: 1,
  ...fields,
});
it("keeps duplicate groups in their project/legacy scopes and flags only deleted links", () => {
  const rows = [
    record("a", { project: "p", sharing: "project", agent: "codex", source: "", links: ["missing", "archived"] }),
    record("b", { project: "p", sharing: "project", agent: "claude", body: "相同正文\r\n" }),
    record("private", { project: "p", sharing: "legacy", agent: "other" }),
    record("elsewhere", { project: "other", sharing: "project" }),
    record("archived", { state: "archived" }),
  ];
  const result = previewHealth(rows, { project: "p", agent: "codex" });
  expect(result.scanned).toBe(2);
  expect(result.counts.duplicate).toBe(2);
  expect(result.items.find((r) => r.id === "a")?.broken_link_ids).toEqual(["missing"]);
  expect(result.items.every((r) => !Object.hasOwn(r, "assets"))).toBe(true);
  expect(previewHealth(rows, { project: "p", kind: "skill" }).scanned).toBe(0);
});
it("handles expiry, snapshot provenance, paging and empty scopes", () => {
  const rows = [
    record("expired", {
      expires_at: 1,
      source: "",
      snapshot: {
        uri: "file:///source",
        format: "md",
        fingerprint: "x",
        imported_at: 1,
        checked_at: null,
        locations: [],
      },
    }),
    record("healthy", { body: "不同正文" }),
  ];
  const result = previewHealth(rows, { issue: "expired", limit: 1 });
  expect(result.total).toBe(1);
  expect(result.counts.missing_source).toBe(0);
  expect(result.items[0].source).toBe("file:///source");
  expect(previewHealth(rows, { issue: "expired", offset: 1, limit: 1 }).items).toEqual([]);
  expect(previewHealth(rows, { project: "unknown" }).scanned).toBe(0);
});
