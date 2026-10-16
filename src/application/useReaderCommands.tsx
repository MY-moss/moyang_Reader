import { useCallback, useMemo } from "react";
import { isEditableDocument } from "../features/documents/rendering/document-adapters";
import { canRedoEditorChange, canUndoEditorChange } from "../features/editor/editor-history";
import { buildWikiLinkCandidates } from "../features/editor/wiki-link-completion";
import type { QuickOpenCandidate } from "../features/workspace/quick-open";
import { matchesWorkspaceFilter } from "../features/workspace/workspace-filter";
import {
  createBacklinkIndex,
  findBacklinks,
  findIndexEntry,
  findLinkedEntry,
} from "../features/workspace/workspace-index";
import { type ReaderCommand } from "../shell/components/CommandPalette";
import { comparablePath } from "./support";
import type { useDocumentSession } from "./useDocumentSession";
import type { useEditing } from "./useEditing";
import type { useEditorHistory } from "./useEditorHistory";
import type { useOpenEvents } from "./useOpenEvents";
import type { useReaderState } from "./useReaderState";
import type { useWorkspaceSession } from "./useWorkspaceSession";
type Input = Pick<
  ReturnType<typeof useReaderState>,
  | "searchResultCount"
  | "setSearchResultIndex"
  | "setTheme"
  | "documentState"
  | "workspaceIndex"
  | "selectedTag"
  | "workspaceFiles"
  | "selectedFileKind"
  | "workspaceResults"
  | "workspaceQuery"
  | "workspaceSearchLoading"
  | "setQuickOpen"
  | "setRightPanelOpen"
  | "setFocusMode"
  | "mode"
  | "editorHistory"
  | "rightPanelOpen"
  | "focusMode"
  | "openTabs"
  | "recentFiles"
> &
  Pick<ReturnType<typeof useOpenEvents>, "openSelectedFile"> &
  Pick<ReturnType<typeof useWorkspaceSession>, "handleChooseWorkspace"> &
  Pick<ReturnType<typeof useEditing>, "toggleReadingEditing" | "handleInsertLink"> &
  Pick<ReturnType<typeof useDocumentSession>, "saveDocument"> &
  Pick<ReturnType<typeof useEditorHistory>, "undoEditor" | "redoEditor">;
export function useReaderCommands({
  searchResultCount,
  setSearchResultIndex,
  setTheme,
  documentState,
  workspaceIndex,
  selectedTag,
  workspaceFiles,
  selectedFileKind,
  workspaceResults,
  workspaceQuery,
  workspaceSearchLoading,
  openSelectedFile,
  handleChooseWorkspace,
  setQuickOpen,
  toggleReadingEditing,
  saveDocument,
  undoEditor,
  redoEditor,
  handleInsertLink,
  setRightPanelOpen,
  setFocusMode,
  mode,
  editorHistory,
  rightPanelOpen,
  focusMode,
  openTabs,
  recentFiles,
}: Input) {
  const moveSearchResult = useCallback(
    (step: number) => {
      if (!searchResultCount) return;
      setSearchResultIndex((current) => (current + step + searchResultCount) % searchResultCount);
    },
    [searchResultCount, setSearchResultIndex],
  );

  const cycleTheme = useCallback(() => {
    setTheme((current) => (current === "system" ? "light" : current === "light" ? "dark" : "system"));
  }, [setTheme]);

  const canEdit = documentState ? isEditableDocument(documentState.kind) : false;

  const currentIndexEntry = documentState ? findIndexEntry(workspaceIndex, documentState.path) : undefined;

  const backlinkIndex = useMemo(() => createBacklinkIndex(workspaceIndex), [workspaceIndex]);

  const backlinks = currentIndexEntry ? findBacklinks(workspaceIndex, currentIndexEntry, backlinkIndex) : [];

  const outgoing = currentIndexEntry
    ? currentIndexEntry.links.map((target) => ({
        target,
        entry: findLinkedEntry(workspaceIndex, currentIndexEntry, target),
      }))
    : [];

  const availableTags = useMemo(
    () => Array.from(new Set(workspaceIndex.flatMap((entry) => entry.tags))).sort((a, b) => a.localeCompare(b)),
    [workspaceIndex],
  );

  const taggedFilePaths = useMemo(
    () =>
      new Set(workspaceIndex.filter((entry) => entry.tags.includes(selectedTag ?? "")).map((entry) => entry.file.path)),
    [selectedTag, workspaceIndex],
  );

  const visibleWorkspaceFiles = useMemo(
    () => workspaceFiles.filter((file) => matchesWorkspaceFilter(file, selectedFileKind, selectedTag, taggedFilePaths)),
    [selectedFileKind, selectedTag, taggedFilePaths, workspaceFiles],
  );

  const visibleWorkspaceResults = useMemo(
    () =>
      workspaceResults.filter((result) =>
        matchesWorkspaceFilter(result.file, selectedFileKind, selectedTag, taggedFilePaths),
      ),
    [selectedFileKind, selectedTag, taggedFilePaths, workspaceResults],
  );

  const workspaceExportFiles = useMemo(() => {
    const query = workspaceQuery.trim();
    if (!query) return visibleWorkspaceFiles;
    if (query.length < 2 || workspaceSearchLoading) return [];
    return visibleWorkspaceResults.map((result) => result.file);
  }, [visibleWorkspaceFiles, visibleWorkspaceResults, workspaceQuery, workspaceSearchLoading]);

  const wikiLinkCandidates = useMemo(
    () => buildWikiLinkCandidates(workspaceFiles, documentState?.path),
    [workspaceFiles, documentState?.path],
  );

  const executeCommand = useCallback(
    (commandId: string) => {
      switch (commandId) {
        case "open":
          void openSelectedFile();
          break;
        case "workspace":
          void handleChooseWorkspace();
          break;
        case "quick-open":
          setQuickOpen(true);
          break;
        case "toggle-mode":
          toggleReadingEditing();
          break;
        case "save":
          void saveDocument();
          break;
        case "undo":
          undoEditor();
          break;
        case "redo":
          redoEditor();
          break;
        case "link":
          handleInsertLink();
          break;
        case "context":
          setRightPanelOpen((current) => !current);
          break;
        case "focus":
          setFocusMode((current) => !current);
          break;
      }
    },
    [
      handleChooseWorkspace,
      handleInsertLink,
      openSelectedFile,
      redoEditor,
      saveDocument,
      setFocusMode,
      setQuickOpen,
      setRightPanelOpen,
      toggleReadingEditing,
      undoEditor,
    ],
  );

  const canEditHistory = canEdit && mode !== "rendered";

  const canUndo = canEditHistory && canUndoEditorChange(editorHistory);

  const canRedo = canEditHistory && canRedoEditorChange(editorHistory);

  const commandItems = useMemo<ReaderCommand[]>(
    () => [
      {
        id: "open",
        label: "打开文档",
        shortcut: "Ctrl O",
      },
      {
        id: "workspace",
        label: "添加整个文件夹",
        shortcut: "Ctrl ⇧ O",
      },
      {
        id: "quick-open",
        label: "快速打开",
        shortcut: "Ctrl P",
      },
      {
        id: "toggle-mode",
        label: mode === "rendered" ? "进入编辑模式" : "切换到阅读模式",
        shortcut: "Ctrl E",
        disabled: !canEdit,
      },
      {
        id: "save",
        label: "保存当前文档",
        shortcut: "Ctrl S",
        disabled: !documentState?.modified,
      },
      {
        id: "undo",
        label: "撤销上一次编辑",
        shortcut: "Ctrl Z",
        disabled: !canUndo,
      },
      {
        id: "redo",
        label: "重做上一次编辑",
        shortcut: "Ctrl Y",
        disabled: !canRedo,
      },
      {
        id: "link",
        label: "插入 Markdown 链接",
        shortcut: "Ctrl K",
        disabled: !canEdit,
      },
      {
        id: "context",
        label: rightPanelOpen ? "隐藏上下文面板" : "显示上下文面板",
        shortcut: "Ctrl ⇧ R",
      },
      {
        id: "focus",
        label: focusMode ? "退出专注阅读" : "进入专注阅读",
        shortcut: "Ctrl ⇧ Enter",
        disabled: !documentState,
      },
    ],
    [canEdit, canRedo, canUndo, focusMode, mode, rightPanelOpen, documentState],
  );

  const quickOpenItems = useMemo<QuickOpenCandidate[]>(() => {
    const items = new Map<string, QuickOpenCandidate>();
    const add = (candidate: QuickOpenCandidate) => {
      const key = comparablePath(candidate.path);
      const existing = items.get(key);
      items.set(key, existing ? { ...existing, isRecent: existing.isRecent || candidate.isRecent } : candidate);
    };

    workspaceFiles.forEach((file) => add(file));
    openTabs.forEach((file) => add({ ...file, relativePath: file.path, isRecent: true }));
    recentFiles.forEach((file) => add({ ...file, relativePath: file.path, isRecent: true }));

    return [...items.values()].sort((left, right) => Number(right.isRecent) - Number(left.isRecent));
  }, [openTabs, recentFiles, workspaceFiles]);
  return {
    moveSearchResult,
    cycleTheme,
    canEdit,
    currentIndexEntry,
    backlinks,
    outgoing,
    availableTags,
    visibleWorkspaceFiles,
    visibleWorkspaceResults,
    workspaceExportFiles,
    wikiLinkCandidates,
    executeCommand,
    canUndo,
    canRedo,
    commandItems,
    quickOpenItems,
  };
}
