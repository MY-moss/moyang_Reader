import type { RecentFile, RecentWorkspace } from "./types";

const workspaceKey = "moyang-reader-workspace";
const recentFilesKey = "moyang-reader-recent-files";
const recentWorkspacesKey = "moyang-reader-recent-workspaces";
const lastDocumentKey = "moyang-reader-last-document";
const maxRecentFiles = 12;
const maxRecentWorkspaces = 8;

function comparablePath(path: string): string {
  return path
    .replace(/[\\/]+/g, "\\")
    .replace(/\\$/, "")
    .toLocaleLowerCase();
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

export function loadRecentWorkspaces(): RecentWorkspace[] {
  try {
    const raw = localStorage.getItem(recentWorkspacesKey);
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
      .slice(0, maxRecentWorkspaces);
  } catch {
    return [];
  }
}

export function saveRecentWorkspaces(workspaces: RecentWorkspace[]): void {
  try {
    localStorage.setItem(recentWorkspacesKey, JSON.stringify(workspaces.slice(0, maxRecentWorkspaces)));
  } catch {
    // Recent workspaces remain available for the current session.
  }
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
