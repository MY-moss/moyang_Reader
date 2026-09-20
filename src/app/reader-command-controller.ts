import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";

import { CORE_SHORTCUTS, READER_COMMAND_IDS } from "./compatibility-contract";
import type { ReaderCommand } from "./components/CommandPalette";
import type { ReaderMode } from "./types";

export type ReaderCommandState = {
  documentOpen: boolean;
  workspaceOpen: boolean;
  sidebarCollapsed: boolean;
  focusMode: boolean;
  canNavigateBack: boolean;
  mode: ReaderMode;
  canEdit: boolean;
  documentModified: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canEditHistory: boolean;
  rightPanelOpen: boolean;
};

export type ReaderCommandActions = {
  openSelectedFile: () => unknown;
  handleChooseWorkspace: () => unknown;
  openDocumentSearch: () => unknown;
  focusWorkspaceSearch: () => unknown;
  exportDiagnosticSummary: () => unknown;
  handleNavigateBack: () => unknown;
  toggleReadingEditing: () => unknown;
  saveDocument: () => unknown;
  undoEditor: () => unknown;
  redoEditor: () => unknown;
  requestEditorInsert: (kind: "link") => void;
  toggleContextPanel: () => void;
  setQuickOpen: Dispatch<SetStateAction<boolean>>;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  setFocusMode: Dispatch<SetStateAction<boolean>>;
};

export function createReaderCommandItems(state: ReaderCommandState): ReaderCommand[] {
  return [
    {
      id: READER_COMMAND_IDS.open,
      label: "打开文档",
      shortcut: CORE_SHORTCUTS.open.label,
    },
    {
      id: READER_COMMAND_IDS.workspace,
      label: "添加整个文件夹",
      shortcut: CORE_SHORTCUTS.workspace.label,
    },
    {
      id: READER_COMMAND_IDS.quickOpen,
      label: "快速打开",
      shortcut: CORE_SHORTCUTS.quickOpen.label,
    },
    {
      id: READER_COMMAND_IDS.documentSearch,
      label: "查找当前文档文字",
      shortcut: CORE_SHORTCUTS.documentSearch.label,
      disabled: !state.documentOpen,
    },
    {
      id: READER_COMMAND_IDS.workspaceSearch,
      label: "搜索当前阅读库",
      shortcut: CORE_SHORTCUTS.workspaceSearch.label,
      disabled: !state.workspaceOpen,
    },
    {
      id: READER_COMMAND_IDS.exportDiagnostics,
      label: "导出本地诊断摘要",
    },
    {
      id: READER_COMMAND_IDS.toggleSidebar,
      label: state.sidebarCollapsed ? "显示工作区侧栏" : "隐藏工作区侧栏",
      shortcut: CORE_SHORTCUTS.toggleSidebar.label,
      disabled: state.focusMode,
    },
    {
      id: READER_COMMAND_IDS.navigateBack,
      label: "返回上一文档",
      shortcut: CORE_SHORTCUTS.navigateBack.label,
      disabled: !state.canNavigateBack,
    },
    {
      id: READER_COMMAND_IDS.toggleMode,
      label: state.mode === "rendered" ? "进入编辑模式" : "切换到阅读模式",
      shortcut: CORE_SHORTCUTS.toggleMode.label,
      disabled: !state.canEdit,
    },
    {
      id: READER_COMMAND_IDS.save,
      label: "保存当前文档",
      shortcut: CORE_SHORTCUTS.save.label,
      disabled: !state.documentModified,
    },
    {
      id: READER_COMMAND_IDS.undo,
      label: "撤销上一次编辑",
      shortcut: CORE_SHORTCUTS.undo.label,
      disabled: !state.canUndo,
    },
    {
      id: READER_COMMAND_IDS.redo,
      label: "重做上一次编辑",
      shortcut: CORE_SHORTCUTS.redo.label,
      disabled: !state.canRedo,
    },
    {
      id: READER_COMMAND_IDS.link,
      label: "插入 Markdown 链接",
      shortcut: CORE_SHORTCUTS.insertLink.label,
      disabled: !state.canEditHistory,
    },
    {
      id: READER_COMMAND_IDS.context,
      label: state.rightPanelOpen ? "隐藏上下文面板" : "显示上下文面板",
      shortcut: CORE_SHORTCUTS.toggleContext.label,
      disabled: state.focusMode,
    },
    {
      id: READER_COMMAND_IDS.focus,
      label: state.focusMode ? "退出专注阅读" : "进入专注阅读",
      shortcut: CORE_SHORTCUTS.focusMode.label,
      disabled: !state.documentOpen,
    },
  ];
}

export function executeReaderCommand(commandId: string, actions: ReaderCommandActions): void {
  switch (commandId) {
    case READER_COMMAND_IDS.open:
      void actions.openSelectedFile();
      break;
    case READER_COMMAND_IDS.workspace:
      void actions.handleChooseWorkspace();
      break;
    case READER_COMMAND_IDS.quickOpen:
      actions.setQuickOpen(true);
      break;
    case READER_COMMAND_IDS.documentSearch:
      actions.openDocumentSearch();
      break;
    case READER_COMMAND_IDS.workspaceSearch:
      actions.focusWorkspaceSearch();
      break;
    case READER_COMMAND_IDS.exportDiagnostics:
      void actions.exportDiagnosticSummary();
      break;
    case READER_COMMAND_IDS.toggleSidebar:
      actions.setSidebarCollapsed((current) => !current);
      break;
    case READER_COMMAND_IDS.navigateBack:
      void actions.handleNavigateBack();
      break;
    case READER_COMMAND_IDS.toggleMode:
      actions.toggleReadingEditing();
      break;
    case READER_COMMAND_IDS.save:
      void actions.saveDocument();
      break;
    case READER_COMMAND_IDS.undo:
      actions.undoEditor();
      break;
    case READER_COMMAND_IDS.redo:
      actions.redoEditor();
      break;
    case READER_COMMAND_IDS.link:
      actions.requestEditorInsert("link");
      break;
    case READER_COMMAND_IDS.context:
      actions.toggleContextPanel();
      break;
    case READER_COMMAND_IDS.focus:
      actions.setFocusMode((current) => !current);
      break;
  }
}

export function useReaderCommandController(state: ReaderCommandState, actions: ReaderCommandActions) {
  const {
    canEdit,
    canEditHistory,
    canNavigateBack,
    canRedo,
    canUndo,
    documentModified,
    documentOpen,
    focusMode,
    mode,
    rightPanelOpen,
    sidebarCollapsed,
    workspaceOpen,
  } = state;
  const {
    exportDiagnosticSummary,
    focusWorkspaceSearch,
    handleChooseWorkspace,
    handleNavigateBack,
    openDocumentSearch,
    openSelectedFile,
    redoEditor,
    requestEditorInsert,
    saveDocument,
    setFocusMode,
    setQuickOpen,
    setSidebarCollapsed,
    toggleContextPanel,
    toggleReadingEditing,
    undoEditor,
  } = actions;

  const commandItems = useMemo(
    () =>
      createReaderCommandItems({
        canEdit,
        canEditHistory,
        canNavigateBack,
        canRedo,
        canUndo,
        documentModified,
        documentOpen,
        focusMode,
        mode,
        rightPanelOpen,
        sidebarCollapsed,
        workspaceOpen,
      }),
    [
      canEdit,
      canEditHistory,
      canNavigateBack,
      canRedo,
      canUndo,
      documentModified,
      documentOpen,
      focusMode,
      mode,
      rightPanelOpen,
      sidebarCollapsed,
      workspaceOpen,
    ],
  );

  const executeCommand = useCallback(
    (commandId: string) =>
      executeReaderCommand(commandId, {
        exportDiagnosticSummary,
        focusWorkspaceSearch,
        handleChooseWorkspace,
        handleNavigateBack,
        openDocumentSearch,
        openSelectedFile,
        redoEditor,
        requestEditorInsert,
        saveDocument,
        setFocusMode,
        setQuickOpen,
        setSidebarCollapsed,
        toggleContextPanel,
        toggleReadingEditing,
        undoEditor,
      }),
    [
      exportDiagnosticSummary,
      focusWorkspaceSearch,
      handleChooseWorkspace,
      handleNavigateBack,
      openDocumentSearch,
      openSelectedFile,
      redoEditor,
      requestEditorInsert,
      saveDocument,
      setFocusMode,
      setQuickOpen,
      setSidebarCollapsed,
      toggleContextPanel,
      toggleReadingEditing,
      undoEditor,
    ],
  );

  return { commandItems, executeCommand };
}
