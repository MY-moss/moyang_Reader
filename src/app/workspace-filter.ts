import type { DocumentKind, WorkspaceFile } from "./types";

export type WorkspaceKindFilter = "all" | DocumentKind;

export function matchesWorkspaceFilter(
  file: WorkspaceFile,
  kindFilter: WorkspaceKindFilter,
  selectedTag: string | null,
  taggedFilePaths: ReadonlySet<string>,
): boolean {
  if (kindFilter !== "all" && file.kind !== kindFilter) return false;
  return !selectedTag || taggedFilePaths.has(file.path);
}
