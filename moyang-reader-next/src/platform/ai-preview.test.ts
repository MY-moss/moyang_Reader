import { beforeEach, expect, it } from "vitest";
import { previewRequest } from "./ai-preview";
import type { AiRecord } from "../shared/ai-types";

beforeEach(() => localStorage.clear());

it("returns no unchanged payload, refreshes changed resources, and reports deletion", () => {
  const original = previewRequest("save", {
    kind: "skill",
    title: "refresh-check",
    summary: "Check refreshes",
    body: "Original body",
    assets: [{ path: "sample.txt", encoding: "utf8", content: "large fixture ".repeat(20000) }],
  }) as AiRecord;
  expect(previewRequest("get_if_changed", { id: original.id, revision: original.revision })).toBeNull();
  expect(previewRequest("get", { id: original.id })).toEqual(original);
  const changed = previewRequest("save", {
    ...original,
    expected_revision: original.revision,
    body: "Changed body",
    assets: [{ path: "sample.txt", encoding: "utf8", content: "Changed resource" }],
  }) as AiRecord;
  expect(previewRequest("get_if_changed", { id: original.id, revision: original.revision })).toEqual(changed);
  expect(previewRequest("get_if_changed", { id: changed.id, revision: changed.revision })).toBeNull();
  previewRequest("delete", { id: changed.id, expected_revision: changed.revision });
  expect(() => previewRequest("get_if_changed", { id: changed.id, revision: changed.revision })).toThrow("记录不存在");
});
