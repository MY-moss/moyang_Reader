import { useCallback, type DragEvent } from "react";
import { documentKindFromPath } from "../features/documents/rendering/document-adapters";
import { isSameDocumentPath } from "../features/recovery/document-transition";
import { saveDraftSnapshot } from "../features/recovery/draft-recovery";
import { reorderTabs } from "../features/workspace/tab-order";
import { authorizeStoredPath } from "../platform/bridge";
import { saveLastDocumentPath, saveOpenTabs } from "../platform/storage";
import type { DocumentKind } from "../shared/types";
import { flushLiveEditors } from "../shared/pending-work";
import { updateCachedWorkspace } from "./support";
import type { useAppUpdates } from "./useAppUpdates";
import type { useDocumentSession } from "./useDocumentSession";
import type { useDocumentTransitions } from "./useDocumentTransitions";
import type { useReaderState } from "./useReaderState";
type Input = Pick<
  ReturnType<typeof useReaderState>,
  | "browserDocumentSequenceRef"
  | "setError"
  | "documentState"
  | "openTabsRef"
  | "documentStateRef"
  | "setOpenTabs"
  | "setDocumentState"
  | "setSourceDraft"
  | "setMode"
  | "setSearchQuery"
  | "workspacePath"
  | "mountedWorkspaceCacheRef"
  | "documentSessions"
> &
  Pick<ReturnType<typeof useDocumentTransitions>, "confirmDocumentReplacement"> &
  Pick<ReturnType<typeof useDocumentSession>, "openBinary" | "openSource" | "openPath" | "saveDocument"> &
  Pick<ReturnType<typeof useAppUpdates>, "releaseDocumentResources">;
export function useDocumentTabs({
  browserDocumentSequenceRef,
  setError,
  confirmDocumentReplacement,
  openBinary,
  openSource,
  openPath,
  openTabsRef,
  documentStateRef,
  releaseDocumentResources,
  setOpenTabs,
  setDocumentState,
  setSourceDraft,
  setMode,
  setSearchQuery,
  workspacePath,
  mountedWorkspaceCacheRef,
  documentSessions,
  saveDocument,
}: Input) {
  const handleBrowserFiles = useCallback(
    async (files: FileList | File[] | null | undefined) => {
      const selectedFiles = Array.from(files ?? []);
      if (selectedFiles.length === 0) return;
      const supportedFiles: Array<{ file: File; kind: DocumentKind; path: string }> = [];
      const unsupportedNames: string[] = [];
      for (const file of selectedFiles) {
        const kind = documentKindFromPath(file.name);
        if (!kind) {
          unsupportedNames.push(file.name);
          continue;
        }
        supportedFiles.push({
          file,
          kind,
          path: `browser://${++browserDocumentSequenceRef.current}/${file.name}`,
        });
      }
      const unsupportedNotice =
        unsupportedNames.length > 0
          ? `已跳过 ${unsupportedNames.length} 个不支持的文件：${unsupportedNames.join("、")}。支持 Markdown、文本、Word、PDF 和图片。`
          : null;
      if (supportedFiles.length === 0) {
        if (unsupportedNotice) setError(unsupportedNotice);
        return;
      }
      const nextPaths = supportedFiles.map((entry) => entry.path);
      if (!confirmDocumentReplacement(nextPaths, "打开新文件")) {
        return;
      }

      for (const { file, kind, path } of supportedFiles) {
        if (kind === "docx" || kind === "pdf" || kind === "image") {
          await openBinary(path, new Uint8Array(await file.arrayBuffer()));
        } else {
          await openSource(path, await file.text());
        }
      }
      if (unsupportedNotice) {
        setError((current) => (current ? `${current} ${unsupportedNotice}` : unsupportedNotice));
      }
    },
    [browserDocumentSequenceRef, confirmDocumentReplacement, openBinary, openSource, setError],
  );

  const handleSelectTab = useCallback(
    async (path: string) => {
      const active = documentSessions.active()?.document.path;
      if (active && isSameDocumentPath(path, active)) return;
      if (!confirmDocumentReplacement([path], "切换文档")) return;
      try {
        const authorizedPath = path.startsWith("browser://") ? path : await authorizeStoredPath(path, false);
        await openPath(authorizedPath);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "最近文档无法打开，请重新选择文件。");
      }
    },
    [confirmDocumentReplacement, documentSessions, openPath, setError],
  );

  const handleCloseTabs = useCallback(
    async (paths: readonly string[]) => {
      flushLiveEditors();
      const activeDocument = documentStateRef.current;
      const currentTabs = [...openTabsRef.current];
      if (activeDocument && !currentTabs.some((tab) => isSameDocumentPath(tab.path, activeDocument.path)))
        currentTabs.push({ path: activeDocument.path, name: activeDocument.name });
      const targetTabs = currentTabs.filter((tab) => paths.some((path) => isSameDocumentPath(path, tab.path)));
      if (targetTabs.length === 0) return;

      const current = documentStateRef.current;
      const activeIndex = current ? currentTabs.findIndex((tab) => isSameDocumentPath(tab.path, current.path)) : -1;
      const closesActive = Boolean(current && targetTabs.some((tab) => isSameDocumentPath(tab.path, current.path)));
      for (const tab of targetTabs) {
        const session = documentSessions.get(tab.path);
        if (!session?.document.modified) continue;
        if (!tab.path.startsWith("browser://")) {
          if (await saveDocument(false, tab.path)) continue;
          const recovery = saveDraftSnapshot({
            path: tab.path,
            draft: session.draft,
            baseSource: session.document.source,
            savedAt: Date.now(),
          });
          if (!recovery.ok) {
            setError("草稿无法保存，请先处理后再关闭标签。");
            return false;
          }
          if (!window.confirm("文件尚未保存，已保留恢复草稿。仍要关闭这个标签吗？")) return false;
        } else if (!window.confirm("浏览器预览中的修改尚未下载，关闭后将丢弃修改。继续吗？")) return false;
      }

      const nextTabs = currentTabs.filter(
        (tab) => !targetTabs.some((target) => isSameDocumentPath(target.path, tab.path)),
      );
      targetTabs.forEach((tab) => {
        releaseDocumentResources(tab.path);
        documentSessions.remove(tab.path);
      });
      openTabsRef.current = nextTabs;
      setOpenTabs(nextTabs);
      saveOpenTabs(nextTabs);
      if (!closesActive) return true;

      const nextTab = nextTabs[activeIndex] ?? nextTabs[activeIndex - 1];
      if (nextTab) {
        await openPath(nextTab.path);
      } else {
        setDocumentState(null);
        setSourceDraft("");
        setMode("rendered");
        setSearchQuery("");
        setError(null);
        saveLastDocumentPath(null);
        if (workspacePath) {
          updateCachedWorkspace(mountedWorkspaceCacheRef.current, workspacePath, { activeDocumentPath: null });
        }
      }
      return true;
    },
    [
      documentStateRef,
      documentSessions,
      saveDocument,
      mountedWorkspaceCacheRef,
      openPath,
      openTabsRef,
      releaseDocumentResources,
      setDocumentState,
      setError,
      setMode,
      setOpenTabs,
      setSearchQuery,
      setSourceDraft,
      workspacePath,
    ],
  );

  const handleCloseTab = useCallback(
    (path: string) => {
      void handleCloseTabs([path]);
    },
    [handleCloseTabs],
  );

  const handleReorderTabs = useCallback(
    (sourcePath: string, targetPath: string) => {
      setOpenTabs((current) => reorderTabs(current, sourcePath, targetPath));
    },
    [setOpenTabs],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      void handleBrowserFiles(event.dataTransfer.files);
    },
    [handleBrowserFiles],
  );
  return { handleBrowserFiles, handleSelectTab, handleCloseTabs, handleCloseTab, handleReorderTabs, handleDrop };
}
