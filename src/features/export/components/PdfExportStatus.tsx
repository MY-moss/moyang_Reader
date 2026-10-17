import { useEffect, useState } from "react";
import { cancelPdfExport, currentPdfExport } from "../../../platform/bridge";

export function PdfExportStatus() {
  const [job, setJob] = useState(currentPdfExport);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const update = () => {
      setJob(currentPdfExport());
      setCancelling(false);
      setError("");
    };
    window.addEventListener("moyang:pdf-export", update);
    return () => window.removeEventListener("moyang:pdf-export", update);
  }, []);
  if (!job) return null;
  return (
    <aside className="pdf-export-status" aria-label="PDF 导出状态">
      <span role="status">{cancelling ? "正在取消…" : "正在生成 PDF，可继续阅读…"}</span>
      <button
        disabled={cancelling}
        onClick={() => {
          setCancelling(true);
          void cancelPdfExport(job.requestId).catch((e) => {
            setError(String(e));
            setCancelling(false);
          });
        }}
      >
        取消导出
      </button>
      {error && <span role="alert">{error}</span>}
    </aside>
  );
}
