type ExternalChangeNoticeProps = {
  fileName: string;
  onReload: () => void;
  onOverwrite: () => void;
  onSaveAs: () => void;
  onDismiss: () => void;
};

export function ExternalChangeNotice({
  fileName,
  onReload,
  onOverwrite,
  onSaveAs,
  onDismiss,
}: ExternalChangeNoticeProps) {
  return (
    <div className="external-change-notice" role="alert">
      <span>
        <strong>{fileName}</strong> 已被其他程序修改。当前编辑不会自动覆盖原文件，请选择处理方式。
      </span>
      <div>
        <button type="button" onClick={onReload}>
          重新载入
        </button>
        <button type="button" onClick={onOverwrite}>
          覆盖保存
        </button>
        <button type="button" onClick={onSaveAs}>
          另存为
        </button>
        <button type="button" className="notice-dismiss" onClick={onDismiss}>
          稍后处理
        </button>
      </div>
    </div>
  );
}
