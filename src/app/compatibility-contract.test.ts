import { describe, expect, it } from "vitest";
import {
  APP_SETTINGS_SCHEMA,
  CORE_SHORTCUTS,
  LEGACY_APP_SETTINGS_KEYS,
  PERSISTED_STORAGE_KEYS,
  PORTABLE_SETTINGS_SCHEMA,
  READER_COMMAND_IDS,
  matchesPrimaryShortcut,
} from "./compatibility-contract";

describe("persisted compatibility contract", () => {
  it("keeps the consolidated settings schema stable", () => {
    expect(APP_SETTINGS_SCHEMA).toEqual({
      storageKey: "moyang-reader-app-settings",
      format: "moyang-reader-app-settings",
      version: 1,
    });
    expect(PORTABLE_SETTINGS_SCHEMA).toEqual({
      format: "moyang-reader-settings",
      currentVersion: 2,
      supportedVersions: [1, 2],
    });
  });

  it("keeps every persisted browser key explicit and unique", () => {
    const values = Object.values(PERSISTED_STORAGE_KEYS);

    expect(values).toHaveLength(new Set(values).size);
    expect(PERSISTED_STORAGE_KEYS).toMatchObject({
      appSettings: "moyang-reader-app-settings",
      preferences: "moyang-reader-preferences",
      theme: "moyang-reader-theme",
      locale: "moyang-reader-locale",
      workspace: "moyang-reader-workspace",
      recentFiles: "moyang-reader-recent-files",
      recentWorkspaces: "moyang-reader-recent-workspaces",
      mountedWorkspaces: "moyang-reader-mounted-workspaces",
      workspaceSessions: "moyang-reader-workspace-sessions",
      lastDocument: "moyang-reader-last-document",
      openTabs: "moyang-reader-open-tabs",
      readingPositions: "moyang-reader-reading-positions",
      sidebarCollapsed: "moyang-reader-sidebar-collapsed",
      contextPanelOpen: "moyang-reader-context-panel-open",
      contextPanelTab: "moyang-reader-context-panel-tab",
      paneWidths: "moyang-reader-pane-widths",
      bookmarks: "moyang-reader-bookmarks",
      drafts: "moyang-reader-drafts",
      gettingStartedSeen: "moyang-reader-getting-started-seen",
      readingHistory: "moyang-reader-reading-history",
      updateRecovery: "moyang-reader-update-recovery",
    });
    expect(LEGACY_APP_SETTINGS_KEYS).toEqual([
      PERSISTED_STORAGE_KEYS.preferences,
      PERSISTED_STORAGE_KEYS.theme,
      PERSISTED_STORAGE_KEYS.locale,
      PERSISTED_STORAGE_KEYS.sidebarCollapsed,
      PERSISTED_STORAGE_KEYS.contextPanelOpen,
      PERSISTED_STORAGE_KEYS.contextPanelTab,
      PERSISTED_STORAGE_KEYS.paneWidths,
    ]);
  });

  it("keeps command IDs and primary keyboard shortcuts stable", () => {
    expect(READER_COMMAND_IDS).toEqual({
      open: "open",
      workspace: "workspace",
      quickOpen: "quick-open",
      documentSearch: "document-search",
      workspaceSearch: "workspace-search",
      exportDiagnostics: "export-diagnostics",
      toggleSidebar: "toggle-sidebar",
      navigateBack: "navigate-back",
      toggleMode: "toggle-mode",
      save: "save",
      undo: "undo",
      redo: "redo",
      link: "link",
      context: "context",
      focus: "focus",
    });
    expect(new Set(Object.values(READER_COMMAND_IDS)).size).toBe(Object.keys(READER_COMMAND_IDS).length);
    expect(CORE_SHORTCUTS.workspaceSearch).toMatchObject({
      key: "f",
      shift: true,
      label: "Ctrl ⇧ F",
      title: "Ctrl+Shift+F",
      aria: "Control+Shift+F",
    });
    expect(CORE_SHORTCUTS.documentSearch).toMatchObject({
      key: "f",
      label: "Ctrl F",
      title: "Ctrl+F",
      aria: "Control+F",
    });
    expect(
      matchesPrimaryShortcut(new KeyboardEvent("keydown", { key: "f", ctrlKey: true }), CORE_SHORTCUTS.documentSearch),
    ).toBe(true);
    expect(
      matchesPrimaryShortcut(
        new KeyboardEvent("keydown", { key: "f", ctrlKey: true, shiftKey: true }),
        CORE_SHORTCUTS.workspaceSearch,
      ),
    ).toBe(true);
    expect(
      matchesPrimaryShortcut(new KeyboardEvent("keydown", { key: "f", ctrlKey: true }), CORE_SHORTCUTS.workspaceSearch),
    ).toBe(false);
  });
});
