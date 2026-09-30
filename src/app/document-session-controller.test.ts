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
  it("waits for cancellation without opening or clearing an external-change notice", async () => {
    let decide!: (value: boolean) => void;
    const options = createOptions(createDocument(), {
      confirm: vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            decide = resolve;
          }),
      ),
    });
    const controller = createDocumentSessionController(options);
    const pending = controller.reloadExternalChange("C:/Notes/today.md");
    expect(options.loadDocument).not.toHaveBeenCalled();
    decide(false);
    await pending;
    expect(options.loadDocument).not.toHaveBeenCalled();
    expect(options.onExternalChangePath).not.toHaveBeenCalled();
  });

  it("rejects a decision if the current document changes during confirmation", async () => {
    let current = createDocument();
    let decide!: (value: boolean) => void;
    const controller = createDocumentSessionController(
      createOptions(current, {
        getCurrentDocument: () => current,
        confirm: () =>
          new Promise<boolean>((resolve) => {
            decide = resolve;
          }),
      }),
    );
    const pending = controller.confirmDocumentReplacement(["C:/Notes/other.md"], "switch");
    current = createDocument({ path: "C:/Notes/new.md" });
    decide(true);
    await expect(pending).resolves.toBe(false);
  });

  it("rejects changed edits and concurrent requests while awaiting a workspace decision", async () => {
    let draft = "draft";
    let decide!: (value: boolean) => void;
    const confirm = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          decide = resolve;
        }),
    );
    const controller = createDocumentSessionController(
      createOptions(createDocument(), {
        getSourceDraft: () => draft,
        confirm,
      }),
    );
    const pending = controller.confirmWorkspaceSwitch("C:/Archive", "switch-workspace");
    await expect(controller.confirmDocumentReplacement(["C:/Notes/other.md"], "open")).resolves.toBe(false);
    draft = "newer edit";
    decide(true);
    await expect(pending).resolves.toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
  });

  it("invalidates a pending reload when disposed", async () => {
    let decide!: (value: boolean) => void;
    const options = createOptions(createDocument(), {
      confirm: () =>
        new Promise<boolean>((resolve) => {
          decide = resolve;
        }),
    });
    const controller = createDocumentSessionController(options);
    const pending = controller.reloadExternalChange("C:/Notes/today.md");
    controller.dispose();
    decide(true);
    await pending;
    expect(options.loadDocument).not.toHaveBeenCalled();
    expect(options.onExternalChangePath).not.toHaveBeenCalled();
  });

  it("invalidates a workspace decision if its root changes", async () => {
    let workspace = "C:/Notes";
    let decide!: (value: boolean) => void;
    const controller = createDocumentSessionController(
      createOptions(createDocument(), {
        getWorkspacePath: () => workspace,
        confirm: () =>
          new Promise<boolean>((resolve) => {
            decide = resolve;
          }),
      }),
    );
    const pending = controller.confirmWorkspaceSwitch("C:/Archive", "switch-workspace");
    workspace = "C:/Different";
    decide(true);
    await expect(pending).resolves.toBe(false);
  });

  it("does not reload or clear the notice if draft preservation fails", async () => {
    const options = createOptions(createDocument(), {
      saveDraft: vi.fn().mockReturnValue({ ok: false, prunedCount: 0 }),
      onDraftSaved: vi.fn().mockReturnValue(false),
      confirm: vi.fn().mockReturnValue(true),
    });
    await createDocumentSessionController(options).reloadExternalChange("C:/Notes/today.md");
    expect(options.confirm).not.toHaveBeenCalled();
    expect(options.loadDocument).not.toHaveBeenCalled();
    expect(options.onExternalChangePath).not.toHaveBeenCalled();
  });

  it("flushes the current editable draft before a document replacement", async () => {
    const saveDraft = vi.fn().mockReturnValue({ ok: true, prunedCount: 0, snapshots: [] });
    const confirm = vi.fn().mockReturnValue(true);
    const options = createOptions(createDocument(), { saveDraft, confirm });
    const controller = createDocumentSessionController(options);

    await expect(controller.confirmDocumentReplacement(["C:/Notes/other.md"], "switch")).resolves.toBe(true);
    expect(saveDraft).toHaveBeenCalledWith({
      path: "C:\\Notes\\today.md",
      draft: "draft",
      baseSource: "base",
      savedAt: expect.any(Number),
    });
    expect(confirm).toHaveBeenCalledWith({
      action: "switch",
      path: "C:\\Notes\\today.md",
      draftSaved: true,
      targets: ["C:/Notes/other.md"],
    });
  });

  it("does not confirm or save when the replacement is the active path", async () => {
    const saveDraft = vi.fn();
    const confirm = vi.fn();
    const controller = createDocumentSessionController(createOptions(createDocument(), { saveDraft, confirm }));

    await expect(controller.confirmDocumentReplacement(["c:/notes/today.md/"], "switch")).resolves.toBe(true);
    expect(saveDraft).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("flushes the current draft before switching workspaces", async () => {
    const saveDraft = vi.fn().mockReturnValue({ ok: true, prunedCount: 0, snapshots: [] });
    const confirm = vi.fn().mockReturnValue(true);
    const controller = createDocumentSessionController(
      createOptions(createDocument(), {
        saveDraft,
        confirm,
        getWorkspacePath: () => "C:\\Notes",
      }),
    );

    await expect(controller.confirmWorkspaceSwitch("C:\\Archive", "switch-workspace")).resolves.toBe(true);
    expect(saveDraft).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledWith({
      action: "switch-workspace",
      path: "C:\\Notes\\today.md",
      draftSaved: true,
      targets: ["C:\\Archive"],
    });
  });

  it("blocks document replacement when the draft cannot be preserved", async () => {
    const saveDraft = vi.fn().mockReturnValue({ ok: false, prunedCount: 0, snapshots: [] });
    const confirm = vi.fn().mockReturnValue(true);
    const onDraftSaved = vi.fn().mockReturnValue(false);
    const controller = createDocumentSessionController(
      createOptions(createDocument(), { saveDraft, confirm, onDraftSaved }),
    );

    await expect(controller.confirmDocumentReplacement(["C:/Notes/other.md"], "switch")).resolves.toBe(false);
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

  it("preserves a local recovery draft when the filesystem rejects a save", async () => {
    const saveDraft = vi.fn().mockReturnValue({
      ok: true,
      prunedCount: 0,
      snapshots: [{ path: "C:\\Notes\\today.md", draft: "draft", baseSource: "base", savedAt: 10 }],
    });
    const onSaveFailure = vi.fn();
    const onSaveCommitted = vi.fn();
    const writeTextFile = vi.fn().mockRejectedValue({
      code: "FILE_WRITE_FAILED",
      message: "磁盘空间不足",
    });
    const options = createOptions(createDocument(), {
      saveDraft,
      writeTextFile,
      onSaveFailure,
      onSaveCommitted,
      now: vi.fn().mockReturnValue(10),
    });
    const controller = createDocumentSessionController(options);

    await expect(controller.saveDocument()).resolves.toBe(false);
    expect(saveDraft).toHaveBeenCalledWith({
      path: "C:\\Notes\\today.md",
      draft: "draft",
      baseSource: "base",
      savedAt: 10,
    });
    expect(onSaveFailure).toHaveBeenCalledWith({
      kind: "disk-full",
      draftSaved: true,
      snapshot: { path: "C:\\Notes\\today.md", draft: "draft", baseSource: "base", savedAt: 10 },
    });
    expect(onSaveCommitted).not.toHaveBeenCalled();
    expect(options.onError).toHaveBeenLastCalledWith(expect.stringContaining("草稿恢复中心"));
  });

  it("keeps the edit available when both disk and draft recovery storage fail", async () => {
    const options = createOptions(createDocument(), {
      saveDraft: vi.fn().mockReturnValue({ ok: false, prunedCount: 0, snapshots: [] }),
      writeTextFile: vi.fn().mockRejectedValue({ code: "FILE_WRITE_FAILED", message: "目标文件为只读" }),
    });
    const controller = createDocumentSessionController(options);

    await expect(controller.saveDocument()).resolves.toBe(false);
    expect(options.onError).toHaveBeenLastCalledWith(expect.stringContaining("另存为"));
    expect(options.onSaveCommitted).not.toHaveBeenCalled();
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

  it("keeps the existing rendered snapshot when a large document saves in source mode", async () => {
    const onSaveCommitted = vi.fn();
    const renderSource = vi.fn().mockResolvedValue({
      html: "<p>should not be used</p>",
      toc: [],
      wordCount: 4,
      readingMinutes: 1,
    });
    const options = createOptions(createDocument({ sourceBytes: 512 * 1024, rendered }), {
      onSaveCommitted,
      renderSource,
      shouldRenderOnSave: () => false,
    });
    const controller = createDocumentSessionController(options);

    await expect(controller.saveDocument()).resolves.toBe(true);

    expect(renderSource).not.toHaveBeenCalled();
    expect(onSaveCommitted).toHaveBeenCalledWith({
      path: "C:\\Notes\\today.md",
      draft: "draft",
      rendered,
      snapshots: [],
    });
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
