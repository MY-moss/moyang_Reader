import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { CORE_SHORTCUTS, READER_COMMAND_IDS } from "./compatibility-contract";
import {
  createReaderCommandItems,
  executeReaderCommand,
  useReaderCommandController,
  type ReaderCommandActions,
  type ReaderCommandState,
} from "./reader-command-controller";

const state: ReaderCommandState = {
  documentOpen: true,
  workspaceOpen: true,
  sidebarCollapsed: false,
  focusMode: false,
  canNavigateBack: true,
  mode: "wysiwyg",
  canEdit: true,
  documentModified: true,
  canUndo: true,
  canRedo: false,
  canEditHistory: true,
  rightPanelOpen: true,
};

function createActions(): ReaderCommandActions & Record<string, ReturnType<typeof vi.fn>> {
  return {
    openSelectedFile: vi.fn(),
    handleChooseWorkspace: vi.fn(),
    openDocumentSearch: vi.fn(),
    focusWorkspaceSearch: vi.fn(),
    exportDiagnosticSummary: vi.fn(),
    handleNavigateBack: vi.fn(),
    toggleReadingEditing: vi.fn(),
    saveDocument: vi.fn(),
    undoEditor: vi.fn(),
    redoEditor: vi.fn(),
    requestEditorInsert: vi.fn(),
    toggleContextPanel: vi.fn(),
    setQuickOpen: vi.fn(),
    setSidebarCollapsed: vi.fn(),
    setFocusMode: vi.fn(),
  };
}

const reactGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

function CommandControllerHarness({ actions }: { actions: ReaderCommandActions }) {
  const controller = useReaderCommandController(state, actions);
  return createElement(
    "button",
    {
      type: "button",
      "data-command-count": controller.commandItems.length,
      onClick: () => controller.executeCommand(READER_COMMAND_IDS.quickOpen),
    },
    "执行",
  );
}

beforeEach(() => {
  reactGlobal.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  document.body.replaceChildren();
  delete reactGlobal.IS_REACT_ACT_ENVIRONMENT;
  vi.restoreAllMocks();
});

describe("reader command controller", () => {
  it("builds the stable command catalogue from current application state", () => {
    const commands = createReaderCommandItems(state);

    expect(commands.map((command) => command.id)).toEqual(Object.values(READER_COMMAND_IDS));
    expect(commands.find((command) => command.id === READER_COMMAND_IDS.documentSearch)).toMatchObject({
      label: "查找当前文档文字",
      shortcut: CORE_SHORTCUTS.documentSearch.label,
      disabled: false,
    });
    expect(commands.find((command) => command.id === READER_COMMAND_IDS.toggleMode)).toMatchObject({
      label: "切换到阅读模式",
      disabled: false,
    });
    expect(commands.find((command) => command.id === READER_COMMAND_IDS.redo)).toMatchObject({
      label: "重做上一次编辑",
      disabled: true,
    });
  });

  it("derives disabled commands when the document, workspace, or focus state is unavailable", () => {
    const commands = createReaderCommandItems({
      ...state,
      documentOpen: false,
      workspaceOpen: false,
      focusMode: true,
      canEdit: false,
      canEditHistory: false,
      canNavigateBack: false,
    });

    expect(commands.find((command) => command.id === READER_COMMAND_IDS.documentSearch)?.disabled).toBe(true);
    expect(commands.find((command) => command.id === READER_COMMAND_IDS.workspaceSearch)?.disabled).toBe(true);
    expect(commands.find((command) => command.id === READER_COMMAND_IDS.toggleSidebar)?.disabled).toBe(true);
    expect(commands.find((command) => command.id === READER_COMMAND_IDS.navigateBack)?.disabled).toBe(true);
    expect(commands.find((command) => command.id === READER_COMMAND_IDS.toggleMode)?.disabled).toBe(true);
    expect(commands.find((command) => command.id === READER_COMMAND_IDS.focus)?.disabled).toBe(true);
  });

  it("dispatches command ids to the existing application actions", () => {
    const actions = createActions();

    executeReaderCommand(READER_COMMAND_IDS.open, actions);
    executeReaderCommand(READER_COMMAND_IDS.workspace, actions);
    executeReaderCommand(READER_COMMAND_IDS.documentSearch, actions);
    executeReaderCommand(READER_COMMAND_IDS.workspaceSearch, actions);
    executeReaderCommand(READER_COMMAND_IDS.exportDiagnostics, actions);
    executeReaderCommand(READER_COMMAND_IDS.navigateBack, actions);
    executeReaderCommand(READER_COMMAND_IDS.toggleMode, actions);
    executeReaderCommand(READER_COMMAND_IDS.save, actions);
    executeReaderCommand(READER_COMMAND_IDS.undo, actions);
    executeReaderCommand(READER_COMMAND_IDS.redo, actions);
    executeReaderCommand(READER_COMMAND_IDS.link, actions);
    executeReaderCommand(READER_COMMAND_IDS.context, actions);
    executeReaderCommand(READER_COMMAND_IDS.quickOpen, actions);
    executeReaderCommand(READER_COMMAND_IDS.toggleSidebar, actions);
    executeReaderCommand(READER_COMMAND_IDS.focus, actions);
    executeReaderCommand("unknown", actions);

    expect(actions.openSelectedFile).toHaveBeenCalledOnce();
    expect(actions.handleChooseWorkspace).toHaveBeenCalledOnce();
    expect(actions.openDocumentSearch).toHaveBeenCalledOnce();
    expect(actions.focusWorkspaceSearch).toHaveBeenCalledOnce();
    expect(actions.exportDiagnosticSummary).toHaveBeenCalledOnce();
    expect(actions.handleNavigateBack).toHaveBeenCalledOnce();
    expect(actions.toggleReadingEditing).toHaveBeenCalledOnce();
    expect(actions.saveDocument).toHaveBeenCalledOnce();
    expect(actions.undoEditor).toHaveBeenCalledOnce();
    expect(actions.redoEditor).toHaveBeenCalledOnce();
    expect(actions.requestEditorInsert).toHaveBeenCalledWith("link");
    expect(actions.toggleContextPanel).toHaveBeenCalledOnce();
    expect(actions.setQuickOpen).toHaveBeenCalledWith(true);
    expect(actions.setSidebarCollapsed).toHaveBeenCalledOnce();
    expect(actions.setFocusMode).toHaveBeenCalledOnce();
  });

  it("exposes the catalogue and dispatcher through the React controller", () => {
    const actions = createActions();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(createElement(CommandControllerHarness, { actions }));
    });
    expect(container.querySelector("button")?.dataset.commandCount).toBe(
      String(Object.keys(READER_COMMAND_IDS).length),
    );

    act(() => {
      container.querySelector<HTMLButtonElement>("button")?.click();
    });
    expect(actions.setQuickOpen).toHaveBeenCalledWith(true);

    act(() => root.unmount());
  });
});
