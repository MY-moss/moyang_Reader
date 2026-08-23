import type { WorkspaceFile } from "./types";

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

function compareNames(left: { name: string }, right: { name: string }): number {
  return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" });
}

function sortFolder(folder: WorkspaceTreeFolder): void {
  folder.files.sort(compareNames);
  folder.folders.sort(compareNames);
  folder.folders.forEach(sortFolder);
}

export function buildWorkspaceTree(files: WorkspaceFile[]): WorkspaceTree {
  const root: WorkspaceTreeFolder = {
    name: "",
    path: "",
    files: [],
    folders: [],
    fileCount: 0,
  };

  for (const file of files) {
    const parts = file.relativePath.replaceAll("\\", "/").split("/").filter(Boolean);
    const fileName = parts.pop() || file.name;
    let current = root;
    current.fileCount += 1;

    for (const part of parts) {
      const folderPath = current.path ? `${current.path}/${part}` : part;
      let folder = current.folders.find((candidate) => candidate.name.toLocaleLowerCase() === part.toLocaleLowerCase());
      if (!folder) {
        folder = {
          name: part,
          path: folderPath,
          files: [],
          folders: [],
          fileCount: 0,
        };
        current.folders.push(folder);
      }
      current = folder;
      current.fileCount += 1;
    }

    current.files.push({ ...file, name: fileName });
  }

  sortFolder(root);
  return { files: root.files, folders: root.folders };
}
