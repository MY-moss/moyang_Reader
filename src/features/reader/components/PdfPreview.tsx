import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";

type PdfPreviewProps = {
  name: string;
  src?: string;
  page?: number;
  onPageChange?: (page: number) => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
};
export function PdfPreview({
  name,
  src,
  page: requestedPage = 1,
  onPageChange,
  zoom: requestedZoom = 100,
  onZoomChange,
}: PdfPreviewProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(requestedPage);
  const [zoom, setZoom] = useState(requestedZoom);
  const [pageInput, setPageInput] = useState(String(requestedPage));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [width, setWidth] = useState(800);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setPage(requestedPage);
  }, [requestedPage]);
  useEffect(() => {
    setPageInput(String(page));
  }, [page]);
  useEffect(() => {
    setZoom(requestedZoom);
  }, [requestedZoom]);
  useEffect(() => {
    if (!src) {
      setError("PDF 地址已失效，请重新打开文件。");
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    setPdf(null);
    let task: PDFDocumentLoadingTask | undefined;
    void import("../../documents/pdf")
      .then(({ loadPdf }) => {
        if (!active) return;
        task = loadPdf(src);
        return task.promise.then((document) => {
          if (active) {
            setPdf(document);
            setPage((current) => Math.min(Math.max(1, current), document.numPages));
          }
        });
      })
      .catch((cause) => {
        if (active) {
          setError(String(cause));
          setLoading(false);
        }
      });
    return () => {
      active = false;
      void task?.destroy();
    };
  }, [src]);
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const resize = new ResizeObserver(([entry]) => setWidth(Math.max(200, entry.contentRect.width - 32)));
    resize.observe(element);
    return () => resize.disconnect();
  }, []);
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let active = true;
    let render: RenderTask | undefined;
    setLoading(true);
    setError("");
    void (async () => {
      const documentPage = await pdf.getPage(Math.max(1, Math.min(pdf.numPages, page)));
      if (!active || !canvas.current) return;
      const normal = documentPage.getViewport({ scale: 1 });
      const viewport = documentPage.getViewport({ scale: ((Math.min(width, 1100) / normal.width) * zoom) / 100 });
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const element = canvas.current;
      element.width = Math.floor(viewport.width * pixelRatio);
      element.height = Math.floor(viewport.height * pixelRatio);
      element.style.width = viewport.width + "px";
      element.style.height = viewport.height + "px";
      render = documentPage.render({ canvas: element, viewport, transform: [pixelRatio, 0, 0, pixelRatio, 0, 0] });
      await render.promise;
      if (active) setLoading(false);
    })().catch((cause) => {
      if (active && cause?.name !== "RenderingCancelledException") {
        setError(String(cause));
        setLoading(false);
      }
    });
    return () => {
      active = false;
      render?.cancel();
    };
  }, [pdf, page, width, zoom]);
  const go = (next: number) => {
    const value = Math.max(1, Math.min(pdf?.numPages ?? 1, Math.trunc(next) || 1));
    setPage(value);
    setPageInput(String(value));
    onPageChange?.(value);
  };
  return (
    <section className="pdf-preview controlled-pdf" aria-label={name + " PDF 预览"}>
      <div className="pdf-toolbar">
        <button disabled={page <= 1 || !pdf} onClick={() => go(page - 1)}>
          上一页
        </button>
        <label>
          页码{" "}
          <input
            aria-label="PDF 页码"
            type="number"
            min="1"
            max={pdf?.numPages ?? 1}
            value={pageInput}
            onChange={(event) => setPageInput(event.target.value)}
            onBlur={() => go(Number(pageInput))}
            onKeyDown={(event) => {
              if (event.key === "Enter") go(Number(pageInput));
            }}
          />
        </label>
        <span>/ {pdf?.numPages ?? "…"}</span>
        <button disabled={!pdf || page >= pdf.numPages} onClick={() => go(page + 1)}>
          下一页
        </button>
        <select
          aria-label="PDF 缩放"
          value={zoom}
          onChange={(event) => {
            const value = Number(event.target.value);
            setZoom(value);
            onZoomChange?.(value);
          }}
        >
          {[75, 100, 125, 150, 200].map((value) => (
            <option key={value} value={value}>
              {value}%
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p className="error-state" role="alert">
          {error}
        </p>
      )}
      <div className="pdf-canvas-stage" ref={stage} aria-busy={loading}>
        {loading && (
          <span className="pdf-progress" role="status">
            正在显示页面…
          </span>
        )}
        <canvas ref={canvas} aria-label={name + "，第 " + page + " 页"} />
      </div>
    </section>
  );
}
