import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentSessions } from "../features/reader/document-sessions";
import { readTextFile, renameWorkspaceEntry } from "../platform/bridge";
import { saveDraftSnapshot } from "../features/recovery/draft-recovery";
import { useWorkspaceActions } from "./useWorkspaceActions";

vi.mock("../platform/bridge", () => ({
  isTauriRuntime: () => true,
  readTextFile: vi.fn(),
  renameWorkspaceEntry: vi.fn(),
}));
vi.mock("../platform/bookroom-bridge", () => ({ bookroomRequest: vi.fn(async () => ({})) }));
vi.mock("../features/recovery/draft-recovery", () => ({
  saveDraftSnapshot: vi.fn(async () => ({ ok: true, prunedCount: 0 })),
  clearDraftSnapshot: async () => {},
}));
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("rename waits for document save completion", () => {
  it.each(["dirty", "rendering", "draft-storage-failure"] as const)(
    "preserves draft links while a save is %s",
    async (phase) => {
      const store = new DocumentSessions();
      const rootPath = "C:/notes",
        target = `${rootPath}/target.md`,
        reference = `${rootPath}/reference.md`;
      const source = "[[target#section|alias]]\n[relative](target.md#section)\n`[[target]]`\n";
      const draft = source + "Unpublished extra note\n";
      const disk = new Map([
        [target, "# section\nTarget"],
        [reference, phase === "rendering" ? draft : source],
      ]);
      store.setDocument({
        path: reference,
        name: "reference.md",
        kind: "markdown",
        source: phase === "rendering" ? draft : source,
        rendered: { html: "", toc: [], wordCount: 1, readingMinutes: 1 },
        modified: false,
        externallyModified: false,
      });
      store.setDraft(draft);
      if (phase === "rendering") store.update(reference, (s) => ({ ...s, saveStatus: "saving" }));
      let finish!: () => void;
      const gate = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const saveDocument = vi.fn(async () => {
        await gate;
        disk.set(reference, draft);
        store.update(reference, (s) => ({
          ...s,
          saveStatus: "saved",
          document: { ...s.document, source: draft, modified: false },
        }));
        return true;
      });
      vi.mocked(readTextFile).mockImplementation(async (path) => disk.get(path)!);
      let finishPatches!: () => void;
      const patchGate = new Promise<void>((resolve) => {
        finishPatches = resolve;
      });
      vi.mocked(renameWorkspaceEntry).mockImplementation(async (_root, _entry, _name, patches) => {
        disk.set(`${rootPath}/renamed.md`, disk.get(target)!);
        disk.delete(target);
        await patchGate;
        for (const patch of patches ?? []) {
          expect(disk.get(patch.path)).toBe(patch.before);
          disk.set(patch.path, patch.after);
        }
        return `${rootPath}/renamed.md`;
      });
      const notice = vi.fn();
      let actions!: ReturnType<typeof useWorkspaceActions>;
      function Harness() {
        actions = useWorkspaceActions({
          documentSessions: store,
          workspaceFiles: [target, reference].map((path) => ({
            path,
            relativePath: path.slice(rootPath.length + 1),
            kind: "markdown",
          })),
          workspacePathRef: { current: rootPath },
          documentStateRef: store.documentRef,
          saveDocument,
          documentCacheRef: { current: { invalidate: vi.fn() } },
          openTabsRef: { current: [] },
          setOpenTabs: vi.fn(),
          setRecentFiles: vi.fn(),
          mountedWorkspaceCacheRef: { current: new Map() },
          setExternalChangePath: vi.fn(),
          refreshWorkspaceChanges: vi.fn(async () => undefined),
          setSettingsNotice: notice,
          setError: vi.fn(),
        } as unknown as Parameters<typeof useWorkspaceActions>[0]);
        return null;
      }
      const prompt = vi.spyOn(window, "prompt").mockReturnValue("renamed.md");
      const root = createRoot(document.createElement("div"));
      let renaming: Promise<void> | undefined;
      try {
        await act(async () => root.render(<Harness />));
        await act(async () => {
          renaming = actions.handleRenameWorkspaceEntry("target.md", "file");
        });
        expect(saveDocument).toHaveBeenCalledExactlyOnceWith(false, reference);
        expect(renameWorkspaceEntry).not.toHaveBeenCalled();
        expect(notice).not.toHaveBeenCalled();
        await act(async () => {
          finish();
        });
        expect(disk.has(`${rootPath}/renamed.md`)).toBe(true);
        expect(disk.get(reference)).toBe(draft);
        expect(notice).not.toHaveBeenCalled();
        if (phase === "draft-storage-failure") {
          store.setDraft(draft + "写入期间继续编辑");
          vi.mocked(saveDraftSnapshot).mockResolvedValueOnce({ ok: false, prunedCount: 0, error: "磁盘已满" });
        }
        finishPatches();
        await act(async () => {
          await renaming;
        });
        expect(disk.get(reference)).toContain("[[renamed#section|alias]]");
        expect(disk.get(reference)).toContain("[relative](renamed.md#section)");
        expect(disk.get(reference)).toContain("`[[target]]`");
        expect(disk.get(reference)).toContain("Unpublished extra note");
        expect(store.get(reference)?.document.source).toBe(disk.get(reference));
        if (phase === "draft-storage-failure") {
          expect(store.get(reference)?.draft).toContain("写入期间继续编辑");
          expect(store.get(reference)?.document.modified).toBe(true);
          expect(notice).toHaveBeenCalledWith(expect.stringContaining("草稿更新失败"));
        } else {
          expect(store.get(reference)?.draft).toBe(disk.get(reference));
          expect(store.get(reference)?.document.modified).toBe(false);
        }
        expect(notice).toHaveBeenCalledWith(expect.stringContaining("更新 1 份文档的链接"));
      } finally {
        finish();
        finishPatches();
        await renaming;
        await act(async () => root.unmount());
        prompt.mockRestore();
        vi.clearAllMocks();
      }
    },
  );
});
