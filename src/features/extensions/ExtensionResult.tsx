import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalBehavior } from "../../shared/components/useModalBehavior";
import type { ExtensionFinding, ExtensionOutput } from "../../shared/extension-types";
import { Icon } from "../../shared/components/Icon";

type Result = {
  name: string;
  path: string;
  original: string;
  result?: ExtensionOutput;
  error?: string;
  running: boolean;
};
export function ExtensionResult({
  run,
  onClose,
  onApply,
  onLocate,
}: {
  run: Result;
  onClose: () => void;
  onApply: () => void;
  onLocate?: (finding: ExtensionFinding) => void;
}) {
  const container = useRef<HTMLElement>(null),
    close = useRef<HTMLButtonElement>(null);
  useModalBehavior({ containerRef: container, initialFocusRef: close, onClose });
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const report = [
    run.result?.report,
    ...(run.result?.findings ?? []).map(
      (item) => `第 ${item.line} 行 · ${item.label}${item.detail ? `\n${item.detail}` : ""}`,
    ),
  ]
    .filter(Boolean)
    .join("\n\n");
  const save = async (name: string, content: string) => {
    setActionError("");
    setNotice("");
    try {
      const { downloadAi } = await import("../ai/transfers");
      if (await downloadAi(name, new TextEncoder().encode(content), name.endsWith(".md") ? "markdown" : "resource"))
        setNotice(`已导出 ${name}`);
    } catch (error) {
      setActionError(`导出失败：${String(error)}`);
    }
  };
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
        {actionError && <p role="alert">{actionError}</p>}
        {notice && <p role="status">{notice}</p>}
        {run.result?.report && <pre className="extension-report">{run.result.report}</pre>}
        {report && (
          <div className="extension-actions">
            <button
              onClick={async () => {
                setActionError("");
                setNotice("");
                try {
                  await navigator.clipboard.writeText(report);
                  setNotice("报告已复制");
                } catch {
                  setActionError("无法访问剪贴板，请导出报告，或选中文字复制。");
                }
              }}
            >
              <Icon name="copy" />
              复制报告
            </button>
            <button onClick={() => void save("插件报告.md", `# ${run.name}\n\n来源：${run.path}\n\n${report}\n`)}>
              <Icon name="download" />
              导出报告
            </button>
          </div>
        )}
        {!!run.result?.findings?.length && (
          <ol className="extension-findings" aria-label="原文条目">
            {run.result.findings.map((item, index) => (
              <li key={index}>
                <button disabled={!onLocate || !!run.error} onClick={() => onLocate?.(item)}>
                  <span>第 {item.line} 行</span>
                  <strong>{item.label}</strong>
                  {item.detail && <small>{item.detail}</small>}
                </button>
              </li>
            ))}
          </ol>
        )}
        {!!run.result?.files?.length && (
          <section aria-label="可导出文件" className="extension-files">
            <h3>可导出文件</h3>
            {run.result.files.map((file) => (
              <div key={file.name}>
                <details>
                  <summary>{file.name} · 预览</summary>
                  <pre>{file.content.slice(0, 12000)}</pre>
                  {file.content.length > 12000 && <p>预览前 12000 字符，导出包含完整内容。</p>}
                </details>
                <button onClick={() => void save(file.name, file.content)} aria-label={`下载 ${file.name}`}>
                  <Icon name="download" />
                  下载
                </button>
              </div>
            ))}
          </section>
        )}
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
