import type { RecentFile } from "./types";

const workspaceKey = "moyang-reader-workspace";
const recentFilesKey = "moyang-reader-recent-files";
const maxRecentFiles = 12;

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

export function loadRecentFiles(): RecentFile[] {
  try {
    const raw = localStorage.getItem(recentFilesKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is RecentFile => (
        typeof item === "object" &&
        item !== null &&
        typeof (item as RecentFile).path === "string" &&
        typeof (item as RecentFile).name === "string"
      ))
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
