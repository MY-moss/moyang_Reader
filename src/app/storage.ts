import type { ContextPanelTab, RecentFile, RecentWorkspace } from "./types";
import { normalizePathKey } from "./path-key";
import { DEFAULT_PANE_WIDTHS, normalizePaneWidths, type PaneWidths } from "./pane-layout";

const workspaceKey = "moyang-reader-workspace";
const recentFilesKey = "moyang-reader-recent-files";
const recentWorkspacesKey = "moyang-reader-recent-workspaces";
const mountedWorkspacesKey = "moyang-reader-mounted-workspaces";
const workspaceSessionsKey = "moyang-reader-workspace-sessions";
const lastDocumentKey = "moyang-reader-last-document";
const openTabsKey = "moyang-reader-open-tabs";
const readingPositionsKey = "moyang-reader-reading-positions";
const sidebarCollapsedKey = "moyang-reader-sidebar-collapsed";
const contextPanelOpenKey = "moyang-reader-context-panel-open";
const contextPanelTabKey = "moyang-reader-context-panel-tab";
const paneWidthsKey = "moyang-reader-pane-widths";
const maxRecentFiles = 12;
const maxRecentWorkspaces = 8;
export const MAX_MOUNTED_WORKSPACES = 5;
const maxOpenTabs = 16;
const maxReadingPositions = 32;

export type WorkspaceSession = {
  path: string;
  tabs: RecentFile[];
  activeDocumentPath: string | null;
};

export function loadSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(sidebarCollapsedKey) === "true";
  } catch {
    return false;
  }
}

export function saveSidebarCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(sidebarCollapsedKey, String(collapsed));
  } catch {
    // The layout preference remains available for the current session.
  }
}

export function loadContextPanelOpen(): boolean {
  try {
    const saved = localStorage.getItem(contextPanelOpenKey);
    return saved === null ? true : saved === "true";
  } catch {
    return true;
  }
}

export function saveContextPanelOpen(open: boolean): void {
  try {
    localStorage.setItem(contextPanelOpenKey, String(open));
  } catch {
    // The context panel remains available for the current session.
  }
}

export function loadContextPanelTab(): ContextPanelTab {
  try {
    const saved = localStorage.getItem(contextPanelTabKey);
    return saved === "backlinks" || saved === "properties" || saved === "bookmarks" || saved === "annotations"
      ? saved
      : "outline";
  } catch {
    return "outline";
  }
}

export function saveContextPanelTab(tab: ContextPanelTab): void {
  try {
    localStorage.setItem(contextPanelTabKey, tab);
  } catch {
    // The context panel tab remains available for the current session.
  }
}

export function loadPaneWidths(): PaneWidths {
  try {
    const raw = localStorage.getItem(paneWidthsKey);
    return raw ? normalizePaneWidths(JSON.parse(raw) as unknown) : { ...DEFAULT_PANE_WIDTHS };
  } catch {
    return { ...DEFAULT_PANE_WIDTHS };
  }
}

export function savePaneWidths(widths: PaneWidths): void {
  try {
    localStorage.setItem(paneWidthsKey, JSON.stringify(normalizePaneWidths(widths)));
  } catch {
    // Pane widths remain available for the current session.
  }
}

function comparablePath(path: string): string {
  return normalizePathKey(path);
}

export function loadWorkspacePath(): string | null {
  try {
    return localStorage.getItem(workspaceKey);
  } catch {
    return null;
  }
}

export function saveWorkspacePath(path: string | null): void {
  try {
    if (path) localStorage.setItem(workspaceKey, path);
    else localStorage.removeItem(workspaceKey);
  } catch {
    // Local storage may be unavailable in a restricted browser preview.
  }
}

export function loadLastDocumentPath(): string | null {
  try {
    return localStorage.getItem(lastDocumentKey);
  } catch {
    return null;
  }
}

export function saveLastDocumentPath(path: string | null): void {
  try {
    if (path) localStorage.setItem(lastDocumentKey, path);
    else localStorage.removeItem(lastDocumentKey);
  } catch {
    // Local storage may be unavailable in a restricted browser preview.
  }
}

function parseOpenTabs(parsed: unknown): RecentFile[] {
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<string>();
  return parsed
    .filter(
      (item): item is RecentFile =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as RecentFile).path === "string" &&
        typeof (item as RecentFile).name === "string" &&
        (item as RecentFile).path.trim().length > 0 &&
        (item as RecentFile).name.trim().length > 0,
    )
    .filter((item) => !item.path.startsWith("browser://"))
    .filter((item) => {
      const key = comparablePath(item.path);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxOpenTabs);
}

export function loadOpenTabs(): RecentFile[] {
  try {
    const raw = localStorage.getItem(openTabsKey);
    if (!raw) return [];
    return parseOpenTabs(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

function workspacePathContains(root: string, candidate: string): boolean {
  const normalizedRoot = comparablePath(root);
  const normalizedCandidate = comparablePath(candidate);
  return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}\\`);
}

function parseWorkspaceSessions(raw: string | null): WorkspaceSession[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<string>();
  return parsed
    .filter(
      (item): item is { path: string; tabs?: unknown; activeDocumentPath?: unknown } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { path?: unknown }).path === "string" &&
        (item as { path: string }).path.trim().length > 0,
    )
    .map((item) => {
      const tabs = parseOpenTabs(item.tabs).filter((tab) => workspacePathContains(item.path, tab.path));
      const activeDocumentPath =
        typeof item.activeDocumentPath === "string" && workspacePathContains(item.path, item.activeDocumentPath)
          ? item.activeDocumentPath
          : null;
      return { path: item.path, tabs, activeDocumentPath };
    })
    .filter((session) => {
      const key = comparablePath(session.path);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_MOUNTED_WORKSPACES);
}

export function loadWorkspaceSessions(): WorkspaceSession[] {
  try {
    return parseWorkspaceSessions(localStorage.getItem(workspaceSessionsKey));
  } catch {
    return [];
  }
}

export function saveWorkspaceSessions(sessions: WorkspaceSession[]): void {
  try {
    const normalized = parseWorkspaceSessions(JSON.stringify(sessions));
    localStorage.setItem(workspaceSessionsKey, JSON.stringify(normalized));
  } catch {
    // Workspace session restoration is best-effort when local storage is unavailable.
  }
}

export function saveWorkspaceSession(session: WorkspaceSession): void {
  const key = comparablePath(session.path);
  const next = [session, ...loadWorkspaceSessions().filter((item) => comparablePath(item.path) !== key)].slice(
    0,
    MAX_MOUNTED_WORKSPACES,
  );
  saveWorkspaceSessions(next);
}

export function forgetWorkspaceSession(path: string): void {
  const key = comparablePath(path);
  saveWorkspaceSessions(loadWorkspaceSessions().filter((session) => comparablePath(session.path) !== key));
}

export function saveOpenTabs(tabs: RecentFile[]): void {
  try {
    const seen = new Set<string>();
    const next = tabs
      .filter((tab) => tab.path.trim().length > 0 && tab.name.trim().length > 0 && !tab.path.startsWith("browser://"))
      .filter((tab) => {
        const key = comparablePath(tab.path);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, maxOpenTabs);
    localStorage.setItem(openTabsKey, JSON.stringify(next));
  } catch {
    // Session restoration is best-effort when local storage is unavailable.
  }
}

type StoredReadingPosition = {
  path: string;
  top: number;
};

function loadReadingPositions(): StoredReadingPosition[] {
  try {
    const raw = localStorage.getItem(readingPositionsKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const seen = new Set<string>();
    return parsed
      .filter(
        (item): item is StoredReadingPosition =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as StoredReadingPosition).path === "string" &&
          typeof (item as StoredReadingPosition).top === "number" &&
          Number.isFinite((item as StoredReadingPosition).top) &&
          (item as StoredReadingPosition).top >= 0,
      )
      .filter((item) => {
        const key = comparablePath(item.path);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, maxReadingPositions);
  } catch {
    return [];
  }
}

export function loadReadingPosition(path: string): number {
  const key = comparablePath(path);
  return loadReadingPositions().find((item) => comparablePath(item.path) === key)?.top ?? 0;
}

export function saveReadingPosition(path: string, top: number): void {
  const key = comparablePath(path);
  if (!key || !Number.isFinite(top)) return;

  try {
    const next = [
      { path, top: Math.max(0, Math.round(top)) },
      ...loadReadingPositions().filter((item) => comparablePath(item.path) !== key),
    ].slice(0, maxReadingPositions);
    localStorage.setItem(readingPositionsKey, JSON.stringify(next));
  } catch {
    // Local storage may be unavailable in a restricted browser preview.
  }
}

function parseWorkspaceList(raw: string | null, limit: number): RecentWorkspace[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<string>();
  return parsed
    .filter(
      (item): item is RecentWorkspace =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as RecentWorkspace).path === "string" &&
        typeof (item as RecentWorkspace).name === "string" &&
        (item as RecentWorkspace).path.trim().length > 0 &&
        (item as RecentWorkspace).name.trim().length > 0,
    )
    .filter((workspace) => {
      const key = comparablePath(workspace.path);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function loadWorkspaceList(key: string, limit: number): RecentWorkspace[] {
  try {
    return parseWorkspaceList(localStorage.getItem(key), limit);
  } catch {
    return [];
  }
}

function saveWorkspaceList(key: string, workspaces: RecentWorkspace[], limit: number): void {
  try {
    const normalized = parseWorkspaceList(JSON.stringify(workspaces), limit);
    localStorage.setItem(key, JSON.stringify(normalized));
  } catch {
    // Workspace lists remain available for the current session.
  }
}

export function loadRecentWorkspaces(): RecentWorkspace[] {
  return loadWorkspaceList(recentWorkspacesKey, maxRecentWorkspaces);
}

export function saveRecentWorkspaces(workspaces: RecentWorkspace[]): void {
  saveWorkspaceList(recentWorkspacesKey, workspaces, maxRecentWorkspaces);
}

export function rememberRecentWorkspace(workspace: RecentWorkspace): RecentWorkspace[] {
  const key = comparablePath(workspace.path);
  const next = [workspace, ...loadRecentWorkspaces().filter((item) => comparablePath(item.path) !== key)].slice(
    0,
    maxRecentWorkspaces,
  );
  saveRecentWorkspaces(next);
  return next;
}

export function loadMountedWorkspaces(): RecentWorkspace[] {
  return loadWorkspaceList(mountedWorkspacesKey, MAX_MOUNTED_WORKSPACES);
}

export function saveMountedWorkspaces(workspaces: RecentWorkspace[]): void {
  saveWorkspaceList(mountedWorkspacesKey, workspaces, MAX_MOUNTED_WORKSPACES);
}

export function rememberMountedWorkspace(workspace: RecentWorkspace): RecentWorkspace[] {
  const key = comparablePath(workspace.path);
  const next = [workspace, ...loadMountedWorkspaces().filter((item) => comparablePath(item.path) !== key)].slice(
    0,
    MAX_MOUNTED_WORKSPACES,
  );
  saveMountedWorkspaces(next);
  return next;
}

export function forgetMountedWorkspace(path: string): RecentWorkspace[] {
  const key = comparablePath(path);
  const next = loadMountedWorkspaces().filter((workspace) => comparablePath(workspace.path) !== key);
  saveMountedWorkspaces(next);
  return next;
}

export function loadRecentFiles(): RecentFile[] {
  try {
    const raw = localStorage.getItem(recentFilesKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is RecentFile =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as RecentFile).path === "string" &&
          typeof (item as RecentFile).name === "string",
      )
      .slice(0, maxRecentFiles);
  } catch {
    return [];
  }
}

export function rememberRecentFile(file: RecentFile): RecentFile[] {
  const next = [file, ...loadRecentFiles().filter((item) => item.path !== file.path)].slice(0, maxRecentFiles);
  saveRecentFiles(next);
  return next;
}

export function saveRecentFiles(files: RecentFile[]): void {
  try {
    localStorage.setItem(recentFilesKey, JSON.stringify(files.slice(0, maxRecentFiles)));
  } catch {
    // Recent files remain available for the current session.
  }
}
