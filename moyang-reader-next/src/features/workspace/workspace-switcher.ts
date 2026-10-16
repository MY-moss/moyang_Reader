import { normalizePathKey } from "../../platform/path-key";
import type { RecentWorkspace } from "../../shared/types";

function comparablePath(path: string): string {
  return normalizePathKey(path);
}

export function filterSwitchableWorkspaces(
  workspaces: RecentWorkspace[],
  activePath: string | null,
): RecentWorkspace[] {
  if (!activePath) return workspaces;
  const activeKey = comparablePath(activePath);
  return workspaces.filter((workspace) => comparablePath(workspace.path) !== activeKey);
}
