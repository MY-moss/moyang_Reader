type EmptyStateProps = {
  onOpen: () => void;
  onChooseWorkspace: () => void;
  hasWorkspace: boolean;
  showWorkspaceAction: boolean;
};

export function EmptyState({ onOpen, onChooseWorkspace, hasWorkspace, showWorkspaceAction }: EmptyStateProps) {
  return (
    <section className="empty-state" aria-labelledby="empty-title">
      <div className="empty-mark" aria-hidden="true">
        <span>M</span>
        <i />
      </div>
      <div className="empty-eyebrow">{hasWorkspace ? "READING LIBRARY" : "READ LOCAL · STAY PORTABLE"}</div>
      <h1 id="empty-title">{hasWorkspace ? "从阅读库开始阅读。" : "把文档打开，专心阅读。"}</h1>
      <p>
        {hasWorkspace
          ? "从左侧文件树选择文档，或按 Ctrl+P 快速打开。"
          : "双击文档即可进入阅读模式。这里先保持安静，编辑、搜索和工作区能力会在需要时出现。"}
      </p>
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
        {showWorkspaceAction && (
          <button type="button" className="empty-action secondary" onClick={onChooseWorkspace}>
            添加整个文件夹
          </button>
        )}
      </div>
      <p className="empty-hint">
        {hasWorkspace ? "也可以把文档拖到窗口中" : "桌面版还可以把文档或整个文件夹拖到窗口中"}
      </p>
    </section>
  );
}
