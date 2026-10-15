import { normalizePathKey } from "../../platform/path-key";

function displayPath(path: string): string {
  const local = path.startsWith("\\\\?\\UNC\\")
    ? "\\\\" + path.slice(8)
    : path.startsWith("\\\\?\\")
      ? path.slice(4)
      : path;
  const result = local.replace(/[\\/]+/g, "\\").replace(/\\$/, "");
  return local.startsWith("\\\\") ? "\\" + result : result;
}

/** Resolve a workspace-relative tree path without allowing an absolute path to leak in. */
export function workspaceEntryAbsolutePath(workspacePath: string, entryPath: string): string {
  const relative = entryPath.replace(/[\\/]+/g, "\\").replace(/^\\+|\\+$/g, "");
  if (!relative) return workspacePath;
  return `${displayPath(workspacePath)}\\${relative}`;
}

export function isPathWithinEntry(path: string, entryPath: string): boolean {
  const candidate = normalizePathKey(path);
  const entry = normalizePathKey(entryPath);
  return candidate === entry || candidate.startsWith(`${entry}\\`);
}

/** Rebase an open-tab or recent-file path after renaming a file or directory. */
export function rebaseWorkspacePath(path: string, previousPath: string, nextPath: string): string {
  if (!isPathWithinEntry(path, previousPath)) return path;

  const normalizedPath = displayPath(path);
  const normalizedPrevious = displayPath(previousPath);
  const normalizedNext = displayPath(nextPath);
  const suffix = normalizedPath.slice(normalizedPrevious.length).replace(/^\\+/, "");
  return suffix ? `${normalizedNext}\\${suffix}` : normalizedNext;
}
