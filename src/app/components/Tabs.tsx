import type { RecentFile } from "../types";

type TabsProps = {
  tabs: RecentFile[];
  activePath: string | null;
  externallyModified: boolean;
  onShowExternalChange: () => void;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
};

export function Tabs({ tabs, activePath, externallyModified, onShowExternalChange, onSelect, onClose }: TabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="tab-strip" role="toolbar" aria-label="已打开文档">
      {tabs.map((tab) => {
        const active = tab.path === activePath;
        return (
          <div className={`tab-item ${active ? "active" : ""}`} key={tab.path}>
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
