import { useRef } from "react";
import type { DocumentKind, WorkspaceEntryDetails } from "../types";
import { useModalBehavior } from "./useModalBehavior";

type WorkspaceEntryDetailsDialogProps = {
  details: WorkspaceEntryDetails;
  onClose: () => void;
};

function formatSize(size: number | undefined): string {
  if (size === undefined) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function documentKindLabel(kind: DocumentKind | undefined): string {
  switch (kind) {
    case "markdown":
      return "Markdown 文档";
    case "text":
      return "纯文本";
    case "docx":
      return "Word 文档";
    case "pdf":
      return "PDF 文档";
    case "image":
      return "图片";
    default:
      return "文件";
  }
}

export function WorkspaceEntryDetailsDialog({ details, onClose }: WorkspaceEntryDetailsDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useModalBehavior({ containerRef: dialogRef, initialFocusRef: closeButtonRef, onClose });

  const isFolder = details.kind === "folder";

  return (
    <div className="quick-open-backdrop workspace-entry-details-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="quick-open-dialog workspace-entry-details-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-entry-details-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="quick-open-header">
          <div>
            <div className="quick-open-kicker">ENTRY DETAILS</div>
            <h2 id="workspace-entry-details-title">{isFolder ? "文件夹属性" : "文件属性"}</h2>
          </div>
          <button ref={closeButtonRef} type="button" className="quiet-button" onClick={onClose} aria-label="关闭属性">
            关闭
          </button>
        </header>
        <div className="workspace-entry-details-body">
          <dl className="workspace-entry-details-list">
            <div>
              <dt>名称</dt>
              <dd>{details.name}</dd>
            </div>
            <div>
              <dt>类型</dt>
              <dd>{isFolder ? "文件夹" : documentKindLabel(details.documentKind)}</dd>
            </div>
            <div>
              <dt>工作区路径</dt>
              <dd>{details.relativePath || "根目录"}</dd>
            </div>
            <div>
              <dt>完整路径</dt>
              <dd className="workspace-entry-details-path">{details.absolutePath || "—"}</dd>
            </div>
            <div>
              <dt>{isFolder ? "包含文件" : "大小"}</dt>
              <dd>{isFolder ? `${details.fileCount ?? 0} 个` : formatSize(details.size)}</dd>
            </div>
          </dl>
        </div>
        <footer className="quick-open-footer workspace-entry-details-footer">
          <button type="button" className="toolbar-button primary" onClick={onClose}>
            完成
          </button>
        </footer>
      </section>
    </div>
  );
}
