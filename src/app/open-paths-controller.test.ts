import { describe, expect, it, vi } from "vitest";

import type { OpenDocument, OpenPath } from "./types";
import { createOpenPathsController, type OpenPathsControllerOptions } from "./open-paths-controller";

const currentDocument: Pick<OpenDocument, "path" | "modified"> = {
  path: "C:/library/current.md",
  modified: true,
};

function createOptions(overrides: Partial<OpenPathsControllerOptions> = {}): OpenPathsControllerOptions {
  return {
    getCurrentDocument: () => currentDocument,
    getWorkspacePath: () => "C:/library",
    isNative: () => true,
    authorizeStoredPath: vi.fn(async (path: string) => `authorized:${path}`),
    confirmWorkspaceSwitch: vi.fn(() => true),
    confirmDocumentReplacement: vi.fn(() => true),
    loadWorkspace: vi.fn(async () => true),
    openPath: vi.fn(async () => true),
    setError: vi.fn(),
    ...overrides,
  };
}

describe("open paths controller", () => {
  it("confirms, authorizes, de-duplicates, and opens workspace and document paths", async () => {
    const options = createOptions();
    const controller = createOpenPathsController(options);
    const paths: OpenPath[] = [
      { path: "C:/other", kind: "workspace" },
      { path: "C:/other/note.md", kind: "document" },
      { path: "C:/other/note.md", kind: "document" },
    ];

    await expect(controller.handleOpenPaths(paths)).resolves.toEqual({
      openedCount: 2,
      failedCount: 0,
      duplicateCount: 1,
      cancelled: false,
    });
    expect(options.confirmWorkspaceSwitch).toHaveBeenCalledWith("C:/other", "切换阅读库");
    expect(options.confirmDocumentReplacement).toHaveBeenCalledWith(
      ["C:/other/note.md", "C:/other/note.md"],
      "打开新文档",
    );
    expect(options.authorizeStoredPath).toHaveBeenNthCalledWith(1, "C:/other", true);
    expect(options.authorizeStoredPath).toHaveBeenNthCalledWith(2, "C:/other/note.md", false);
    expect(options.loadWorkspace).toHaveBeenCalledWith("authorized:C:/other");
    expect(options.openPath).toHaveBeenCalledWith("authorized:C:/other/note.md");
  });

  it("returns a cancelled outcome before opening anything when a workspace switch is rejected", async () => {
    const options = createOptions({
      confirmWorkspaceSwitch: vi.fn(() => false),
    });
    const controller = createOpenPathsController(options);

    await expect(controller.handleOpenPaths([{ path: "C:/other", kind: "workspace" }])).resolves.toEqual({
      openedCount: 0,
      failedCount: 0,
      duplicateCount: 0,
      cancelled: true,
    });
    expect(options.authorizeStoredPath).not.toHaveBeenCalled();
    expect(options.loadWorkspace).not.toHaveBeenCalled();
    expect(options.openPath).not.toHaveBeenCalled();
  });

  it("does not ask to replace the current modified document when it is among the incoming paths", async () => {
    const options = createOptions();
    const controller = createOpenPathsController(options);
    const paths: OpenPath[] = [
      { path: "C:/library/current.md", kind: "document" },
      { path: "C:/library/next.md", kind: "document" },
    ];

    await expect(controller.handleOpenPaths(paths)).resolves.toMatchObject({
      openedCount: 1,
      failedCount: 0,
      cancelled: false,
    });
    expect(options.confirmDocumentReplacement).toHaveBeenCalledWith(["C:/library/next.md"], "打开新文档");
    expect(options.authorizeStoredPath).toHaveBeenCalledTimes(1);
  });

  it("returns a cancelled outcome before authorization when document replacement is rejected", async () => {
    const options = createOptions({
      getCurrentDocument: () => ({ ...currentDocument, modified: false }),
      confirmDocumentReplacement: vi.fn(() => false),
    });
    const controller = createOpenPathsController(options);

    await expect(controller.handleOpenPaths([{ path: "C:/library/next.md", kind: "document" }])).resolves.toEqual({
      openedCount: 0,
      failedCount: 0,
      duplicateCount: 0,
      cancelled: true,
    });
    expect(options.authorizeStoredPath).not.toHaveBeenCalled();
    expect(options.openPath).not.toHaveBeenCalled();
  });

  it("keeps browser paths raw and reports per-path failures", async () => {
    const setError = vi.fn();
    const openPath = vi.fn(async (path: string) => !path.includes("broken"));
    const options = createOptions({
      isNative: () => false,
      openPath,
      setError,
    });
    const controller = createOpenPathsController(options);

    await expect(
      controller.handleOpenPaths([
        { path: "browser://one", kind: "document" },
        { path: "browser://broken", kind: "document" },
      ]),
    ).resolves.toEqual({
      openedCount: 1,
      failedCount: 1,
      duplicateCount: 0,
      cancelled: false,
    });
    expect(options.authorizeStoredPath).not.toHaveBeenCalled();
    expect(openPath).toHaveBeenNthCalledWith(1, "browser://one");
    expect(openPath).toHaveBeenNthCalledWith(2, "browser://broken");
    expect(setError).not.toHaveBeenCalled();
  });

  it("reports authorization failures and continues with later paths", async () => {
    const setError = vi.fn();
    const authorizeStoredPath = vi.fn(async (path: string) => {
      if (path.includes("blocked")) throw new Error("路径未获授权");
      return `authorized:${path}`;
    });
    const options = createOptions({ authorizeStoredPath, setError });
    const controller = createOpenPathsController(options);

    await expect(
      controller.handleOpenPaths([
        { path: "C:/blocked.md", kind: "document" },
        { path: "C:/ok.md", kind: "document" },
      ]),
    ).resolves.toEqual({
      openedCount: 1,
      failedCount: 1,
      duplicateCount: 0,
      cancelled: false,
    });
    expect(setError).toHaveBeenCalledWith("路径未获授权");
    expect(options.openPath).toHaveBeenCalledWith("authorized:C:/ok.md");
  });
});
