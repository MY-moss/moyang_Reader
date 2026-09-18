import type { ContextPanelTab, RecentFile, RecentWorkspace } from "./types";
import { PERSISTED_STORAGE_KEYS } from "./compatibility-contract";
import { isPathWithin, normalizePathKey } from "./path-key";
import { DEFAULT_PANE_WIDTHS, normalizePaneWidths, type PaneWidths } from "./pane-layout";
import { normalizeReadingPositionAnchor, type ReadingPositionAnchor } from "./reading-position";

const workspaceKey = PERSISTED_STORAGE_KEYS.workspace;
const recentFilesKey = PERSISTED_STORAGE_KEYS.recentFiles;
const recentWorkspacesKey = PERSISTED_STORAGE_KEYS.recentWorkspaces;
const mountedWorkspacesKey = PERSISTED_STORAGE_KEYS.mountedWorkspaces;
const workspaceSessionsKey = PERSISTED_STORAGE_KEYS.workspaceSessions;
const lastDocumentKey = PERSISTED_STORAGE_KEYS.lastDocument;
const openTabsKey = PERSISTED_STORAGE_KEYS.openTabs;
const readingPositionsKey = PERSISTED_STORAGE_KEYS.readingPositions;
const sidebarCollapsedKey = PERSISTED_STORAGE_KEYS.sidebarCollapsed;
const contextPanelOpenKey = PERSISTED_STORAGE_KEYS.contextPanelOpen;
const contextPanelTabKey = PERSISTED_STORAGE_KEYS.contextPanelTab;
const paneWidthsKey = PERSISTED_STORAGE_KEYS.paneWidths;
export const MAX_RECENT_FILES = 50;
const maxRecentWorkspaces = 8;
export const MAX_MOUNTED_WORKSPACES = 5;
const maxOpenTabs = 16;
export const MAX_READING_POSITIONS = 256;

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

function validRecentFileTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function parseRecentFile(value: unknown): RecentFile | null {
  if (
    typeof value !== "object" ||
    value === null ||
    typeof (value as RecentFile).path !== "string" ||
    typeof (value as RecentFile).name !== "string"
  ) {
    return null;
  }

  const file = value as RecentFile;
  if (!file.path.trim() || !file.name.trim() || file.path.startsWith("browser://")) return null;
  return validRecentFileTimestamp(file.lastOpenedAt)
    ? { path: file.path, name: file.name, lastOpenedAt: file.lastOpenedAt }
    : { path: file.path, name: file.name };
}

function sortRecentFiles(files: RecentFile[]): RecentFile[] {
  return files
    .map((file, index) => ({ file, index, timestamp: file.lastOpenedAt }))
    .sort((left, right) => {
      const leftTimestamp = validRecentFileTimestamp(left.timestamp) ? left.timestamp : undefined;
      const rightTimestamp = validRecentFileTimestamp(right.timestamp) ? right.timestamp : undefined;
      if (leftTimestamp !== undefined && rightTimestamp !== undefined) {
        return rightTimestamp - leftTimestamp || left.index - right.index;
      }
      if (leftTimestamp !== undefined || rightTimestamp !== undefined) return leftTimestamp !== undefined ? -1 : 1;
      return left.index - right.index;
    })
    .map(({ file }) => file);
}

function normalizeRecentFiles(value: unknown): RecentFile[] {
  if (!Array.isArray(value)) return [];

  return sortRecentFiles(value.map(parseRecentFile).filter((file): file is RecentFile => file !== null)).slice(
    0,
    MAX_RECENT_FILES,
  );
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
    .map(parseRecentFile)
    .filter((item): item is RecentFile => item !== null)
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
      const tabs = parseOpenTabs(item.tabs).filter((tab) => isPathWithin(tab.path, item.path));
      const activeDocumentPath =
        typeof item.activeDocumentPath === "string" && isPathWithin(item.activeDocumentPath, item.path)
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

export type ReadingPosition = ReadingPositionAnchor & {
  path: string;
  top: number;
  updatedAt?: number;
};

function normalizeReadingPosition(value: unknown): ReadingPosition | null {
  if (
    typeof value !== "object" ||
    value === null ||
    typeof (value as ReadingPosition).path !== "string" ||
    typeof (value as ReadingPosition).top !== "number" ||
    !Number.isFinite((value as ReadingPosition).top) ||
    (value as ReadingPosition).top < 0
  ) {
    return null;
  }

  const candidate = value as ReadingPosition;
  const path = candidate.path.trim();
  if (!path) return null;

  const anchor = normalizeReadingPositionAnchor(candidate);
  const updatedAt =
    typeof candidate.updatedAt === "number" && Number.isFinite(candidate.updatedAt) && candidate.updatedAt >= 0
      ? Math.round(candidate.updatedAt)
      : undefined;
  return {
    path,
    top: Math.max(0, Math.round(candidate.top)),
    ...anchor,
    ...(updatedAt !== undefined ? { updatedAt } : {}),
  };
}

export function normalizeReadingPositions(value: unknown): ReadingPosition[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  return value
    .map(normalizeReadingPosition)
    .filter((item): item is ReadingPosition => item !== null)
    .filter((item) => {
      const key = comparablePath(item.path);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_READING_POSITIONS);
}

export function loadReadingPositions(): ReadingPosition[] {
  try {
    const raw = localStorage.getItem(readingPositionsKey);
    if (!raw) return [];
    return normalizeReadingPositions(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function saveReadingPositions(positions: readonly ReadingPosition[]): void {
  try {
    localStorage.setItem(readingPositionsKey, JSON.stringify(normalizeReadingPositions(positions)));
  } catch {
    // Local storage may be unavailable in a restricted browser preview.
  }
}

export function loadReadingPosition(path: string): number {
  return loadReadingPositionAnchor(path)?.top ?? 0;
}

export function loadReadingPositionAnchor(path: string): ReadingPosition | null {
  const key = comparablePath(path);
  return loadReadingPositions().find((item) => comparablePath(item.path) === key) ?? null;
}

export function saveReadingPosition(path: string, top: number, anchor?: ReadingPositionAnchor): void {
  const key = comparablePath(path);
  if (!key || !Number.isFinite(top)) return;

  saveReadingPositions([
    {
      path,
      top,
      ...normalizeReadingPositionAnchor(anchor),
      updatedAt: Date.now(),
    },
    ...loadReadingPositions().filter((item) => comparablePath(item.path) !== key),
  ]);
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
    return normalizeRecentFiles(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function rememberRecentFile(file: RecentFile, openedAt = Date.now()): RecentFile[] {
  const stampedFile = validRecentFileTimestamp(openedAt)
    ? { path: file.path, name: file.name, lastOpenedAt: openedAt }
    : { path: file.path, name: file.name };
  const next = normalizeRecentFiles([stampedFile, ...loadRecentFiles().filter((item) => item.path !== file.path)]);
  saveRecentFiles(next);
  return next;
}

export function saveRecentFiles(files: RecentFile[]): void {
  try {
    localStorage.setItem(recentFilesKey, JSON.stringify(normalizeRecentFiles(files)));
  } catch {
    // Recent files remain available for the current session.
  }
}

export function formatRecentFileTime(lastOpenedAt?: number, now = Date.now()): string {
  if (!validRecentFileTimestamp(lastOpenedAt)) return "打开时间未知";

  const elapsedMinutes = Math.max(0, Math.floor((now - lastOpenedAt) / 60_000));
  if (elapsedMinutes < 1) return "刚刚";
  if (elapsedMinutes < 60) return `${elapsedMinutes} 分钟前`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} 小时前`;
  return `${Math.floor(elapsedHours / 24)} 天前`;
}
