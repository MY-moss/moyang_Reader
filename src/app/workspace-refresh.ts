function normalizeWorkspacePath(value: string | null): string {
  return (value ?? "")
    .replace(/[\\/]+/g, "\\")
    .replace(/\\$/, "")
    .toLocaleLowerCase();
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
