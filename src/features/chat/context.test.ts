import { afterEach, expect, it } from "vitest";
import { previewRequest } from "../../platform/ai-preview";
afterEach(() => localStorage.clear());
it("chat preview recall keeps other projects out and honors its text budget", () => {
  const save = (project: string, body: string) =>
    previewRequest("save", {
      kind: "knowledge",
      title: "阅读偏好",
      body,
      project,
      sharing: project ? "project" : "global",
    });
  save("", "阅读偏好：先看结论");
  save("项目甲", "阅读偏好：提供甲项目证据");
  save("项目乙", "阅读偏好：乙项目私有资料");
  const recall = (project: string) =>
    previewRequest("context", { query: "阅读偏好", project, max_chars: 500 }) as { text: string; ids: string[] };
  expect(recall("").text).toContain("先看结论");
  expect(recall("").text).not.toContain("项目证据");
  expect(recall("项目甲").text).toContain("甲项目证据");
  expect(recall("项目甲").text).not.toContain("乙项目私有");
  expect(recall("项目甲").text.length).toBeLessThanOrEqual(500);
});
