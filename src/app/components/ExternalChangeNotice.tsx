type ExternalChangeNoticeProps = {
  fileName: string;
  onReload: () => void;
  onDismiss: () => void;
};

export function ExternalChangeNotice({ fileName, onReload, onDismiss }: ExternalChangeNoticeProps) {
  return (
    <div className="external-change-notice" role="status">
      <span>
        <strong>{fileName}</strong> 已被其他程序修改；重新载入会覆盖当前未保存修改，应用会先保留恢复草稿。
      </span>
      <div>
        <button type="button" onClick={onReload}>
          重新载入
        </button>
        <button type="button" className="notice-dismiss" onClick={onDismiss}>
          稍后处理
        </button>
      </div>
    </div>
  );
}
