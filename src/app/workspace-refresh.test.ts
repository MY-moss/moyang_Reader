import { describe, expect, it } from "vitest";
import type { WorkspaceRefreshResult } from "./types";
import {
  applyWorkspaceFileDelta,
  applyWorkspaceIndexDelta,
  isCurrentWorkspaceLoad,
  isSelfWrittenChangePending,
} from "./workspace-refresh";

describe("workspace refresh guards", () => {
  it("accepts only the latest request for the active folder", () => {
    expect(isCurrentWorkspaceLoad(3, 3, "C:/Vault", "c:\\vault\\")).toBe(true);
    expect(isCurrentWorkspaceLoad(2, 3, "C:/Vault", "C:/Vault")).toBe(false);
    expect(isCurrentWorkspaceLoad(3, 3, "C:/Other", "C:/Vault")).toBe(false);
  });

  it("ignores a self-written file event only before its deadline", () => {
    expect(isSelfWrittenChangePending(1_500, 1_499)).toBe(true);
    expect(isSelfWrittenChangePending(1_500, 1_500)).toBe(false);
    expect(isSelfWrittenChangePending(undefined, 1_499)).toBe(false);
  });

  it("replaces only files inside changed scopes", () => {
    const current = [
      { path: "C:/Vault/old.md", name: "old.md", relativePath: "old.md", size: 1, kind: "markdown" },
      { path: "C:/Vault/notes/today.md", name: "today.md", relativePath: "notes/today.md", size: 2, kind: "markdown" },
      { path: "C:/Vault/notes/image.png", name: "image.png", relativePath: "notes/image.png", size: 3, kind: "image" },
    ] as const;
    const replacement = {
      path: "C:/Vault/notes/today.md",
      name: "today.md",
      relativePath: "notes/today.md",
      size: 9,
      kind: "markdown",
    } as const;
    const delta: WorkspaceRefreshResult = {
      scopePaths: ["c:\\vault\\notes"],
      files: [replacement],
      index: [{ file: replacement, title: "Today", links: [], tags: ["work"] }],
    };

    const refreshedFiles = applyWorkspaceFileDelta([...current], delta);
    expect(refreshedFiles).toHaveLength(2);
    expect(refreshedFiles).toEqual(expect.arrayContaining([current[0], replacement]));
    expect(applyWorkspaceIndexDelta([{ file: current[1], title: "Old", links: [], tags: [] }], delta)).toEqual(
      delta.index,
    );
  });

  it("removes deleted file scopes from files and indexes", () => {
    const file = {
      path: "C:/Vault/removed.md",
      name: "removed.md",
      relativePath: "removed.md",
      size: 1,
      kind: "markdown",
    } as const;
    const delta: WorkspaceRefreshResult = { scopePaths: ["C:/Vault/removed.md"], files: [], index: [] };

    expect(applyWorkspaceFileDelta([file], delta)).toEqual([]);
    expect(applyWorkspaceIndexDelta([{ file, title: "Removed", links: [], tags: [] }], delta)).toEqual([]);
  });
});
