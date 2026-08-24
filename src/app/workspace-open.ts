import type { WorkspaceFile } from "./types";

export const workspaceBatchOpenLimit = 40;

function comparablePath(path: string): string {
  return path
    .replace(/[\\/]+/g, "\\")
    .replace(/\\$/, "")
    .toLocaleLowerCase();
}

export type WorkspaceOpenPlan = {
  files: WorkspaceFile[];
  skippedCount: number;
};

export function createWorkspaceOpenPlan(files: WorkspaceFile[], limit = workspaceBatchOpenLimit): WorkspaceOpenPlan {
  const seen = new Set<string>();
  const uniqueFiles = files.filter((file) => {
    const key = comparablePath(file.path);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    files: uniqueFiles.slice(0, Math.max(0, limit)),
    skippedCount: Math.max(0, uniqueFiles.length - Math.max(0, limit)),
  };
}
