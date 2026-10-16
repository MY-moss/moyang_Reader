import type { ReaderApplication } from "../useReaderApplication";
export function ReaderStatus({
  model,
}: {
  model: Pick<
    ReaderApplication,
    "documentState" | "setExternalChangePath" | "currentVersion" | "saveState" | "saveDocument"
  >;
}) {
  const { documentState, setExternalChangePath, currentVersion, saveState, saveDocument } = model;
  const status = saveState?.path === documentState?.path ? saveState?.status : undefined;
  return (
    <>
      <footer className="statusbar">
        <span>{documentState?.path ?? "等待打开文件"}</span>
        {documentState && (
          <span role="status" aria-live="polite" className={`save-status save-status-${status ?? "idle"}`}>
            {status === "saving" ? (
              "正在保存…"
            ) : status === "error" ? (
              <button className="quiet-button" onClick={() => void saveDocument()}>
                保存失败 · 重试
              </button>
            ) : documentState.modified ? (
              "有未保存修改"
            ) : status === "saved" ? (
              documentState.path.startsWith("browser://") ? (
                "已下载副本"
              ) : (
                "已保存到本机"
              )
            ) : (
              "已载入"
            )}
          </span>
        )}
        {documentState && (
          <span>
            {documentState.kind === "pdf"
              ? "PDF"
              : documentState.kind === "image"
                ? "图片"
                : `${documentState.rendered.wordCount.toLocaleString("zh-CN")} 字符`}
          </span>
        )}
        {documentState?.externallyModified && (
          <button
            type="button"
            className="statusbar-external-change"
            onClick={() => setExternalChangePath(documentState.path)}
          >
            外部修改待处理
          </button>
        )}
        <span>{currentVersion ? "v" + currentVersion : "Moyang Reader"}</span>
      </footer>
    </>
  );
}
