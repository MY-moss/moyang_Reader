import { useMemo, useState, type KeyboardEvent } from "react";
import type { WorkspaceDirectory, WorkspaceFile } from "../types";
import { buildWorkspaceTree, type WorkspaceTreeFolder } from "../workspace-tree";
import { ContextMenu } from "./ContextMenu";

export type WorkspaceEntryKind = "file" | "folder";

type WorkspaceTreeContextTarget = {
  x: number;
  y: number;
  parentPath: string;
  label: string;
  entryPath: string;
  entryKind: "root" | WorkspaceEntryKind;
  filePath?: string;
};

type WorkspaceTreeProps = {
  files: WorkspaceFile[];
  folders?: WorkspaceDirectory[];
  activePath: string | null;
  onOpenFile: (path: string) => void;
  onCreateNote?: (parentPath: string) => void;
  onCreateFolder?: (parentPath: string) => void;
  onRenameEntry?: (entryPath: string, kind: WorkspaceEntryKind) => void;
  onDeleteEntry?: (entryPath: string, kind: WorkspaceEntryKind) => void;
  onRevealEntry?: (entryPath: string) => void;
  onCopyPath?: (entryPath: string) => void;
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

function isWorkspaceEntryKind(kind: WorkspaceTreeContextTarget["entryKind"]): kind is WorkspaceEntryKind {
  return kind !== "root";
}

function targetFromKeyboard(
  event: KeyboardEvent<HTMLButtonElement>,
  details: Omit<WorkspaceTreeContextTarget, "x" | "y">,
): WorkspaceTreeContextTarget {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: rect.left + Math.min(32, rect.width / 2),
    y: rect.bottom,
    ...details,
  };
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
        onOpenContextMenu({
          x: event.clientX,
          y: event.clientY,
          parentPath,
          label: `“${file.relativePath}”`,
          entryPath: file.relativePath,
          entryKind: "file",
          filePath: file.path,
        });
      }}
      onKeyDown={(event) => {
        if (!isContextMenuKey(event)) return;
        event.preventDefault();
        onOpenContextMenu(
          targetFromKeyboard(event, {
            parentPath,
            label: `“${file.relativePath}”`,
            entryPath: file.relativePath,
            entryKind: "file",
            filePath: file.path,
          }),
        );
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
  onRenameEntry?: (entryPath: string, kind: WorkspaceEntryKind) => void;
  onDeleteEntry?: (entryPath: string, kind: WorkspaceEntryKind) => void;
  onRevealEntry?: (entryPath: string) => void;
  onCopyPath?: (entryPath: string) => void;
};

function WorkspaceFolder({
  folder,
  depth,
  collapsedFolders,
  onToggleFolder,
  activePath,
  onOpenFile,
  onOpenContextMenu,
  onRenameEntry,
  onDeleteEntry,
  onRevealEntry,
  onCopyPath,
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
          onOpenContextMenu({
            x: event.clientX,
            y: event.clientY,
            parentPath: folder.path,
            label: folderLabel,
            entryPath: folder.path,
            entryKind: "folder",
          });
        }}
        onKeyDown={(event) => {
          if (!isContextMenuKey(event)) return;
          event.preventDefault();
          onOpenContextMenu(
            targetFromKeyboard(event, {
              parentPath: folder.path,
              label: folderLabel,
              entryPath: folder.path,
              entryKind: "folder",
            }),
          );
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
              onRenameEntry={onRenameEntry}
              onDeleteEntry={onDeleteEntry}
              onRevealEntry={onRevealEntry}
              onCopyPath={onCopyPath}
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
  onRenameEntry,
  onDeleteEntry,
  onRevealEntry,
  onCopyPath,
}: WorkspaceTreeProps) {
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => new Set());
  const [contextMenu, setContextMenu] = useState<WorkspaceTreeContextTarget | null>(null);
  const tree = useMemo(() => buildWorkspaceTree(files, folders), [files, folders]);
  const canManage = Boolean(
    onCreateNote || onCreateFolder || onRenameEntry || onDeleteEntry || onRevealEntry || onCopyPath,
  );

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
          entryPath: "",
          entryKind: "root",
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
          onRenameEntry={onRenameEntry}
          onDeleteEntry={onDeleteEntry}
          onRevealEntry={onRevealEntry}
          onCopyPath={onCopyPath}
        />
      ))}
      {contextMenu && canManage && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          title={contextMenu.entryKind === "root" ? "阅读库根目录" : contextMenu.label}
          ariaLabel="工作区管理菜单"
          groups={[
            ...(contextMenu.entryKind === "file"
              ? [
                  {
                    label: "打开",
                    items: [
                      {
                        id: "open-file",
                        label: "打开文件",
                        onSelect: () => contextMenu.filePath && onOpenFile(contextMenu.filePath),
                      },
                    ],
                  },
                ]
              : []),
            ...(onCreateNote || onCreateFolder
              ? [
                  {
                    label: "新建",
                    items: [
                      ...(onCreateNote
                        ? [
                            {
                              id: "new-note",
                              label: contextMenu.entryKind === "file" ? "在所在文件夹中新建笔记" : "新建笔记",
                              onSelect: () => onCreateNote(contextMenu.parentPath),
                            },
                          ]
                        : []),
                      ...(onCreateFolder
                        ? [
                            {
                              id: "new-folder",
                              label: contextMenu.entryKind === "file" ? "在所在文件夹中新建文件夹" : "新建文件夹",
                              onSelect: () => onCreateFolder(contextMenu.parentPath),
                            },
                          ]
                        : []),
                    ],
                  },
                ]
              : []),
            ...(contextMenu.entryKind !== "root" && (onRenameEntry || onDeleteEntry)
              ? [
                  {
                    label: "管理",
                    items: [
                      ...(onRenameEntry
                        ? [
                            {
                              id: "rename-entry",
                              label: contextMenu.entryKind === "folder" ? "重命名文件夹" : "重命名文件",
                              onSelect: () => {
                                if (isWorkspaceEntryKind(contextMenu.entryKind)) {
                                  onRenameEntry(contextMenu.entryPath, contextMenu.entryKind);
                                }
                              },
                            },
                          ]
                        : []),
                      ...(onDeleteEntry
                        ? [
                            {
                              id: "delete-entry",
                              label: contextMenu.entryKind === "folder" ? "删除文件夹及内容" : "删除文件",
                              tone: "danger" as const,
                              onSelect: () => {
                                if (isWorkspaceEntryKind(contextMenu.entryKind)) {
                                  onDeleteEntry(contextMenu.entryPath, contextMenu.entryKind);
                                }
                              },
                            },
                          ]
                        : []),
                    ],
                  },
                ]
              : []),
            ...(onRevealEntry || onCopyPath
              ? [
                  {
                    label: "路径",
                    items: [
                      ...(onRevealEntry
                        ? [
                            {
                              id: "reveal-entry",
                              label: contextMenu.entryKind === "file" ? "在资源管理器中显示" : "在资源管理器中打开",
                              onSelect: () => onRevealEntry(contextMenu.entryPath),
                            },
                          ]
                        : []),
                      ...(onCopyPath
                        ? [
                            {
                              id: "copy-entry-path",
                              label: "复制完整路径",
                              onSelect: () => onCopyPath(contextMenu.entryPath),
                            },
                          ]
                        : []),
                    ],
                  },
                ]
              : []),
          ]}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
