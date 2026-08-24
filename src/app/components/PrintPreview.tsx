import { useEffect, useRef, useState } from "react";
import type { ExportMargin, ExportOrientation, ExportPaper } from "../types";

type PrintPreviewProps = {
  title: string;
  html: string;
  paper: ExportPaper;
  orientation: ExportOrientation;
  margin: ExportMargin;
  onPrint: () => void | Promise<void>;
  onClose: () => void;
};

function paperLabel(paper: ExportPaper): string {
  return paper === "a4" ? "A4" : "Letter";
}

function orientationLabel(orientation: ExportOrientation): string {
  return orientation === "portrait" ? "纵向" : "横向";
}

function marginLabel(margin: ExportMargin): string {
  return margin === "compact" ? "紧凑页边距" : margin === "wide" ? "宽松页边距" : "标准页边距";
}

export function PrintPreview({ title, html, paper, orientation, margin, onPrint, onClose }: PrintPreviewProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await onPrint();
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div
      className="print-preview-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="print-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="print-preview-title">
        <header className="print-preview-header">
          <div>
            <div className="panel-kicker">PRINT PREVIEW</div>
            <h2 id="print-preview-title">打印版式预览</h2>
            <p title={title}>{title}</p>
          </div>
          <div className="print-preview-actions">
            <button ref={closeButtonRef} type="button" className="quiet-button" onClick={onClose} disabled={printing}>
              关闭
            </button>
            <button
              type="button"
              className="toolbar-button primary"
              onClick={() => void handlePrint()}
              disabled={printing}
            >
              {printing ? "准备打印…" : "打印 / 保存 PDF"}
            </button>
          </div>
        </header>
        <div className="print-preview-stage">
          <iframe
            className="print-preview-frame"
            title={`${title} 打印版式`}
            srcDoc={html}
            sandbox="allow-same-origin"
          />
        </div>
        <footer className="print-preview-footer">
          <span>
            {paperLabel(paper)} · {orientationLabel(orientation)} · {marginLabel(margin)}
          </span>
          <span>预览内容不会修改原文</span>
        </footer>
      </section>
    </div>
  );
}
