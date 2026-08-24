import type { OpenDocument } from "./types";

type ActiveDocument = Pick<OpenDocument, "path" | "modified">;

function comparablePath(path: string): string {
  return path
    .replace(/[\\/]+/g, "\\")
    .replace(/\\$/, "")
    .toLocaleLowerCase();
}

export function isSameDocumentPath(left: string, right: string): boolean {
  return comparablePath(left) === comparablePath(right);
}

export function shouldConfirmDocumentReplacement(
  document: ActiveDocument | null,
  nextPaths: readonly string[],
): boolean {
  if (!document?.modified) return false;
  const currentPath = comparablePath(document.path);
  return nextPaths.some((path) => !isSameDocumentPath(path, currentPath));
}

export function shouldConfirmWorkspaceSwitch(
  documentModified: boolean,
  currentWorkspacePath: string | null,
  nextWorkspacePath: string,
): boolean {
  if (!documentModified) return false;
  return comparablePath(currentWorkspacePath ?? "") !== comparablePath(nextWorkspacePath);
}
