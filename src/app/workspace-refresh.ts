import type { WorkspaceFile, WorkspaceIndexEntry, WorkspaceRefreshResult } from "./types";

function normalizeWorkspacePath(value: string | null): string {
  return (value ?? "")
    .replace(/[\\/]+/g, "\\")
    .replace(/\\$/, "")
    .toLocaleLowerCase();
}

function isWithinScope(path: string, scope: string): boolean {
  const candidate = normalizeWorkspacePath(path);
  const root = normalizeWorkspacePath(scope);
  return Boolean(root) && (candidate === root || candidate.startsWith(`${root}\\`));
}

function sortWorkspaceFiles(files: WorkspaceFile[]): WorkspaceFile[] {
  return [...files].sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath, undefined, { sensitivity: "base" }),
  );
}

export function applyWorkspaceFileDelta(current: WorkspaceFile[], delta: WorkspaceRefreshResult): WorkspaceFile[] {
  const retained = current.filter((file) => !delta.scopePaths.some((scope) => isWithinScope(file.path, scope)));
  const byPath = new Map(retained.map((file) => [normalizeWorkspacePath(file.path), file]));
  for (const file of delta.files) byPath.set(normalizeWorkspacePath(file.path), file);
  return sortWorkspaceFiles([...byPath.values()]);
}

export function applyWorkspaceIndexDelta(
  current: WorkspaceIndexEntry[],
  delta: WorkspaceRefreshResult,
): WorkspaceIndexEntry[] {
  const retained = current.filter((entry) => !delta.scopePaths.some((scope) => isWithinScope(entry.file.path, scope)));
  const byPath = new Map(retained.map((entry) => [normalizeWorkspacePath(entry.file.path), entry]));
  for (const entry of delta.index) byPath.set(normalizeWorkspacePath(entry.file.path), entry);
  return [...byPath.values()].sort((left, right) =>
    left.file.relativePath.localeCompare(right.file.relativePath, undefined, { sensitivity: "base" }),
  );
}

export function isCurrentWorkspaceLoad(
  requestId: number,
  currentRequestId: number,
  root: string,
  currentRoot: string | null,
): boolean {
  return requestId === currentRequestId && normalizeWorkspacePath(root) === normalizeWorkspacePath(currentRoot);
}

export function isSelfWrittenChangePending(writtenUntil: number | undefined, now: number): boolean {
  return typeof writtenUntil === "number" && writtenUntil > now;
}
