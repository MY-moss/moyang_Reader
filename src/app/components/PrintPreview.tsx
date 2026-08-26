import { useCallback, useEffect, useRef, useState } from "react";
import type { ExportMargin, ExportOrientation, ExportPaper } from "../types";
import { estimatePrintPageCount } from "../print-preview";
import { useModalBehavior } from "./useModalBehavior";

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

type PaginationStatus = "loading" | "ready" | "unavailable";

export function PrintPreview({ title, html, paper, orientation, margin, onPrint, onClose }: PrintPreviewProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [printing, setPrinting] = useState(false);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [paginationStatus, setPaginationStatus] = useState<PaginationStatus>("loading");

  const dialogRef = useRef<HTMLElement>(null);
  useModalBehavior({ containerRef: dialogRef, initialFocusRef: closeButtonRef, onClose });

  const measurePagination = useCallback(() => {
    const previewDocument = frameRef.current?.contentDocument;
    const body = previewDocument?.body;
    const root = previewDocument?.documentElement;
    if (!body || !root) {
      setPageCount(null);
      setPaginationStatus("unavailable");
      return;
    }

    const contentHeight = Math.max(body.scrollHeight, body.offsetHeight, root.scrollHeight, root.offsetHeight);
    const estimate = estimatePrintPageCount(contentHeight, paper, orientation, margin);
    setPageCount(estimate);
    setPaginationStatus(estimate === null ? "unavailable" : "ready");
  }, [margin, orientation, paper]);

  const handleFrameLoad = useCallback(() => {
    window.requestAnimationFrame(() => {
      measurePagination();

      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      const frame = frameRef.current;
      const previewDocument = frame?.contentDocument;
      if (typeof ResizeObserver === "undefined" || !frame || !previewDocument?.documentElement) return;

      const observer = new ResizeObserver(measurePagination);
      observer.observe(frame);
      observer.observe(previewDocument.documentElement);
      resizeObserverRef.current = observer;
    });
  }, [measurePagination]);

  useEffect(() => {
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;
    setPageCount(null);
    setPaginationStatus("loading");

    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
    };
  }, [html, margin, orientation, paper]);

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
      <section
        ref={dialogRef}
        className="print-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-preview-title"
        tabIndex={-1}
      >
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
            ref={frameRef}
            className="print-preview-frame"
            title={`${title} 打印版式`}
            srcDoc={html}
            sandbox="allow-same-origin"
            onLoad={handleFrameLoad}
          />
        </div>
        <footer className="print-preview-footer">
          <div className="print-preview-footer-meta">
            <span>
              {paperLabel(paper)} · {orientationLabel(orientation)} · {marginLabel(margin)}
            </span>
            <span className="print-preview-page-count" role="status" aria-label="打印分页估算">
              {paginationStatus === "loading"
                ? "正在计算分页…"
                : paginationStatus === "ready" && pageCount
                  ? `预计 ${pageCount} 页`
                  : "暂无法估算页数"}
            </span>
          </div>
          <span>预计页数以系统打印对话框为准 · 预览内容不会修改原文</span>
        </footer>
      </section>
    </div>
  );
}
