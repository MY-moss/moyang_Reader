import { normalizePathKey } from "./path-key";

export type ExternalChangeAction = "ignore" | "reload" | "notify";

export type ExternalChangeInput = {
  changedPaths: readonly string[];
  currentPath: string;
  modified: boolean;
  selfWriting?: boolean;
  selfWrittenUntil?: number;
  now: number;
};

function comparablePath(path: string): string {
  return normalizePathKey(path);
}

function pathWasChanged(changedPath: string, currentPath: string): boolean {
  const changed = comparablePath(changedPath);
  const current = comparablePath(currentPath);
  return changed === current || current.startsWith(`${changed}\\`) || changed.startsWith(`${current}\\`);
}

export function resolveExternalChangeAction({
  changedPaths,
  currentPath,
  modified,
  selfWriting,
  selfWrittenUntil,
  now,
}: ExternalChangeInput): ExternalChangeAction {
  if (!changedPaths.some((path) => pathWasChanged(path, currentPath))) return "ignore";
  if (selfWriting) return "ignore";
  if (typeof selfWrittenUntil === "number" && selfWrittenUntil > now) return "ignore";
  return modified ? "notify" : "reload";
}
