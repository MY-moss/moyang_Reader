import type { RecentWorkspace } from "./types";

function comparablePath(path: string): string {
  return path
    .replace(/[\\/]+/g, "\\")
    .replace(/\\$/, "")
    .toLocaleLowerCase();
}

export function filterSwitchableWorkspaces(
  workspaces: RecentWorkspace[],
  activePath: string | null,
): RecentWorkspace[] {
  if (!activePath) return workspaces;
  const activeKey = comparablePath(activePath);
  return workspaces.filter((workspace) => comparablePath(workspace.path) !== activeKey);
}
