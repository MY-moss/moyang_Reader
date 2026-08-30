import type { FileDropState } from "../file-drop";

type FileDropOverlayProps = {
  state: FileDropState;
};

const messages = {
  supported: {
    title: "松开即可打开",
    detail: "支持 Markdown、文本、Word、PDF 和图片",
  },
  mixed: {
    title: "松开即可打开可识别文件",
    detail: "不支持的文件会被跳过，并给出说明",
  },
  unsupported: {
    title: "暂不支持这类文件",
    detail: "请拖入 Markdown、文本、Word、PDF 或图片",
  },
  unknown: {
    title: "拖到这里即可打开",
    detail: "支持文件和阅读库",
  },
} as const;

export function FileDropOverlay({ state }: FileDropOverlayProps) {
  if (!state.active) return null;

  const message = messages[state.support];
  return (
    <div
      className={`file-drop-overlay file-drop-overlay-${state.support}`}
      data-testid="file-drop-overlay"
      data-drop-source={state.source}
      data-drop-support={state.support}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="file-drop-card">
        <span className="file-drop-glyph" aria-hidden="true">
          ↓
        </span>
        <div>
          <strong>{message.title}</strong>
          <span>{message.detail}</span>
        </div>
      </div>
    </div>
  );
}
