import type { ReactNode } from "react";
import { Icon } from "../../shared/components/Icon";
import type { WorkbenchPanes } from "../useWorkbenchPanes";
export function ReaderPaneTools({ panes, children }: { panes: WorkbenchPanes; children?: ReactNode }) {
  return (
    <div className="workbench-document-tools">
      {children}
      <button
        onClick={panes.toggleSplit}
        aria-label={panes.split ? "单窗格" : "双窗格"}
        title={panes.split ? "恢复单窗格" : "并排打开文档"}
        aria-pressed={panes.split}
      >
        <Icon name="split" />
      </button>
      {panes.split && (
        <details className="pane-options">
          <summary aria-label="窗格布局">
            <Icon name="more" />
          </summary>
          <div>
            <button onClick={panes.swap}>交换窗格</button>
            <label className="pane-ratio">
              窗格比例
              <input
                aria-label="左侧窗格宽度"
                type="range"
                min="30"
                max="70"
                value={panes.ratio}
                onChange={(event) => panes.setRatio(Number(event.target.value))}
              />
            </label>
          </div>
        </details>
      )}
    </div>
  );
}
