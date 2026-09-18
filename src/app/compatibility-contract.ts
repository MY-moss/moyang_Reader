/**
 * Versioned identifiers that are observable across upgrades.
 *
 * Keep these values stable. Changing one is a compatibility change and must
 * be accompanied by an explicit migration or release note.
 */
export const APP_SETTINGS_SCHEMA = {
  storageKey: "moyang-reader-app-settings",
  format: "moyang-reader-app-settings",
  version: 1,
} as const;

export const PORTABLE_SETTINGS_SCHEMA = {
  format: "moyang-reader-settings",
  currentVersion: 2,
  supportedVersions: [1, 2],
} as const;

export const PERSISTED_STORAGE_KEYS = {
  appSettings: APP_SETTINGS_SCHEMA.storageKey,
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
} as const;

export const LEGACY_APP_SETTINGS_KEYS = [
  PERSISTED_STORAGE_KEYS.preferences,
  PERSISTED_STORAGE_KEYS.theme,
  PERSISTED_STORAGE_KEYS.locale,
  PERSISTED_STORAGE_KEYS.sidebarCollapsed,
  PERSISTED_STORAGE_KEYS.contextPanelOpen,
  PERSISTED_STORAGE_KEYS.contextPanelTab,
  PERSISTED_STORAGE_KEYS.paneWidths,
] as const;

export const READER_COMMAND_IDS = {
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
} as const;

export type ReaderCommandId = (typeof READER_COMMAND_IDS)[keyof typeof READER_COMMAND_IDS];

type PrimaryShortcut = {
  key: string;
  shift?: boolean;
  alt?: boolean;
  label: string;
  title: string;
  aria: string;
};

export const CORE_SHORTCUTS = {
  open: { key: "o", label: "Ctrl O", title: "Ctrl+O", aria: "Control+O" },
  workspace: { key: "o", shift: true, label: "Ctrl ⇧ O", title: "Ctrl+Shift+O", aria: "Control+Shift+O" },
  quickOpen: { key: "p", label: "Ctrl P", title: "Ctrl+P", aria: "Control+P" },
  documentSearch: { key: "f", label: "Ctrl F", title: "Ctrl+F", aria: "Control+F" },
  workspaceSearch: {
    key: "f",
    shift: true,
    label: "Ctrl ⇧ F",
    title: "Ctrl+Shift+F",
    aria: "Control+Shift+F",
  },
  commandPalette: {
    key: "p",
    shift: true,
    label: "Ctrl ⇧ P",
    title: "Ctrl+Shift+P",
    aria: "Control+Shift+P",
  },
  save: { key: "s", label: "Ctrl S", title: "Ctrl+S", aria: "Control+S" },
  undo: { key: "z", label: "Ctrl Z", title: "Ctrl+Z", aria: "Control+Z" },
  redo: { key: "y", label: "Ctrl Y", title: "Ctrl+Y", aria: "Control+Y" },
  redoAlternate: {
    key: "z",
    shift: true,
    label: "Ctrl ⇧ Z",
    title: "Ctrl+Shift+Z",
    aria: "Control+Shift+Z",
  },
  toggleMode: { key: "e", label: "Ctrl E", title: "Ctrl+E", aria: "Control+E" },
  insertLink: { key: "k", label: "Ctrl K", title: "Ctrl+K", aria: "Control+K" },
  toggleSidebar: {
    key: "b",
    shift: true,
    label: "Ctrl ⇧ B",
    title: "Ctrl+Shift+B",
    aria: "Control+Shift+B",
  },
  toggleContext: {
    key: "r",
    shift: true,
    label: "Ctrl ⇧ R",
    title: "Ctrl+Shift+R",
    aria: "Control+Shift+R",
  },
  focusMode: {
    key: "Enter",
    shift: true,
    label: "Ctrl ⇧ Enter",
    title: "Ctrl+Shift+Enter",
    aria: "Control+Shift+Enter",
  },
  navigateBack: {
    key: "ArrowLeft",
    alt: true,
    label: "Ctrl Alt ←",
    title: "Ctrl+Alt+Left",
    aria: "Control+Alt+ArrowLeft",
  },
} as const satisfies Record<string, PrimaryShortcut>;

export function matchesPrimaryShortcut(event: KeyboardEvent, shortcut: PrimaryShortcut): boolean {
  return (
    (event.ctrlKey || event.metaKey) &&
    event.altKey === Boolean(shortcut.alt) &&
    event.shiftKey === Boolean(shortcut.shift) &&
    event.key.toLowerCase() === shortcut.key.toLowerCase()
  );
}
