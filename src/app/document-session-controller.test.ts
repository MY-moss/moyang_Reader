import { describe, expect, it, vi } from "vitest";
import { createDocumentSessionController, type DocumentSessionControllerOptions } from "./document-session-controller";
import type { OpenDocument, RenderedMarkdown } from "./types";

const rendered: RenderedMarkdown = { html: "<p>rendered</p>", toc: [], wordCount: 1, readingMinutes: 1 };

function createDocument(overrides: Partial<OpenDocument> = {}): OpenDocument {
  return {
    path: "C:\\Notes\\today.md",
    name: "today.md",
    kind: "markdown",
    source: "base",
    rendered,
    modified: true,
    externallyModified: false,
    ...overrides,
  };
}

function createOptions(
  current: OpenDocument | null = createDocument(),
  overrides: Partial<DocumentSessionControllerOptions> = {},
): DocumentSessionControllerOptions {
  return {
    getCurrentDocument: () => current,
    getSourceDraft: () => "draft",
    getWorkspacePath: () => "C:\\Notes",
    isNative: true,
    readTextFile: vi.fn().mockResolvedValue("base"),
    writeTextFile: vi.fn().mockResolvedValue(undefined),
    renderSource: vi.fn().mockResolvedValue(rendered),
    downloadText: vi.fn(),
    loadDocument: vi.fn().mockResolvedValue(true),
    commitNavigation: vi.fn(),
    onDraftSaved: vi.fn().mockReturnValue(true),
    onSaveCommitted: vi.fn(),
    onSaveConflict: vi.fn(),
    onExternalChangePath: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  };
}

describe("document session controller", () => {
  it("flushes the current editable draft before a document replacement", () => {
    const saveDraft = vi.fn().mockReturnValue({ ok: true, prunedCount: 0, snapshots: [] });
    const confirm = vi.fn().mockReturnValue(true);
    const options = createOptions(createDocument(), { saveDraft, confirm });
    const controller = createDocumentSessionController(options);

    expect(controller.confirmDocumentReplacement(["C:/Notes/other.md"], "切换文档")).toBe(true);
    expect(saveDraft).toHaveBeenCalledWith({
      path: "C:\\Notes\\today.md",
      draft: "draft",
      baseSource: "base",
      savedAt: expect.any(Number),
    });
    expect(confirm).toHaveBeenCalledWith("当前文档的最新修改已自动保留为草稿，可在“草稿”中心恢复。仍要切换文档吗？");
  });

  it("does not confirm or save when the replacement is the active path", () => {
    const saveDraft = vi.fn();
    const confirm = vi.fn();
    const controller = createDocumentSessionController(createOptions(createDocument(), { saveDraft, confirm }));

    expect(controller.confirmDocumentReplacement(["c:/notes/today.md/"], "切换文档")).toBe(true);
    expect(saveDraft).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("blocks a native save when the disk version changed", async () => {
    const onSaveConflict = vi.fn();
    const writeTextFile = vi.fn();
    const options = createOptions(createDocument(), {
      readTextFile: vi.fn().mockResolvedValue("changed on disk"),
      writeTextFile,
      onSaveConflict,
    });
    const controller = createDocumentSessionController(options);

    await expect(controller.saveDocument()).resolves.toBe(false);
    expect(onSaveConflict).toHaveBeenCalledWith("C:\\Notes\\today.md");
    expect(writeTextFile).not.toHaveBeenCalled();
    expect(options.onExternalChangePath).toHaveBeenCalledWith("C:\\Notes\\today.md");
  });

  it("writes safely and reports the committed rendered document", async () => {
    const onSaveCommitted = vi.fn();
    const snapshots = [{ path: "C:\\Notes\\other.md", draft: "x", baseSource: "y", savedAt: 1 }];
    const clearDraft = vi.fn().mockReturnValue(snapshots);
    const selfWritingPaths = new Set<string>();
    const selfWrittenPaths = new Map<string, number>();
    const options = createOptions(createDocument(), {
      onSaveCommitted,
      clearDraft,
      selfWritingPaths,
      selfWrittenPaths,
      now: vi.fn().mockReturnValue(100),
    });
    const controller = createDocumentSessionController(options);

    await expect(controller.saveDocument()).resolves.toBe(true);
    expect(options.writeTextFile).toHaveBeenCalledWith("C:\\Notes\\today.md", "draft");
    expect(clearDraft).toHaveBeenCalledWith("C:\\Notes\\today.md");
    expect(onSaveCommitted).toHaveBeenCalledWith({
      path: "C:\\Notes\\today.md",
      draft: "draft",
      rendered,
      snapshots,
    });
    expect(selfWritingPaths.size).toBe(0);
    expect(selfWrittenPaths.get("c:\\notes\\today.md")).toBe(1_600);
    expect(options.onExternalChangePath).toHaveBeenLastCalledWith(null);
  });

  it("only commits navigation after a successful open", async () => {
    const commitNavigation = vi.fn();
    const loadDocument = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const options = createOptions(createDocument({ modified: false }), { loadDocument, commitNavigation });
    const controller = createDocumentSessionController(options);

    await expect(controller.openPath("C:/Notes/missing.md")).resolves.toBe(false);
    await expect(controller.openPath("C:/Notes/next.md", true, "push")).resolves.toBe(true);
    expect(commitNavigation).toHaveBeenCalledOnce();
    expect(commitNavigation).toHaveBeenCalledWith("C:/Notes/next.md", "push", "C:\\Notes\\today.md");
  });

  it("keeps a recovery draft before reloading a modified browser document", async () => {
    const browserDocument = createDocument({ path: "browser://today.md" });
    const saveDraft = vi.fn().mockReturnValue({ ok: true, prunedCount: 0, snapshots: [] });
    const confirm = vi.fn().mockReturnValue(true);
    const loadDocument = vi.fn().mockResolvedValue(true);
    const options = createOptions(browserDocument, { saveDraft, confirm, loadDocument });
    const controller = createDocumentSessionController(options);

    await controller.reloadExternalChange("browser://today.md");

    expect(saveDraft).toHaveBeenCalledWith({
      path: "browser://today.md",
      draft: "draft",
      baseSource: "base",
      savedAt: expect.any(Number),
    });
    expect(confirm).toHaveBeenCalledOnce();
    expect(loadDocument).toHaveBeenCalledWith("browser://today.md", true);
  });

  it("only resolves a recovery draft for the active document", () => {
    const controller = createDocumentSessionController(createOptions());
    const snapshot = { path: "C:\\Notes\\today.md", draft: "recovered", baseSource: "base", savedAt: 1 };

    expect(controller.resolveDraftRecovery(snapshot)).toBe("recovered");
    expect(controller.resolveDraftRecovery({ ...snapshot, path: "C:\\Notes\\other.md" })).toBeNull();
  });

  it("invalidates an earlier close operation when cancelled", () => {
    const controller = createDocumentSessionController(createOptions());
    const operation = controller.beginCloseOperation();

    controller.cancelCloseOperation();

    expect(controller.isCurrentCloseOperation(operation)).toBe(false);
    const nextOperation = controller.beginCloseOperation();
    expect(controller.isCurrentCloseOperation(nextOperation)).toBe(true);
  });
});
