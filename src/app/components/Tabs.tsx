import { useEffect, useState, type DragEvent as ReactDragEvent, type KeyboardEvent } from "react";
import type { RecentFile } from "../types";
import { ContextMenu } from "./ContextMenu";

type TabsProps = {
  tabs: RecentFile[];
  activePath: string | null;
  externallyModified: boolean;
  onShowExternalChange: () => void;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onCloseMany: (paths: string[]) => void;
  onReorder: (sourcePath: string, targetPath: string) => void;
};

export function Tabs({
  tabs,
  activePath,
  externallyModified,
  onShowExternalChange,
  onSelect,
  onClose,
  onCloseMany,
  onReorder,
}: TabsProps) {
  const [draggedPath, setDraggedPath] = useState<string | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null);

  useEffect(() => {
    if (contextMenu && !tabs.some((tab) => tab.path === contextMenu.path)) setContextMenu(null);
  }, [contextMenu, tabs]);

  if (tabs.length === 0) return null;

  const contextIndex = contextMenu ? tabs.findIndex((tab) => tab.path === contextMenu.path) : -1;
  const contextTab = contextIndex >= 0 ? tabs[contextIndex] : null;
  const otherPaths = contextTab ? tabs.filter((tab) => tab.path !== contextTab.path).map((tab) => tab.path) : [];
  const rightPaths = contextIndex >= 0 ? tabs.slice(contextIndex + 1).map((tab) => tab.path) : [];

  const openContextMenu = (path: string, x: number, y: number) => {
    setContextMenu({ path, x, y });
  };

  const isContextMenuKey = (event: KeyboardEvent<HTMLButtonElement>) =>
    event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey);

  return (
    <div className="tab-strip" role="toolbar" aria-label="已打开文档">
      {tabs.map((tab) => {
        const active = tab.path === activePath;
        const isDragging = draggedPath === tab.path;
        const isDragTarget = dragOverPath === tab.path && draggedPath !== tab.path;
        return (
          <div
            className={`tab-item ${active ? "active" : ""}${isDragging ? " is-dragging" : ""}${
              isDragTarget ? " is-drag-target" : ""
            }`}
            key={tab.path}
            draggable={tabs.length > 1}
            onAuxClick={(event) => {
              if (event.button !== 1) return;
              event.preventDefault();
              onClose(tab.path);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openContextMenu(tab.path, event.clientX, event.clientY);
            }}
            onDragStart={(event: ReactDragEvent<HTMLDivElement>) => {
              setDraggedPath(tab.path);
              setDragOverPath(null);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", tab.path);
            }}
            onDragOver={(event: ReactDragEvent<HTMLDivElement>) => {
              if (!draggedPath) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              if (draggedPath !== tab.path) setDragOverPath(tab.path);
            }}
            onDrop={(event: ReactDragEvent<HTMLDivElement>) => {
              if (!draggedPath) return;
              event.preventDefault();
              const sourcePath = event.dataTransfer.getData("text/plain") || draggedPath;
              if (sourcePath && sourcePath !== tab.path) onReorder(sourcePath, tab.path);
              setDraggedPath(null);
              setDragOverPath(null);
            }}
            onDragEnd={() => {
              setDraggedPath(null);
              setDragOverPath(null);
            }}
          >
            <button
              type="button"
              aria-pressed={active}
              className="tab-label"
              title={tab.path}
              onClick={() => {
                onSelect(tab.path);
                if (active && externallyModified) onShowExternalChange();
              }}
              onKeyDown={(event) => {
                if (!isContextMenuKey(event)) return;
                event.preventDefault();
                const rect = event.currentTarget.getBoundingClientRect();
                openContextMenu(tab.path, rect.left + Math.min(28, rect.width / 2), rect.bottom);
              }}
            >
              {tab.name}
              {active && externallyModified && (
                <span className="tab-external-indicator" aria-label="文件已被外部修改">
                  !
                </span>
              )}
            </button>
            <button
              type="button"
              className="tab-close"
              aria-label={`关闭 ${tab.name}`}
              onClick={() => onClose(tab.path)}
            >
              ×
            </button>
          </div>
        );
      })}
      {contextMenu && contextTab && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          title={`标签页“${contextTab.name}”`}
          ariaLabel="标签页管理菜单"
          groups={[
            {
              label: "标签管理",
              items: [
                {
                  id: "close-tab",
                  label: "关闭标签",
                  shortcut: "中键",
                  onSelect: () => onClose(contextTab.path),
                },
                {
                  id: "close-other-tabs",
                  label: "关闭其他标签",
                  disabled: otherPaths.length === 0,
                  onSelect: () => onCloseMany(otherPaths),
                },
                {
                  id: "close-right-tabs",
                  label: "关闭右侧标签",
                  disabled: rightPaths.length === 0,
                  onSelect: () => onCloseMany(rightPaths),
                },
                {
                  id: "close-all-tabs",
                  label: "关闭全部标签",
                  onSelect: () => onCloseMany(tabs.map((item) => item.path)),
                },
              ],
            },
          ]}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
