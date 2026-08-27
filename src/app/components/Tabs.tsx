import { useState, type DragEvent as ReactDragEvent } from "react";
import type { RecentFile } from "../types";

type TabsProps = {
  tabs: RecentFile[];
  activePath: string | null;
  externallyModified: boolean;
  onShowExternalChange: () => void;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onReorder: (sourcePath: string, targetPath: string) => void;
};

export function Tabs({
  tabs,
  activePath,
  externallyModified,
  onShowExternalChange,
  onSelect,
  onClose,
  onReorder,
}: TabsProps) {
  const [draggedPath, setDraggedPath] = useState<string | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);

  if (tabs.length === 0) return null;

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
    </div>
  );
}
