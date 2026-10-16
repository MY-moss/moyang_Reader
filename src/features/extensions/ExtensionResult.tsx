import { useRef } from "react";
import { createPortal } from "react-dom";
import { useModalBehavior } from "../../shared/components/useModalBehavior";
import type { ExtensionOutput } from "../../shared/extension-types";

type Result = {
  name: string;
  path: string;
  original: string;
  result?: ExtensionOutput;
  error?: string;
  running: boolean;
};
export function ExtensionResult({ run, onClose, onApply }: { run: Result; onClose: () => void; onApply: () => void }) {
  const container = useRef<HTMLElement>(null),
    close = useRef<HTMLButtonElement>(null);
  useModalBehavior({ containerRef: container, initialFocusRef: close, onClose });
  const changed = run.result?.replacement !== undefined && run.result.replacement !== run.original;
  return createPortal(
    <div className="quick-open-backdrop">
      <section
        ref={container}
        className="extension-result"
        role="dialog"
        aria-modal="true"
        aria-labelledby="extension-result-title"
        tabIndex={-1}
      >
        <header>
          <h2 id="extension-result-title">{run.name}</h2>
          <button ref={close} onClick={onClose}>
            {run.running ? "取消运行" : "关闭"}
          </button>
        </header>
        <p className="extension-path">{run.path}</p>
        {run.running && <p role="status">插件正在处理当前文档…</p>}
        {run.error && <p role="alert">{run.error}</p>}
        {run.result?.report && <pre className="extension-report">{run.result.report}</pre>}
        {changed && (
          <div className="extension-comparison">
            <section>
              <h3>修改前</h3>
              <pre>{run.original}</pre>
            </section>
            <section>
              <h3>插件建议</h3>
              <pre>{run.result?.replacement}</pre>
            </section>
          </div>
        )}
        {run.result?.replacement !== undefined && !changed && <p>内容已经符合规则，无需修改。</p>}
        {changed && (
          <footer>
            <p>采用后沿用当前文档的自动保存与撤销。</p>
            <button className="primary-action" disabled={!!run.error} onClick={onApply}>
              采用修改
            </button>
            <button onClick={onClose}>保留原文</button>
          </footer>
        )}
      </section>
    </div>,
    document.body,
  );
}
