import { describe, expect, it } from "vitest";
import { isPathWithinEntry, rebaseWorkspacePath, workspaceEntryAbsolutePath } from "./workspace-entry";

describe("workspace entry paths", () => {
  it("resolves tree-relative paths under the selected workspace", () => {
    expect(workspaceEntryAbsolutePath("C:\\Notes\\", "projects/archive")).toBe("C:\\Notes\\projects\\archive");
    expect(workspaceEntryAbsolutePath("C:/Notes", "")).toBe("C:/Notes");
  });

  it("matches a directory and its descendants case-insensitively", () => {
    expect(isPathWithinEntry("C:/Notes/Projects/One.md", "c:\\notes\\projects")).toBe(true);
    expect(isPathWithinEntry("C:/Notes/Projects-old/One.md", "C:/Notes/Projects")).toBe(false);
  });

  it("rebases open paths when a directory is renamed", () => {
    expect(rebaseWorkspacePath("C:/Notes/Projects/One.md", "C:/Notes/Projects", "C:/Notes/Archive")).toBe(
      "C:\\Notes\\Archive\\One.md",
    );
    expect(rebaseWorkspacePath("C:/Notes/Other.md", "C:/Notes/Projects", "C:/Notes/Archive")).toBe("C:/Notes/Other.md");
  });
});
