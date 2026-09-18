export type ExternalChangeKind = "modified" | "deleted";

type ExternalChangeNoticeProps = {
  fileName: string;
  changeKind?: ExternalChangeKind;
  onReload: () => void;
  onOverwrite: () => void;
  onSaveAs: () => void;
  onDismiss: () => void;
};

export function ExternalChangeNotice({
  fileName,
  changeKind = "modified",
  onReload,
  onOverwrite,
  onSaveAs,
  onDismiss,
}: ExternalChangeNoticeProps) {
  const deleted = changeKind === "deleted";

  return (
    <div className="external-change-notice" role="alert">
      <span>
        <strong>{fileName}</strong>{" "}
        {deleted
          ? "已被删除或移走。当前内容仍保留在窗口中，不会自动写回原路径。请另存为或稍后处理。"
          : "已被其他程序修改。当前编辑不会自动覆盖原文件，请选择处理方式。"}
      </span>
      <div>
        {!deleted && (
          <>
            <button type="button" onClick={onReload}>
              重新载入
            </button>
            <button type="button" onClick={onOverwrite}>
              覆盖保存
            </button>
          </>
        )}
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
