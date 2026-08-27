import { useMemo, useState, type KeyboardEvent } from "react";
import type { WorkspaceDirectory, WorkspaceFile } from "../types";
import { buildWorkspaceTree, type WorkspaceTreeFolder } from "../workspace-tree";
import { ContextMenu } from "./ContextMenu";

type WorkspaceTreeContextTarget = {
  x: number;
  y: number;
  parentPath: string;
  label: string;
};

type WorkspaceTreeProps = {
  files: WorkspaceFile[];
  folders?: WorkspaceDirectory[];
  activePath: string | null;
  onOpenFile: (path: string) => void;
  onCreateNote?: (parentPath: string) => void;
  onCreateFolder?: (parentPath: string) => void;
};

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function parentRelativePath(relativePath: string): string {
  const parts = relativePath.replaceAll("\\", "/").split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

function isContextMenuKey(event: KeyboardEvent): boolean {
  return event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey);
}

function targetFromKeyboard(event: KeyboardEvent<HTMLButtonElement>, parentPath: string, label: string) {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: rect.left + Math.min(32, rect.width / 2),
    y: rect.bottom,
    parentPath,
    label,
  } satisfies WorkspaceTreeContextTarget;
}

type WorkspaceFileButtonProps = {
  file: WorkspaceFile;
  activePath: string | null;
  depth: number;
  onOpenFile: (path: string) => void;
  onOpenContextMenu: (target: WorkspaceTreeContextTarget) => void;
};

function WorkspaceFileButton({ file, activePath, depth, onOpenFile, onOpenContextMenu }: WorkspaceFileButtonProps) {
  const parentPath = parentRelativePath(file.relativePath);
  const parentLabel = parentPath ? `“${parentPath}”` : "阅读库根目录";
  return (
    <button
      type="button"
      className={`workspace-file ${activePath === file.path ? "active" : ""}`}
      style={{ paddingLeft: `${7 + depth * 14}px` }}
      title={`${file.relativePath} · ${formatSize(file.size)}`}
      onClick={() => onOpenFile(file.path)}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpenContextMenu({ x: event.clientX, y: event.clientY, parentPath, label: parentLabel });
      }}
      onKeyDown={(event) => {
        if (!isContextMenuKey(event)) return;
        event.preventDefault();
        onOpenContextMenu(targetFromKeyboard(event, parentPath, parentLabel));
      }}
    >
      <span>{file.name}</span>
      {depth === 0 && file.relativePath !== file.name && <small>{file.relativePath}</small>}
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
  onOpenContextMenu: (target: WorkspaceTreeContextTarget) => void;
};

function WorkspaceFolder({
  folder,
  depth,
  collapsedFolders,
  onToggleFolder,
  activePath,
  onOpenFile,
  onOpenContextMenu,
}: WorkspaceFolderProps) {
  const isOpen = !collapsedFolders.has(folder.path);
  const folderLabel = `“${folder.path}”`;

  return (
    <div className="workspace-folder-group">
      <button
        type="button"
        className="workspace-folder"
        style={{ paddingLeft: `${7 + depth * 14}px` }}
        aria-expanded={isOpen}
        onClick={() => onToggleFolder(folder.path)}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onOpenContextMenu({ x: event.clientX, y: event.clientY, parentPath: folder.path, label: folderLabel });
        }}
        onKeyDown={(event) => {
          if (!isContextMenuKey(event)) return;
          event.preventDefault();
          onOpenContextMenu(targetFromKeyboard(event, folder.path, folderLabel));
        }}
      >
        <span className="workspace-folder-caret" aria-hidden="true">
          {isOpen ? "⌄" : "›"}
        </span>
        <span className="workspace-folder-icon" aria-hidden="true">
          ▱
        </span>
        <span className="workspace-folder-name">{folder.name}</span>
        <small>{folder.fileCount > 0 ? folder.fileCount : "空"}</small>
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
              onOpenContextMenu={onOpenContextMenu}
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
              onOpenContextMenu={onOpenContextMenu}
            />
          ))}
        </>
      )}
    </div>
  );
}

export function WorkspaceTreeView({
  files,
  folders = [],
  activePath,
  onOpenFile,
  onCreateNote,
  onCreateFolder,
}: WorkspaceTreeProps) {
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => new Set());
  const [contextMenu, setContextMenu] = useState<WorkspaceTreeContextTarget | null>(null);
  const tree = useMemo(() => buildWorkspaceTree(files, folders), [files, folders]);
  const canManage = Boolean(onCreateNote && onCreateFolder);

  const toggleFolder = (path: string) => {
    setCollapsedFolders((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const openContextMenu = (target: WorkspaceTreeContextTarget) => {
    if (!canManage) return;
    setContextMenu(target);
  };

  return (
    <div
      className="workspace-tree"
      onContextMenu={(event) => {
        if (!canManage || event.target !== event.currentTarget) return;
        event.preventDefault();
        openContextMenu({
          x: event.clientX,
          y: event.clientY,
          parentPath: "",
          label: "阅读库根目录",
        });
      }}
    >
      {tree.files.map((file) => (
        <WorkspaceFileButton
          key={file.path}
          file={file}
          activePath={activePath}
          depth={0}
          onOpenFile={onOpenFile}
          onOpenContextMenu={openContextMenu}
        />
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
          onOpenContextMenu={openContextMenu}
        />
      ))}
      {contextMenu && onCreateNote && onCreateFolder && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          title={`在${contextMenu.label}中新建`}
          ariaLabel="工作区管理菜单"
          groups={[
            {
              label: "工作区",
              items: [
                { id: "new-note", label: "新建笔记", onSelect: () => onCreateNote(contextMenu.parentPath) },
                { id: "new-folder", label: "新建文件夹", onSelect: () => onCreateFolder(contextMenu.parentPath) },
              ],
            },
          ]}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
