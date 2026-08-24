import { describe, expect, it } from "vitest";
import { createWorkspaceOpenPlan } from "./workspace-open";
import type { WorkspaceFile } from "./types";

function file(path: string): WorkspaceFile {
  return {
    path,
    name: path.split(/[\\/]/).pop() ?? path,
    relativePath: path,
    size: 1,
    kind: "markdown",
  };
}

describe("workspace batch open plan", () => {
  it("deduplicates paths case-insensitively and keeps the original order", () => {
    const plan = createWorkspaceOpenPlan([file("C:\\Notes\\A.md"), file("c:/notes/a.md"), file("C:\\Notes\\B.md")]);

    expect(plan.files.map((item) => item.path)).toEqual(["C:\\Notes\\A.md", "C:\\Notes\\B.md"]);
    expect(plan.skippedCount).toBe(0);
  });

  it("limits a large reading library without changing the selected files", () => {
    const files = Array.from({ length: 41 }, (_, index) => file(`note-${index}.md`));
    const plan = createWorkspaceOpenPlan(files);

    expect(plan.files).toEqual(files.slice(0, 40));
    expect(plan.skippedCount).toBe(1);
  });
});
