type EmptyStateProps = {
  onOpen: () => void;
  onChooseWorkspace: () => void;
  hasWorkspace: boolean;
  showWorkspaceAction: boolean;
  onOpenGuide: () => void;
};

export function EmptyState({
  onOpen,
  onChooseWorkspace,
  hasWorkspace,
  showWorkspaceAction,
  onOpenGuide,
}: EmptyStateProps) {
  return (
    <section className="empty-state" aria-labelledby="empty-title">
      <div className="welcome-rule" aria-hidden="true" />
      <p className="welcome-label">你的本地书房</p>
      <h1 id="empty-title">{hasWorkspace ? "从阅读库开始阅读。" : "把文档打开，专心阅读。"}</h1>
      <p className="welcome-description">
        {hasWorkspace
          ? "在左侧选择一份文档，或按 Ctrl+P 找到下一篇想读的内容。"
          : "散落在文件夹里的笔记、文章和资料，都可以在这里慢慢读。无需导入，也无需账号。"}
      </p>
      <div className="empty-actions">
        <button type="button" className="empty-action" onClick={onOpen}>
          打开文档
        </button>
        {showWorkspaceAction && (
          <button type="button" className="empty-action secondary" onClick={onChooseWorkspace}>
            添加整个文件夹
          </button>
        )}
      </div>
      <div className="welcome-footer">
        <div className="empty-capabilities" aria-label="支持的文档类型">
          <span>MARKDOWN</span>
          <span>TXT</span>
          <span>WORD</span>
          <span>PDF</span>
          <span>IMAGE</span>
        </div>
        <p className="empty-hint">也可以把文档拖到窗口中，桌面版支持整个文件夹。</p>
        <button type="button" className="welcome-guide" onClick={onOpenGuide}>
          查看使用教程 <span aria-hidden="true">↗</span>
        </button>
      </div>
      <dl className="welcome-shortcuts" aria-label="常用快捷键">
        <div>
          <dt>打开文档</dt>
          <dd>
            <kbd>Ctrl O</kbd>
          </dd>
        </div>
        <div>
          <dt>快速查找</dt>
          <dd>
            <kbd>Ctrl P</kbd>
          </dd>
        </div>
        <div>
          <dt>阅读 / 编辑</dt>
          <dd>
            <kbd>Ctrl E</kbd>
          </dd>
        </div>
      </dl>
    </section>
  );
}
