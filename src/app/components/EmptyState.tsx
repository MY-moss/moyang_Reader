type EmptyStateProps = {
  onOpen: () => void;
};

export function EmptyState({ onOpen }: EmptyStateProps) {
  return (
    <section className="empty-state" aria-labelledby="empty-title">
      <div className="empty-eyebrow">READ LOCAL · STAY PORTABLE</div>
      <h1 id="empty-title">把文档打开，专心阅读。</h1>
      <p>
        双击文档即可进入阅读模式。这里先保持安静，编辑、搜索和工作区能力会在需要时出现。
      </p>
      <button type="button" className="empty-action" onClick={onOpen}>
        打开文档
      </button>
      <p className="empty-hint">也可以把 Markdown、Word、PDF 或图片拖到窗口中</p>
    </section>
  );
}
