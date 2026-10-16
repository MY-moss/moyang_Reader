import { useState, useCallback } from "react";
import { rewriteRenamedLinks } from "../features/workspace/rename-links";
import { bookroomRequest } from "../platform/bookroom-bridge";
import { clearDraftSnapshot, saveDraftSnapshot } from "../features/recovery/draft-recovery";
import { formatTransitionConfirmation, isSameDocumentPath } from "../features/recovery/document-transition";
import {
  isPathWithinEntry,
  rebaseWorkspacePath,
  workspaceEntryAbsolutePath,
} from "../features/workspace/workspace-entry";
import {
  readTextFile,
  createMarkdownFile,
  createWorkspaceFolder,
  createWorkspaceNote,
  deleteWorkspaceEntry,
  duplicateWorkspaceEntry,
  isTauriRuntime,
  renameWorkspaceEntry,
  revealWorkspaceEntry,
} from "../platform/bridge";
import { saveLastDocumentPath, saveOpenTabs, saveRecentFiles } from "../platform/storage";
import type { RecentFile, WorkspaceEntryDetails } from "../shared/types";
import {
  comparablePath,
  copyPlainText,
  duplicateEntryName,
  fileNameFromPath,
  pathBelongsToWorkspace,
  persistCachedWorkspaceSession,
  updateCachedWorkspace,
} from "./support";
import type { useAppUpdates } from "./useAppUpdates";
import type { useDocumentSession } from "./useDocumentSession";
import type { useEditorHistory } from "./useEditorHistory";
import type { useReaderState } from "./useReaderState";
import type { useWorkspaceSession } from "./useWorkspaceSession";
type Input = Pick<
  ReturnType<typeof useReaderState>,
  | "documentSessions"
  | "workspaceFiles"
  | "workspacePath"
  | "documentState"
  | "setError"
  | "documentStateRef"
  | "workspacePathRef"
  | "documentCacheRef"
  | "openTabsRef"
  | "setOpenTabs"
  | "setRecentFiles"
  | "mountedWorkspaceCacheRef"
  | "setDocumentState"
  | "setSourceDraft"
  | "sourceDraftRef"
  | "setDraftRecovery"
  | "setExternalChangePath"
  | "setMode"
  | "setSettingsNotice"
  | "setWorkspaceEntryDetails"
> &
  Pick<ReturnType<typeof useEditorHistory>, "flushCurrentDraft" | "resetEditorHistory"> &
  Pick<ReturnType<typeof useWorkspaceSession>, "loadWorkspace" | "refreshWorkspaceChanges"> &
  Pick<ReturnType<typeof useDocumentSession>, "openPath" | "saveDocument"> &
  Pick<ReturnType<typeof useAppUpdates>, "releaseDocumentResources">;
export function useWorkspaceActions({
  documentSessions,
  workspaceFiles,
  workspacePath,
  documentState,
  setError,
  flushCurrentDraft,
  loadWorkspace,
  openPath,
  documentStateRef,
  refreshWorkspaceChanges,
  workspacePathRef,
  saveDocument,
  documentCacheRef,
  openTabsRef,
  setOpenTabs,
  setRecentFiles,
  mountedWorkspaceCacheRef,
  releaseDocumentResources,
  setDocumentState,
  setSourceDraft,
  sourceDraftRef,
  setDraftRecovery,
  setExternalChangePath,
  setMode,
  resetEditorHistory,
  setSettingsNotice,
  setWorkspaceEntryDetails,
}: Input) {
  const handleCreateNote = useCallback(
    async (target: string) => {
      if (!workspacePath || !documentState || documentState.path.startsWith("browser://")) {
        setError("请先添加一个工作区文件夹，再创建未解析链接。");
        return;
      }
      const draftOutcome = documentState.modified ? await flushCurrentDraft() : "not-needed";
      if (
        documentState.modified &&
        (draftOutcome === "failed" ||
          !window.confirm(formatTransitionConfirmation("切换到新文档", draftOutcome === "saved")))
      )
        return;

      try {
        const path = await createMarkdownFile(workspacePath, documentState.path, target);
        await loadWorkspace(workspacePath, true);
        await openPath(path);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "无法创建新文档。");
      }
    },
    [documentState, flushCurrentDraft, loadWorkspace, openPath, setError, workspacePath],
  );

  const [newNoteParent, setNewNoteParent] = useState<string | null>(null);
  const handleCreateWorkspaceNote = useCallback(
    async (parentPath: string) => {
      if (!workspacePath || !isTauriRuntime()) {
        setError("请先添加一个阅读库文件夹，再新建笔记。");
        return;
      }
      setNewNoteParent(parentPath);
    },
    [workspacePath, setError],
  );
  const createNote = async (parentPath: string, name: string) => {
    if (!workspacePath) throw new Error("请先添加阅读库");
    if ((await flushCurrentDraft()) === "failed") throw new Error("当前草稿无法暂存，请先保存");
    const path = await createWorkspaceNote(workspacePath, parentPath, name);
    await refreshWorkspaceChanges(workspacePath, [path]);
    await openPath(path);
    setNewNoteParent(null);
    setError(null);
  };

  const handleCreateWorkspaceFolder = useCallback(
    async (parentPath: string) => {
      if (!workspacePath || !isTauriRuntime()) {
        setError("请先添加一个工作区文件夹，再新建文件夹。");
        return;
      }
      const name = window.prompt("新建文件夹", "新建文件夹")?.trim();
      if (!name) return;

      try {
        const path = await createWorkspaceFolder(workspacePath, parentPath, name);
        await refreshWorkspaceChanges(workspacePath, [path]);
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "无法创建新文件夹。");
      }
    },
    [refreshWorkspaceChanges, setError, workspacePath],
  );

  const handleRenameWorkspaceEntry = useCallback(
    async (entryPath: string, kind: "file" | "folder") => {
      const root = workspacePathRef.current;
      if (!root || !isTauriRuntime() || !entryPath.trim()) {
        setError("请先添加工作区，再重命名文件或文件夹。");
        return;
      }

      const oldAbsolutePath = workspaceEntryAbsolutePath(root, entryPath);
      const oldName = fileNameFromPath(entryPath);
      const name = window.prompt(kind === "folder" ? "重命名文件夹" : "重命名文件", oldName)?.trim();
      if (!name || name === oldName) return;

      let releaseWrites: (() => void) | undefined;
      const current = documentStateRef.current;
      const currentIsAffected = Boolean(current && isPathWithinEntry(current.path, oldAbsolutePath));
      try {
        for (const session of documentSessions.getSnapshot().sessions.values()) {
          const latest = documentSessions.get(session.document.path);
          if (
            // A completed disk write can still have a queued preview/baseline update.
            // Join that save before rebasing, even when modified is already false.
            (latest?.document.modified || latest?.saveStatus === "saving") &&
            pathBelongsToWorkspace(session.document.path, root) &&
            !(await saveDocument(false, session.document.path))
          )
            return;
        }
        releaseWrites = documentSessions.holdWrites();
        const relative = entryPath.replaceAll("\\", "/");
        const oldExtension = oldName.match(/\.[^.]+$/)?.[0] ?? "";
        const finalName = kind === "file" && !name.includes(".") ? name + oldExtension : name;
        const nextRelative = relative.split("/").slice(0, -1).concat(finalName).join("/");
        const files = workspaceFiles.map((file) => file.relativePath);
        const patches: Array<{ path: string; before: string; after: string }> = [];
        const ambiguous: string[] = [];
        for (const file of workspaceFiles.filter((file) => file.kind === "markdown")) {
          const before = await readTextFile(file.path);
          const result = rewriteRenamedLinks(before, file.relativePath, files, relative, nextRelative);
          if (result.source !== before) patches.push({ path: file.path, before, after: result.source });
          ambiguous.push(...result.ambiguous.map((link) => file.relativePath + " → " + link));
        }
        if (
          ambiguous.length &&
          !window.confirm(
            "以下链接有多个同名目标，会保留原样：\n" +
              ambiguous.slice(0, 12).join("\n") +
              "\n继续重命名并更新其他可确定的链接吗？",
          )
        )
          return;
        const renamedPath = await renameWorkspaceEntry(root, entryPath, name, patches);
        const patchByPath = new Map(patches.map((patch) => [comparablePath(patch.path), patch]));
        const draftMoves: Array<() => Promise<void>> = [];
        documentSessions.rebase((session) => {
          const oldPath = session.document.path;
          const path = rebaseWorkspacePath(oldPath, oldAbsolutePath, renamedPath);
          const patch = patchByPath.get(comparablePath(oldPath));
          const file = workspaceFiles.find((file) => comparablePath(file.path) === comparablePath(oldPath));
          const draft =
            file?.kind === "markdown"
              ? rewriteRenamedLinks(session.draft, file.relativePath, files, relative, nextRelative).source
              : session.draft;
          const source = patch?.after ?? session.document.source;
          draftMoves.push(async () => {
            if (draft !== source) {
              const result = await saveDraftSnapshot({ path, draft, baseSource: source, savedAt: Date.now() });
              if (!result.ok) throw new Error(result.error ?? "重命名后草稿保存失败，旧草稿仍保留");
            }
            if (path !== oldPath) await clearDraftSnapshot(oldPath);
          });
          return {
            ...session,
            draft,
            saveStatus: "idle",
            history: {
              ...session.history,
              documentKey: path,
              present: draft,
              past: session.history.past.map((value) =>
                file?.kind === "markdown"
                  ? rewriteRenamedLinks(value, file.relativePath, files, relative, nextRelative).source
                  : value,
              ),
              future: session.history.future.map((value) =>
                file?.kind === "markdown"
                  ? rewriteRenamedLinks(value, file.relativePath, files, relative, nextRelative).source
                  : value,
              ),
            },
            document: { ...session.document, path, name: fileNameFromPath(path), source, modified: draft !== source },
          };
        });
        let metadataWarning = "";
        for (const move of draftMoves) {
          try {
            await move();
          } catch (cause) {
            metadataWarning += "；草稿更新失败，旧副本仍保留：" + String(cause);
          }
        }
        window.dispatchEvent(
          new CustomEvent("moyang:path-renamed", { detail: { from: oldAbsolutePath, to: renamedPath } }),
        );
        try {
          await bookroomRequest({ action: "paths.rebase", root, from: oldAbsolutePath, to: renamedPath });
        } catch (cause) {
          metadataWarning += "；阅读记录更新失败：" + String(cause);
        }
        documentCacheRef.current.invalidate([oldAbsolutePath, renamedPath]);

        const rebaseTab = (tab: RecentFile): RecentFile => {
          const nextPath = rebaseWorkspacePath(tab.path, oldAbsolutePath, renamedPath);
          return nextPath === tab.path ? tab : { path: nextPath, name: fileNameFromPath(nextPath) };
        };
        const nextTabs = openTabsRef.current.map(rebaseTab);
        openTabsRef.current = nextTabs;
        setOpenTabs(nextTabs);
        saveOpenTabs(nextTabs);
        setRecentFiles((currentFiles) => {
          const nextFiles = currentFiles.map(rebaseTab);
          saveRecentFiles(nextFiles);
          return nextFiles;
        });

        const cached = mountedWorkspaceCacheRef.current.get(comparablePath(root));
        if (cached) {
          const cachedTabs = nextTabs.filter(
            (tab) => !tab.path.startsWith("browser://") && pathBelongsToWorkspace(tab.path, root),
          );
          updateCachedWorkspace(mountedWorkspaceCacheRef.current, root, {
            tabs: cachedTabs,
            activeDocumentPath: cached.activeDocumentPath
              ? rebaseWorkspacePath(cached.activeDocumentPath, oldAbsolutePath, renamedPath)
              : null,
          });
          persistCachedWorkspaceSession(mountedWorkspaceCacheRef.current, root);
        }

        if (currentIsAffected && current)
          saveLastDocumentPath(rebaseWorkspacePath(current.path, oldAbsolutePath, renamedPath));
        setExternalChangePath(null);
        await refreshWorkspaceChanges(root, [oldAbsolutePath, renamedPath, ...patches.map((patch) => patch.path)]);
        setSettingsNotice(
          `已重命名：${name}，更新 ${patches.length} 份文档的链接${ambiguous.length ? "；部分同名链接需手动核对" : ""}${metadataWarning}`,
        );
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "无法重命名工作区内容。");
      } finally {
        releaseWrites?.();
      }
    },
    [
      documentSessions,
      workspaceFiles,
      documentCacheRef,
      documentStateRef,
      mountedWorkspaceCacheRef,
      openTabsRef,
      refreshWorkspaceChanges,
      saveDocument,
      setError,
      setExternalChangePath,
      setOpenTabs,
      setRecentFiles,
      setSettingsNotice,
      workspacePathRef,
    ],
  );

  const handleDeleteWorkspaceEntry = useCallback(
    async (entryPath: string, kind: "file" | "folder") => {
      const root = workspacePathRef.current;
      if (!root || !isTauriRuntime() || !entryPath.trim()) {
        setError("请先添加工作区，再删除文件或文件夹。");
        return;
      }

      const oldAbsolutePath = workspaceEntryAbsolutePath(root, entryPath);
      const label = fileNameFromPath(entryPath);
      const message =
        kind === "folder"
          ? `确定删除文件夹“${label}”及其中的全部内容吗？内容会移入回收站，30 天内可在恢复中心还原。`
          : `确定删除文件“${label}”吗？内容会移入回收站，30 天内可在恢复中心还原。`;
      if (!window.confirm(message)) return;

      const current = documentStateRef.current;
      const currentIsAffected = Boolean(current && isPathWithinEntry(current.path, oldAbsolutePath));
      for (const session of documentSessions.getSnapshot().sessions.values()) {
        if (
          isPathWithinEntry(session.document.path, oldAbsolutePath) &&
          session.document.modified &&
          !(await saveDocument(false, session.document.path))
        )
          return;
      }

      try {
        const currentIndex = current
          ? openTabsRef.current.findIndex((tab) => isSameDocumentPath(tab.path, current.path))
          : -1;
        const nextTabs = openTabsRef.current.filter((tab) => !isPathWithinEntry(tab.path, oldAbsolutePath));
        const affectedTabs = openTabsRef.current.filter((tab) => isPathWithinEntry(tab.path, oldAbsolutePath));
        await deleteWorkspaceEntry(root, entryPath);
        for (const tab of affectedTabs) {
          releaseDocumentResources(tab.path);
          documentSessions.remove(tab.path);
        }
        documentCacheRef.current.invalidate([oldAbsolutePath]);
        window.dispatchEvent(new CustomEvent("moyang:paths-closed", { detail: affectedTabs.map((tab) => tab.path) }));

        openTabsRef.current = nextTabs;
        setOpenTabs(nextTabs);
        saveOpenTabs(nextTabs);
        setRecentFiles((currentFiles) => {
          const nextFiles = currentFiles.filter((file) => !isPathWithinEntry(file.path, oldAbsolutePath));
          saveRecentFiles(nextFiles);
          return nextFiles;
        });

        const cached = mountedWorkspaceCacheRef.current.get(comparablePath(root));
        if (cached) {
          updateCachedWorkspace(mountedWorkspaceCacheRef.current, root, {
            tabs: nextTabs.filter(
              (tab) => !tab.path.startsWith("browser://") && pathBelongsToWorkspace(tab.path, root),
            ),
            activeDocumentPath: currentIsAffected ? null : cached.activeDocumentPath,
          });
          persistCachedWorkspaceSession(mountedWorkspaceCacheRef.current, root);
        }

        let nextTabFailed = false;
        if (currentIsAffected) {
          setDocumentState(null);
          documentStateRef.current = null;
          setSourceDraft("");
          sourceDraftRef.current = "";
          setDraftRecovery(null);
          setExternalChangePath(null);
          setMode("rendered");
          resetEditorHistory("", "");
          saveLastDocumentPath(null);

          const nextTab = nextTabs[currentIndex] ?? nextTabs[currentIndex - 1];
          if (nextTab) nextTabFailed = !(await openPath(nextTab.path, true));
        }

        await refreshWorkspaceChanges(root, [oldAbsolutePath]);
        setSettingsNotice(`已删除${kind === "folder" ? "文件夹及其内容" : "文件"}：${label}`);
        if (!nextTabFailed) setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "无法删除工作区内容。");
      }
    },
    [
      documentSessions,
      documentCacheRef,
      documentStateRef,
      mountedWorkspaceCacheRef,
      openPath,
      openTabsRef,
      refreshWorkspaceChanges,
      releaseDocumentResources,
      resetEditorHistory,
      saveDocument,
      setDocumentState,
      setDraftRecovery,
      setError,
      setExternalChangePath,
      setMode,
      setOpenTabs,
      setRecentFiles,
      setSettingsNotice,
      setSourceDraft,
      sourceDraftRef,
      workspacePathRef,
    ],
  );

  const handleCopyWorkspacePath = useCallback(
    async (entryPath: string) => {
      const root = workspacePathRef.current;
      if (!root || !isTauriRuntime()) {
        setError("当前没有可复制的工作区路径。");
        return;
      }

      try {
        const path = workspaceEntryAbsolutePath(root, entryPath);
        await copyPlainText(path);
        setSettingsNotice("完整路径已复制到剪贴板。");
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "复制路径失败。");
      }
    },
    [setError, setSettingsNotice, workspacePathRef],
  );

  const handleCopyWorkspaceRelativePath = useCallback(
    async (entryPath: string) => {
      const relativePath = entryPath.replace(/[\\/]+/g, "\\").replace(/^\\+|\\+$/g, "");
      if (!relativePath) {
        setError("当前条目没有可复制的相对路径。");
        return;
      }

      try {
        await copyPlainText(relativePath);
        setSettingsNotice("相对路径已复制到剪贴板。");
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "复制相对路径失败。");
      }
    },
    [setError, setSettingsNotice],
  );

  const handleShowWorkspaceDetails = useCallback(
    (details: WorkspaceEntryDetails) => {
      const root = workspacePathRef.current;
      const absolutePath =
        details.absolutePath ?? (root ? workspaceEntryAbsolutePath(root, details.relativePath) : details.relativePath);
      setWorkspaceEntryDetails({ ...details, absolutePath });
      setError(null);
    },
    [setError, setWorkspaceEntryDetails, workspacePathRef],
  );

  const handleDuplicateWorkspaceEntry = useCallback(
    async (entryPath: string, kind: "file" | "folder") => {
      const root = workspacePathRef.current;
      if (!root || !isTauriRuntime() || !entryPath.trim()) {
        setError("请先添加工作区，再复制文件或文件夹。");
        return;
      }

      const defaultName = duplicateEntryName(entryPath, kind);
      const name = window.prompt(kind === "folder" ? "复制文件夹" : "复制文件", defaultName)?.trim();
      if (!name) return;

      try {
        const duplicatedPath = await duplicateWorkspaceEntry(root, entryPath, name);
        await refreshWorkspaceChanges(root, [duplicatedPath]);
        setSettingsNotice(`已创建副本：${fileNameFromPath(duplicatedPath)}`);
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "无法创建工作区副本。");
      }
    },
    [refreshWorkspaceChanges, setError, setSettingsNotice, workspacePathRef],
  );

  const handleRevealWorkspaceEntry = useCallback(
    async (entryPath: string) => {
      const root = workspacePathRef.current;
      if (!root || !isTauriRuntime()) {
        setError("请先添加工作区，再打开资源管理器。");
        return;
      }

      try {
        await revealWorkspaceEntry(root, entryPath);
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "无法打开资源管理器。");
      }
    },
    [setError, workspacePathRef],
  );

  const handleCopyWorkspaceName = useCallback(
    async (entryPath: string) => {
      const name = fileNameFromPath(entryPath.replace(/[\\/]+$/, ""));
      if (!name) {
        setError("当前条目没有可复制的名称。");
        return;
      }

      try {
        await copyPlainText(name);
        setSettingsNotice("名称已复制到剪贴板。");
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "复制名称失败。");
      }
    },
    [setError, setSettingsNotice],
  );

  const handleRefreshWorkspaceEntry = useCallback(
    async (entryPath: string) => {
      const root = workspacePathRef.current;
      if (!root || !isTauriRuntime()) {
        setError("请先添加工作区，再刷新文件树。");
        return;
      }

      setSettingsNotice("正在刷新文件树…");
      if (entryPath.trim()) {
        await refreshWorkspaceChanges(root, [workspaceEntryAbsolutePath(root, entryPath)]);
      } else {
        await loadWorkspace(root, true);
      }
      setSettingsNotice("文件树已刷新。");
      setError(null);
    },
    [loadWorkspace, refreshWorkspaceChanges, setError, setSettingsNotice, workspacePathRef],
  );
  return {
    newNoteParent,
    setNewNoteParent,
    createNote,
    handleCreateNote,
    handleCreateWorkspaceNote,
    handleCreateWorkspaceFolder,
    handleRenameWorkspaceEntry,
    handleDeleteWorkspaceEntry,
    handleCopyWorkspacePath,
    handleCopyWorkspaceRelativePath,
    handleShowWorkspaceDetails,
    handleDuplicateWorkspaceEntry,
    handleRevealWorkspaceEntry,
    handleCopyWorkspaceName,
    handleRefreshWorkspaceEntry,
  };
}
