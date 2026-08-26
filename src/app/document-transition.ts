import type { OpenDocument } from "./types";
import { normalizePathKey } from "./path-key";

type ActiveDocument = Pick<OpenDocument, "path" | "modified">;

function comparablePath(path: string): string {
  return normalizePathKey(path);
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

export function formatTransitionConfirmation(action: string, draftSaved: boolean): string {
  return draftSaved
    ? `当前文档的最新修改已自动保留为草稿，可在“草稿”中心恢复。仍要${action}吗？`
    : `当前文档有未保存修改，${action}后将丢失这些修改。继续吗？`;
}

