import { useEffect, useRef, useState, type DragEvent as ReactDragEvent, type KeyboardEvent } from "react";
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
  const [rovingPath, setRovingPath] = useState<string | null>(activePath);
  const tabButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const previousActivePathRef = useRef(activePath);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    path: string;
    restoreFocusTarget: HTMLElement | null;
    fallbackFocusTarget: HTMLElement | null;
  } | null>(null);

  useEffect(() => {
    const activePathChanged = activePath !== previousActivePathRef.current;
    previousActivePathRef.current = activePath;
    const preferredPath =
      activePathChanged && activePath && tabs.some((tab) => tab.path === activePath)
        ? activePath
        : tabs.some((tab) => tab.path === rovingPath)
          ? rovingPath
          : (tabs[0]?.path ?? null);
    if (preferredPath !== rovingPath) setRovingPath(preferredPath);
  }, [activePath, rovingPath, tabs]);

  useEffect(() => {
    if (contextMenu && !tabs.some((tab) => tab.path === contextMenu.path)) setContextMenu(null);
  }, [contextMenu, tabs]);

  if (tabs.length === 0) return null;

  const contextIndex = contextMenu ? tabs.findIndex((tab) => tab.path === contextMenu.path) : -1;
  const contextTab = contextIndex >= 0 ? tabs[contextIndex] : null;
  const otherPaths = contextTab ? tabs.filter((tab) => tab.path !== contextTab.path).map((tab) => tab.path) : [];
  const rightPaths = contextIndex >= 0 ? tabs.slice(contextIndex + 1).map((tab) => tab.path) : [];

  const openContextMenu = (path: string, x: number, y: number, restoreFocusTarget: HTMLElement) => {
    setContextMenu({
      path,
      x,
      y,
      restoreFocusTarget,
      fallbackFocusTarget: restoreFocusTarget.closest<HTMLElement>(".tab-strip"),
    });
  };

  const isContextMenuKey = (event: KeyboardEvent<HTMLButtonElement>) =>
    event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey);
  const rovingTabIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.path === rovingPath),
  );
  const focusTabAt = (index: number) => {
    const nextTab = tabs[index];
    if (!nextTab) return;
    setRovingPath(nextTab.path);
    onSelect(nextTab.path);
    tabButtonRefs.current.get(nextTab.path)?.focus();
  };

  return (
    <div className="tab-strip" role="toolbar" aria-label="已打开文档" aria-orientation="horizontal" tabIndex={-1}>
      {tabs.map((tab, index) => {
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
              openContextMenu(tab.path, event.clientX, event.clientY, event.currentTarget);
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
              tabIndex={index === rovingTabIndex ? 0 : -1}
              className="tab-label"
              title={tab.path}
              ref={(element) => {
                if (element) tabButtonRefs.current.set(tab.path, element);
                else tabButtonRefs.current.delete(tab.path);
              }}
              onClick={() => {
                setRovingPath(tab.path);
                onSelect(tab.path);
                if (active && externallyModified) onShowExternalChange();
              }}
              onKeyDown={(event) => {
                if (isContextMenuKey(event)) {
                  event.preventDefault();
                  const rect = event.currentTarget.getBoundingClientRect();
                  openContextMenu(tab.path, rect.left + Math.min(28, rect.width / 2), rect.bottom, event.currentTarget);
                  return;
                }

                let nextIndex: number | null = null;
                if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
                if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
                if (event.key === "Home") nextIndex = 0;
                if (event.key === "End") nextIndex = tabs.length - 1;
                if (nextIndex === null) return;

                event.preventDefault();
                focusTabAt(nextIndex);
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
          restoreFocusTarget={contextMenu.restoreFocusTarget}
          fallbackFocusTarget={contextMenu.fallbackFocusTarget}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
