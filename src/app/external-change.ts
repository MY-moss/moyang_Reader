import { isPathWithin } from "./path-key";

export type ExternalChangeAction = "ignore" | "reload" | "notify";

export type ExternalChangeInput = {
  changedPaths: readonly string[];
  currentPath: string;
  modified: boolean;
  selfWriting?: boolean;
  selfWrittenUntil?: number;
  now: number;
};

function pathWasChanged(changedPath: string, currentPath: string): boolean {
  return isPathWithin(currentPath, changedPath) || isPathWithin(changedPath, currentPath);
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
