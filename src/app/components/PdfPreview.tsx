type PdfPreviewProps = {
  name: string;
  src?: string;
};

export function PdfPreview({ name, src }: PdfPreviewProps) {
  if (!src) {
    return (
      <div className="document-fallback" role="alert">
        <strong>PDF 预览不可用</strong>
        <span>请重新选择文件，或使用系统 PDF 阅读器打开。</span>
      </div>
    );
  }

  return (
    <section className="pdf-preview" aria-label={`${name} PDF 预览`}>
      <div className="pdf-toolbar">
        <span>PDF 预览</span>
        <a href={src} target="_blank" rel="noreferrer">
          在新窗口打开
        </a>
      </div>
      <iframe className="pdf-frame" title={name} src={src} />
    </section>
  );
}
