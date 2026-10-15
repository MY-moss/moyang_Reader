import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { readTextFile } from "../../platform/bridge";
import { useModalBehavior } from "../../shared/components/useModalBehavior";
import type { ReaderApplication } from "../useReaderApplication";

export function ConflictDialog({
  model,
  path,
  onClose,
}: {
  model: ReaderApplication;
  path: string;
  onClose: () => void;
}) {
  const local = model.documentSessions.get(path)?.draft ?? "";
  const base = model.documentSessions.get(path)?.document.source ?? "";
  const [disk, setDisk] = useState<string | null>(null);
  const [merged, setMerged] = useState(local);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const container = useRef<HTMLElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  useModalBehavior({ containerRef: container, initialFocusRef: editor, onClose });
  useEffect(() => {
    let active = true;
    void readTextFile(path)
      .then((value) => {
        if (active) setDisk(value);
      })
      .catch((cause) => {
        if (active) setError(String(cause));
      });
    return () => {
      active = false;
    };
  }, [path]);
  const apply = async () => {
    if (disk === null) return;
    setBusy(true);
    try {
      const latest = await readTextFile(path);
      if (latest !== disk) {
        setDisk(latest);
        setError("比较期间原文件再次变化，已刷新外部内容。你的合并草稿仍在，请再次检查。");
        return;
      }
      model.documentSessions.update(path, (session) => ({
        ...session,
        document: { ...session.document, source: disk, externallyModified: false },
        saveStatus: "idle",
      }));
      model.documentSessions.activate(path);
      model.updateSource(merged);
      model.setExternalChangePath(null);
      model.setMode("source");
      onClose();
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  };
  return createPortal(
    <div className="quick-open-backdrop">
      <section
        ref={container}
        className="conflict-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-title"
        tabIndex={-1}
      >
        <header>
          <h2 id="conflict-title">比较并合并修改</h2>
          <button onClick={onClose}>保留草稿，稍后处理</button>
        </header>
        <p>{path}</p>
        <p>对照两份内容，在下方整理最终版本。采用合并结果后会自动保存；也可以关闭此窗口，另存当前草稿。</p>
        <div className="version-compare">
          <section>
            <h3>你的草稿</h3>
            <pre>{local}</pre>
          </section>
          <section>
            <h3>外部最新内容</h3>
            <pre>{disk ?? "正在读取…"}</pre>
          </section>
        </div>
        <details>
          <summary>修改前的共同版本</summary>
          <pre>{base}</pre>
        </details>
        <div className="conflict-choices">
          <button onClick={() => setMerged(local)}>填入我的版本</button>
          <button disabled={disk === null} onClick={() => setMerged(disk ?? "")}>
            填入外部版本
          </button>
        </div>
        <label>
          合并后的内容
          <textarea ref={editor} value={merged} onChange={(event) => setMerged(event.target.value)} rows={10} />
        </label>
        {error && <p role="alert">{error}</p>}
        <footer>
          <button className="toolbar-button primary" disabled={busy || disk === null} onClick={() => void apply()}>
            {busy ? "正在核对…" : "采用合并结果"}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
