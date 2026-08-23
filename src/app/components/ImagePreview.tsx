type ImagePreviewProps = {
  name: string;
  src?: string;
};

export function ImagePreview({ name, src }: ImagePreviewProps) {
  if (!src) {
    return (
      <div className="document-fallback" role="alert">
        <strong>图片预览不可用</strong>
        <span>请重新选择文件，或检查附件是否仍然存在。</span>
      </div>
    );
  }

  return (
    <section className="image-preview" aria-label={`${name} 图片预览`}>
      <div className="image-toolbar">
        <span>{name}</span>
        <a href={src} target="_blank" rel="noreferrer">在新窗口打开</a>
      </div>
      <div className="image-canvas">
        <img src={src} alt={name} />
      </div>
    </section>
  );
}
