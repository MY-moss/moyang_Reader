import type { WorkspaceDirectory, WorkspaceFile } from "./types";
import { normalizePathKey } from "./path-key";

export type WorkspaceTreeFolder = {
  name: string;
  path: string;
  files: WorkspaceFile[];
  folders: WorkspaceTreeFolder[];
  fileCount: number;
};

export type WorkspaceTree = {
  files: WorkspaceFile[];
  folders: WorkspaceTreeFolder[];
};

export type WorkspaceTreeRow =
  | { kind: "file"; file: WorkspaceFile; depth: number }
  | { kind: "folder"; folder: WorkspaceTreeFolder; depth: number; expanded: boolean };

export const WORKSPACE_TREE_ROW_HEIGHT = 42;
export const WORKSPACE_TREE_OVERSCAN = 8;

export type WorkspaceTreeWindow = {
  start: number;
  end: number;
};

export function getWorkspaceTreeWindow(
  rowCount: number,
  scrollTop: number,
  viewportHeight: number,
  rowHeight = WORKSPACE_TREE_ROW_HEIGHT,
  overscan = WORKSPACE_TREE_OVERSCAN,
): WorkspaceTreeWindow {
  const total = Math.max(0, Math.floor(rowCount));
  if (total === 0) return { start: 0, end: 0 };
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return { start: 0, end: total };

  const safeRowHeight = Math.max(1, rowHeight);
  const safeOverscan = Math.max(0, Math.floor(overscan));
  const safeScrollTop = Math.max(0, Number.isFinite(scrollTop) ? scrollTop : 0);
  const start = Math.max(0, Math.floor(safeScrollTop / safeRowHeight) - safeOverscan);
  const end = Math.min(
    total,
    Math.max(start, Math.ceil((safeScrollTop + viewportHeight) / safeRowHeight) + safeOverscan),
  );
  return { start, end };
}

function compareNames(left: { name: string }, right: { name: string }): number {
  return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" });
}

function sortFolder(folder: WorkspaceTreeFolder): void {
  folder.files.sort(compareNames);
  folder.folders.sort(compareNames);
  folder.folders.forEach(sortFolder);
}

export function buildWorkspaceTree(files: WorkspaceFile[], directories: WorkspaceDirectory[] = []): WorkspaceTree {
  const root: WorkspaceTreeFolder = {
    name: "",
    path: "",
    files: [],
    folders: [],
    fileCount: 0,
  };
  const foldersByPath = new Map<string, WorkspaceTreeFolder>([["", root]]);

  const ensureFolder = (relativePath: string): WorkspaceTreeFolder => {
    const parts = relativePath.replaceAll("\\", "/").split("/").filter(Boolean);
    let current = root;
    for (const part of parts) {
      const folderPath = current.path ? `${current.path}/${part}` : part;
      const folderKey = normalizePathKey(folderPath);
      let folder = foldersByPath.get(folderKey);
      if (!folder) {
        folder = {
          name: part,
          path: folderPath,
          files: [],
          folders: [],
          fileCount: 0,
        };
        current.folders.push(folder);
        foldersByPath.set(folderKey, folder);
      }
      current = folder;
    }
    return current;
  };

  for (const directory of directories) ensureFolder(directory.relativePath);

  for (const file of files) {
    const parts = file.relativePath.replaceAll("\\", "/").split("/").filter(Boolean);
    const fileName = parts.pop() || file.name;
    let current = root;
    current.fileCount += 1;

    for (const part of parts) {
      current = ensureFolder(current.path ? `${current.path}/${part}` : part);
      current.fileCount += 1;
    }

    current.files.push({ ...file, name: fileName });
  }

  sortFolder(root);
  return { files: root.files, folders: root.folders };
}

export function flattenWorkspaceTree(
  tree: WorkspaceTree,
  collapsedFolders: ReadonlySet<string> = new Set(),
): WorkspaceTreeRow[] {
  const rows: WorkspaceTreeRow[] = tree.files.map((file) => ({ kind: "file", file, depth: 0 }));

  const appendFolder = (folder: WorkspaceTreeFolder, depth: number): void => {
    const expanded = !collapsedFolders.has(folder.path);
    rows.push({ kind: "folder", folder, depth, expanded });
    if (!expanded) return;

    rows.push(...folder.files.map((file) => ({ kind: "file" as const, file, depth: depth + 1 })));
    folder.folders.forEach((child) => appendFolder(child, depth + 1));
  };

  tree.folders.forEach((folder) => appendFolder(folder, 0));
  return rows;
}
