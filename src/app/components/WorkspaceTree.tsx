import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import type { WorkspaceDirectory, WorkspaceEntryDetails, WorkspaceFile } from "../types";
import {
  buildWorkspaceTree,
  flattenWorkspaceTree,
  getWorkspaceTreeWindow,
  WORKSPACE_TREE_OVERSCAN,
  WORKSPACE_TREE_ROW_HEIGHT,
  type WorkspaceTreeFolder,
  type WorkspaceTreeRow,
} from "../workspace-tree";
import { ContextMenu } from "./ContextMenu";

export type WorkspaceEntryKind = "file" | "folder";
export type WorkspaceEntryTransferMode = "copy" | "move";
export type WorkspaceEntryClipboard = {
  entryPath: string;
  kind: WorkspaceEntryKind;
  mode: WorkspaceEntryTransferMode;
  label: string;
};

type WorkspaceTreeContextTarget = {
  x: number;
  y: number;
  parentPath: string;
  label: string;
  entryPath: string;
  entryKind: "root" | WorkspaceEntryKind;
  filePath?: string;
  details?: WorkspaceEntryDetails;
  restoreFocusTarget?: HTMLElement | null;
  fallbackFocusTarget?: HTMLElement | null;
};

type WorkspaceTreeProps = {
  files: WorkspaceFile[];
  folders?: WorkspaceDirectory[];
  activePath: string | null;
  onOpenFile: (path: string) => void;
  onCloseFile?: (path: string) => void;
  onCreateNote?: (parentPath: string) => void;
  onCreateFolder?: (parentPath: string) => void;
  onRenameEntry?: (entryPath: string, kind: WorkspaceEntryKind) => void;
  onDeleteEntry?: (entryPath: string, kind: WorkspaceEntryKind) => void;
  onDuplicateEntry?: (entryPath: string, kind: WorkspaceEntryKind) => void;
  onShowDetails?: (details: WorkspaceEntryDetails) => void;
  onRevealEntry?: (entryPath: string) => void;
  onCopyPath?: (entryPath: string) => void;
  onCopyRelativePath?: (entryPath: string) => void;
  onCopyName?: (entryPath: string) => void;
  onRefresh?: (entryPath: string) => void;
  onTransferEntry?: (
    sourcePath: string,
    destinationParentPath: string,
    mode: WorkspaceEntryTransferMode,
    kind: WorkspaceEntryKind,
  ) => boolean | Promise<boolean>;
  onStatusMessage?: (message: string) => void;
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

function normalizeRelativePath(path: string): string {
  return path
    .replace(/[\\/]+/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}

function isRelativePathWithin(parentPath: string, candidatePath: string): boolean {
  const parent = normalizeRelativePath(parentPath);
  const candidate = normalizeRelativePath(candidatePath);
  return Boolean(parent) && (candidate === parent || candidate.startsWith(`${parent}/`));
}

function canPasteClipboard(clipboard: WorkspaceEntryClipboard, destinationParentPath: string): boolean {
  const source = normalizeRelativePath(clipboard.entryPath);
  const destination = normalizeRelativePath(destinationParentPath);
  const sourceParent = normalizeRelativePath(parentRelativePath(clipboard.entryPath));
  if (!source || sourceParent === destination) return false;
  if (clipboard.kind === "folder" && (source === destination || isRelativePathWithin(source, destination))) {
    return false;
  }
  return true;
}

function findScrollParent(element: HTMLElement): HTMLElement | Window {
  let parent = element.parentElement;
  while (parent) {
    const overflowY = window.getComputedStyle(parent).overflowY;
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") return parent;
    parent = parent.parentElement;
  }
  return window;
}

function useWorkspaceTreeWindow(treeRef: RefObject<HTMLDivElement>, rowCount: number) {
  const [treeWindow, setTreeWindow] = useState(() =>
    getWorkspaceTreeWindow(rowCount, 0, 600, WORKSPACE_TREE_ROW_HEIGHT, WORKSPACE_TREE_OVERSCAN),
  );

  useEffect(() => {
    const treeElement = treeRef.current;
    if (!treeElement) return;

    const scrollParent = findScrollParent(treeElement);
    let frame: number | null = null;
    const measure = () => {
      frame = null;
      const treeRect = treeElement.getBoundingClientRect();
      if (treeRect.height === 0) {
        setTreeWindow(
          getWorkspaceTreeWindow(
            rowCount,
            0,
            rowCount <= 200 ? 0 : 600,
            WORKSPACE_TREE_ROW_HEIGHT,
            WORKSPACE_TREE_OVERSCAN,
          ),
        );
        return;
      }

      let metrics: { scrollTop: number; viewportHeight: number; treeTop: number };
      if (scrollParent instanceof HTMLElement) {
        const parentRect = scrollParent.getBoundingClientRect();
        const scrollTop = scrollParent.scrollTop;
        metrics = {
          scrollTop,
          viewportHeight: scrollParent.clientHeight,
          treeTop: treeRect.top - parentRect.top + scrollTop,
        };
      } else {
        const scrollTop = window.scrollY;
        metrics = {
          scrollTop,
          viewportHeight: window.innerHeight,
          treeTop: treeRect.top + scrollTop,
        };
      }

      const { scrollTop, viewportHeight, treeTop } = metrics;
      if (viewportHeight <= 0) {
        setTreeWindow({ start: 0, end: rowCount });
        return;
      }

      setTreeWindow(
        getWorkspaceTreeWindow(
          rowCount,
          scrollTop - treeTop,
          viewportHeight,
          WORKSPACE_TREE_ROW_HEIGHT,
          WORKSPACE_TREE_OVERSCAN,
        ),
      );
    };
    const scheduleMeasure = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(measure);
    };

    scrollParent.addEventListener("scroll", scheduleMeasure, { passive: true });
    window.addEventListener("resize", scheduleMeasure);
    scheduleMeasure();
    return () => {
      scrollParent.removeEventListener("scroll", scheduleMeasure);
      window.removeEventListener("resize", scheduleMeasure);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [rowCount, treeRef]);

  return treeWindow;
}

function workspaceTreeRowKey(row: WorkspaceTreeRow): string {
  return `${row.kind}:${row.kind === "file" ? row.file.path : row.folder.path}`;
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
    restoreFocusTarget: event.currentTarget,
    fallbackFocusTarget: event.currentTarget.closest<HTMLElement>(".workspace-tree"),
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
          restoreFocusTarget: event.currentTarget,
          fallbackFocusTarget: event.currentTarget.closest<HTMLElement>(".workspace-tree"),
          parentPath,
          label: `“${file.relativePath}”`,
          entryPath: file.relativePath,
          entryKind: "file",
          filePath: file.path,
          details: {
            kind: "file",
            name: file.name,
            relativePath: file.relativePath,
            absolutePath: file.path,
            documentKind: file.kind,
            size: file.size,
          },
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
            details: {
              kind: "file",
              name: file.name,
              relativePath: file.relativePath,
              absolutePath: file.path,
              documentKind: file.kind,
              size: file.size,
            },
          }),
        );
      }}
    >
      <span>{file.name}</span>
      {depth === 0 && file.relativePath !== file.name && <small>{file.relativePath}</small>}
    </button>
  );
}

type WorkspaceFolderButtonProps = {
  folder: WorkspaceTreeFolder;
  depth: number;
  isOpen: boolean;
  onToggleFolder: (path: string) => void;
  onOpenContextMenu: (target: WorkspaceTreeContextTarget) => void;
};

function WorkspaceFolderButton({
  folder,
  depth,
  isOpen,
  onToggleFolder,
  onOpenContextMenu,
}: WorkspaceFolderButtonProps) {
  const folderLabel = `“${folder.path}”`;

  return (
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
          restoreFocusTarget: event.currentTarget,
          fallbackFocusTarget: event.currentTarget.closest<HTMLElement>(".workspace-tree"),
          parentPath: folder.path,
          label: folderLabel,
          entryPath: folder.path,
          entryKind: "folder",
          details: {
            kind: "folder",
            name: folder.name,
            relativePath: folder.path,
            fileCount: folder.fileCount,
          },
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
            details: {
              kind: "folder",
              name: folder.name,
              relativePath: folder.path,
              fileCount: folder.fileCount,
            },
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
  );
}

export function WorkspaceTreeView({
  files,
  folders = [],
  activePath,
  onOpenFile,
  onCloseFile,
  onCreateNote,
  onCreateFolder,
  onRenameEntry,
  onDeleteEntry,
  onDuplicateEntry,
  onShowDetails,
  onRevealEntry,
  onCopyPath,
  onCopyRelativePath,
  onCopyName,
  onRefresh,
  onTransferEntry,
  onStatusMessage,
}: WorkspaceTreeProps) {
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => new Set());
  const [contextMenu, setContextMenu] = useState<WorkspaceTreeContextTarget | null>(null);
  const [clipboard, setClipboard] = useState<WorkspaceEntryClipboard | null>(null);
  const tree = useMemo(() => buildWorkspaceTree(files, folders), [files, folders]);
  const rows = useMemo(() => flattenWorkspaceTree(tree, collapsedFolders), [tree, collapsedFolders]);
  const treeRef = useRef<HTMLDivElement>(null);
  const treeWindow = useWorkspaceTreeWindow(treeRef, rows.length);

  useEffect(() => {
    if (!clipboard) return;
    const normalizedPath = normalizeRelativePath(clipboard.entryPath);
    const exists =
      clipboard.kind === "folder"
        ? folders.some((folder) => normalizeRelativePath(folder.relativePath) === normalizedPath)
        : files.some((file) => normalizeRelativePath(file.relativePath) === normalizedPath);
    if (!exists) setClipboard(null);
  }, [clipboard, files, folders]);
  const canManage = Boolean(
    onCreateNote ||
    onCreateFolder ||
    onRenameEntry ||
    onDeleteEntry ||
    onDuplicateEntry ||
    onShowDetails ||
    onRevealEntry ||
    onCopyPath ||
    onCopyRelativePath ||
    onCopyName ||
    onRefresh ||
    onTransferEntry,
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

  const setEntryClipboard = (mode: WorkspaceEntryTransferMode) => {
    if (!contextMenu || !isWorkspaceEntryKind(contextMenu.entryKind)) return;
    setClipboard({
      entryPath: contextMenu.entryPath,
      kind: contextMenu.entryKind,
      mode,
      label: contextMenu.label,
    });
    onStatusMessage?.(
      `已${mode === "move" ? "剪切" : "复制"}${contextMenu.entryKind === "folder" ? "文件夹" : "文件"}，请在目标文件夹上右键粘贴。`,
    );
  };

  const pasteClipboard = async (destinationParentPath: string) => {
    const pending = clipboard;
    if (!pending || !onTransferEntry || !canPasteClipboard(pending, destinationParentPath)) return;
    setContextMenu(null);
    let completed = false;
    try {
      completed =
        (await onTransferEntry(pending.entryPath, destinationParentPath, pending.mode, pending.kind)) !== false;
    } catch {
      onStatusMessage?.("粘贴失败，请检查目标文件夹后重试。");
    }
    if (completed) {
      if (pending.mode === "move") setClipboard(null);
      onStatusMessage?.(`${pending.mode === "move" ? "移动" : "复制"}完成：${pending.label}`);
    }
  };

  return (
    <div
      ref={treeRef}
      className="workspace-tree"
      style={{ height: `${rows.length * WORKSPACE_TREE_ROW_HEIGHT}px` }}
      tabIndex={-1}
      onContextMenu={(event) => {
        if (!canManage || event.target !== event.currentTarget) return;
        event.preventDefault();
        openContextMenu({
          x: event.clientX,
          y: event.clientY,
          restoreFocusTarget: event.currentTarget,
          fallbackFocusTarget: event.currentTarget,
          parentPath: "",
          label: "阅读库根目录",
          entryPath: "",
          entryKind: "root",
        });
      }}
    >
      {rows.slice(treeWindow.start, treeWindow.end).map((row, offset) => {
        const index = treeWindow.start + offset;
        return (
          <div
            className="workspace-tree-row"
            key={workspaceTreeRowKey(row)}
            style={{ top: `${index * WORKSPACE_TREE_ROW_HEIGHT}px` }}
          >
            {row.kind === "file" ? (
              <WorkspaceFileButton
                file={row.file}
                activePath={activePath}
                depth={row.depth}
                onOpenFile={onOpenFile}
                onOpenContextMenu={openContextMenu}
              />
            ) : (
              <WorkspaceFolderButton
                folder={row.folder}
                depth={row.depth}
                isOpen={row.expanded}
                onToggleFolder={toggleFolder}
                onOpenContextMenu={openContextMenu}
              />
            )}
          </div>
        );
      })}
      {contextMenu && canManage && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          title={contextMenu.entryKind === "root" ? "阅读库根目录" : contextMenu.label}
          ariaLabel="工作区管理菜单"
          groups={[
            ...(contextMenu.entryKind !== "file" && clipboard && onTransferEntry
              ? [
                  {
                    label: "剪贴板",
                    items: [
                      {
                        id: "paste-entry",
                        label: "粘贴到此处",
                        shortcut: "Ctrl V",
                        disabled: !canPasteClipboard(clipboard, contextMenu.entryPath),
                        onSelect: () => void pasteClipboard(contextMenu.entryPath),
                      },
                    ],
                  },
                ]
              : []),
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
            ...(contextMenu.entryKind === "file" && contextMenu.filePath === activePath && onCloseFile
              ? [
                  {
                    label: "标签页",
                    items: [
                      {
                        id: "close-file-tab",
                        label: "关闭当前标签",
                        onSelect: () => onCloseFile(contextMenu.filePath as string),
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
            ...(contextMenu.entryKind !== "root" &&
            (onRenameEntry || onDeleteEntry || onDuplicateEntry || onTransferEntry)
              ? [
                  {
                    label: "管理",
                    items: [
                      ...(onTransferEntry
                        ? [
                            {
                              id: "cut-entry",
                              label: "剪切到其他文件夹",
                              shortcut: "Ctrl X",
                              onSelect: () => setEntryClipboard("move"),
                            },
                            {
                              id: "copy-entry-to-folder",
                              label: "复制到其他文件夹",
                              shortcut: "Ctrl C",
                              onSelect: () => setEntryClipboard("copy"),
                            },
                          ]
                        : []),
                      ...(onDuplicateEntry
                        ? [
                            {
                              id: "duplicate-entry",
                              label: contextMenu.entryKind === "folder" ? "复制文件夹" : "复制文件",
                              onSelect: () => {
                                if (isWorkspaceEntryKind(contextMenu.entryKind)) {
                                  onDuplicateEntry(contextMenu.entryPath, contextMenu.entryKind);
                                }
                              },
                            },
                          ]
                        : []),
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
            ...(contextMenu.entryKind !== "root" && contextMenu.details && onShowDetails
              ? [
                  {
                    label: "信息",
                    items: [
                      {
                        id: "show-entry-details",
                        label: "查看属性",
                        onSelect: () => onShowDetails(contextMenu.details as WorkspaceEntryDetails),
                      },
                    ],
                  },
                ]
              : []),
            ...(contextMenu.entryKind === "folder"
              ? [
                  {
                    label: "视图",
                    items: [
                      {
                        id: "toggle-folder",
                        label: collapsedFolders.has(contextMenu.entryPath) ? "展开文件夹" : "折叠文件夹",
                        onSelect: () => toggleFolder(contextMenu.entryPath),
                      },
                    ],
                  },
                ]
              : []),
            ...(onRevealEntry || onCopyPath || onCopyRelativePath || onCopyName
              ? [
                  {
                    label: "路径",
                    items: [
                      ...(contextMenu.entryKind !== "root" && onCopyName
                        ? [
                            {
                              id: "copy-entry-name",
                              label: "复制名称",
                              onSelect: () => onCopyName(contextMenu.entryPath),
                            },
                          ]
                        : []),
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
                      ...(contextMenu.entryKind !== "root" && onCopyRelativePath
                        ? [
                            {
                              id: "copy-relative-entry-path",
                              label: "复制相对路径",
                              onSelect: () => onCopyRelativePath(contextMenu.entryPath),
                            },
                          ]
                        : []),
                    ],
                  },
                ]
              : []),
            ...(onRefresh
              ? [
                  {
                    label: "同步",
                    items: [
                      {
                        id: "refresh-entry",
                        label:
                          contextMenu.entryKind === "root"
                            ? "刷新阅读库"
                            : contextMenu.entryKind === "folder"
                              ? "刷新文件夹"
                              : "刷新所在文件夹",
                        onSelect: () =>
                          onRefresh(contextMenu.entryKind === "file" ? contextMenu.parentPath : contextMenu.entryPath),
                      },
                    ],
                  },
                ]
              : []),
          ]}
          restoreFocusTarget={contextMenu.restoreFocusTarget}
          fallbackFocusTarget={contextMenu.fallbackFocusTarget}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
