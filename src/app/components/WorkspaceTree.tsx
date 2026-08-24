import { useMemo, useState } from "react";
import type { WorkspaceFile } from "../types";
import { buildWorkspaceTree, type WorkspaceTreeFolder } from "../workspace-tree";

type WorkspaceTreeProps = {
  files: WorkspaceFile[];
  activePath: string | null;
  onOpenFile: (path: string) => void;
};

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

type WorkspaceFileButtonProps = {
  file: WorkspaceFile;
  activePath: string | null;
  depth: number;
  onOpenFile: (path: string) => void;
};

function WorkspaceFileButton({ file, activePath, depth, onOpenFile }: WorkspaceFileButtonProps) {
  return (
    <button
      type="button"
      className={`workspace-file ${activePath === file.path ? "active" : ""}`}
      style={{ paddingLeft: `${7 + depth * 14}px` }}
      title={`${file.relativePath} · ${formatSize(file.size)}`}
      onClick={() => onOpenFile(file.path)}
    >
      <span>{file.name}</span>
      {depth === 0 && <small>{file.relativePath === file.name ? "" : file.relativePath}</small>}
    </button>
  );
}

type WorkspaceFolderProps = {
  folder: WorkspaceTreeFolder;
  depth: number;
  collapsedFolders: ReadonlySet<string>;
  onToggleFolder: (path: string) => void;
  activePath: string | null;
  onOpenFile: (path: string) => void;
};

function WorkspaceFolder({
  folder,
  depth,
  collapsedFolders,
  onToggleFolder,
  activePath,
  onOpenFile,
}: WorkspaceFolderProps) {
  const isOpen = !collapsedFolders.has(folder.path);

  return (
    <div className="workspace-folder-group">
      <button
        type="button"
        className="workspace-folder"
        style={{ paddingLeft: `${7 + depth * 14}px` }}
        aria-expanded={isOpen}
        onClick={() => onToggleFolder(folder.path)}
      >
        <span className="workspace-folder-caret" aria-hidden="true">
          {isOpen ? "⌄" : "›"}
        </span>
        <span>{folder.name}</span>
        <small>{folder.fileCount}</small>
      </button>
      {isOpen && (
        <>
          {folder.files.map((file) => (
            <WorkspaceFileButton
              key={file.path}
              file={file}
              activePath={activePath}
              depth={depth + 1}
              onOpenFile={onOpenFile}
            />
          ))}
          {folder.folders.map((child) => (
            <WorkspaceFolder
              key={child.path}
              folder={child}
              depth={depth + 1}
              collapsedFolders={collapsedFolders}
              onToggleFolder={onToggleFolder}
              activePath={activePath}
              onOpenFile={onOpenFile}
            />
          ))}
        </>
      )}
    </div>
  );
}

export function WorkspaceTreeView({ files, activePath, onOpenFile }: WorkspaceTreeProps) {
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => new Set());
  const [showAll, setShowAll] = useState(false);
  const tree = useMemo(() => buildWorkspaceTree(showAll ? files : files.slice(0, 80)), [files, showAll]);

  const toggleFolder = (path: string) => {
    setCollapsedFolders((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <>
      {tree.files.map((file) => (
        <WorkspaceFileButton key={file.path} file={file} activePath={activePath} depth={0} onOpenFile={onOpenFile} />
      ))}
      {tree.folders.map((folder) => (
        <WorkspaceFolder
          key={folder.path}
          folder={folder}
          depth={0}
          collapsedFolders={collapsedFolders}
          onToggleFolder={toggleFolder}
          activePath={activePath}
          onOpenFile={onOpenFile}
        />
      ))}
      {files.length > 80 && (
        <button type="button" className="quiet-button" onClick={() => setShowAll((current) => !current)}>
          {showAll ? "收起列表" : `显示全部 ${files.length} 项`}
        </button>
      )}
    </>
  );
}
