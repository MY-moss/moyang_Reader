import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalBehavior } from "../../../shared/components/useModalBehavior";
import type { WorkspaceDirectory } from "../../../shared/types";

export function NewNoteDialog({
  parent,
  folders,
  onCreate,
  onClose,
}: {
  parent: string;
  folders: WorkspaceDirectory[];
  onCreate: (parent: string, name: string) => Promise<void>;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [format, setFormat] = useState("md");
  const [location, setLocation] = useState(parent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useModalBehavior({
    containerRef,
    initialFocusRef: inputRef,
    onClose: () => {
      if (!busy) onClose();
    },
  });
  return createPortal(
    <div className="settings-backdrop">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-note-title"
        className="new-note-dialog"
      >
        <h2 id="new-note-title">新建笔记</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const stem = name.trim().replace(/\.(md|txt)$/i, "");
            if (!stem || /[\\/:*?"<>|]/.test(stem)) {
              setError("请输入不包含路径分隔符的文件名。");
              return;
            }
            setBusy(true);
            setError("");
            void onCreate(location, `${stem}.${format}`).catch((cause) => {
              setError(String(cause));
              setBusy(false);
            });
          }}
        >
          <label>
            名称
            <input
              ref={inputRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="为这份笔记起个名字"
              disabled={busy}
            />
          </label>
          <label>
            保存位置
            <select value={location} onChange={(event) => setLocation(event.target.value)} disabled={busy}>
              <option value="">阅读库根目录</option>
              {folders.map((folder) => (
                <option key={folder.path} value={folder.relativePath}>
                  {folder.relativePath}
                </option>
              ))}
            </select>
          </label>
          <label>
            格式
            <select value={format} onChange={(event) => setFormat(event.target.value)} disabled={busy}>
              <option value="md">Markdown</option>
              <option value="txt">纯文本 TXT</option>
            </select>
          </label>
          {error && <p role="alert">{error}</p>}
          <footer>
            <button type="button" onClick={onClose} disabled={busy}>
              取消
            </button>
            <button className="toolbar-button primary" type="submit" disabled={busy || !name.trim()}>
              {busy ? "正在创建…" : "创建并打开"}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
}
