type EmptyStateProps = {
  onOpen: () => void;
  onChooseWorkspace: () => void;
};

export function EmptyState({ onOpen, onChooseWorkspace }: EmptyStateProps) {
  return (
    <section className="empty-state" aria-labelledby="empty-title">
      <div className="empty-mark" aria-hidden="true">
        <span>M</span>
        <i />
      </div>
      <div className="empty-eyebrow">READ LOCAL · STAY PORTABLE</div>
      <h1 id="empty-title">把文档打开，专心阅读。</h1>
      <p>双击文档即可进入阅读模式。这里先保持安静，编辑、搜索和工作区能力会在需要时出现。</p>
      <div className="empty-capabilities" aria-label="支持的文档类型">
        <span>MARKDOWN</span>
        <span>WORD</span>
        <span>PDF</span>
        <span>IMAGE</span>
      </div>
      <div className="empty-actions">
        <button type="button" className="empty-action" onClick={onOpen}>
          打开文档
        </button>
        <button type="button" className="empty-action secondary" onClick={onChooseWorkspace}>
          添加整个文件夹
        </button>
      </div>
      <p className="empty-hint">也可以把 Markdown、Word、PDF 或图片拖到窗口中</p>
    </section>
  );
}
