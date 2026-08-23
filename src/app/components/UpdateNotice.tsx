import type { UpdateStatus } from "../updater";

type UpdateNoticeProps = {
  status: Exclude<UpdateStatus, "idle" | "checking">;
  version: string | null;
  notes: string | null;
  progress: number | null;
  error: string | null;
  onInstall: () => void;
  onRelaunch: () => void;
  onDismiss: () => void;
};

function titleForStatus(status: UpdateNoticeProps["status"]): string {
  if (status === "up-to-date") return "已是最新版本";
  if (status === "available") return "发现新版本";
  if (status === "downloading") return "正在安装更新";
  if (status === "ready") return "更新已安装";
  return "更新没有完成";
}

export function UpdateNotice({
  status,
  version,
  notes,
  progress,
  error,
  onInstall,
  onRelaunch,
  onDismiss,
}: UpdateNoticeProps) {
  const isError = status === "error";
  const progressLabel = progress === null ? "正在下载更新…" : "正在下载更新… " + Math.round(progress * 100) + "%";

  return (
    <section className={"update-notice update-notice-" + status} role={isError ? "alert" : "status"}>
      <div className="update-copy">
        <strong>
          {titleForStatus(status)}
          {version && status !== "up-to-date" ? " · v" + version.replace(/^v/i, "") : ""}
        </strong>
        {status === "up-to-date" && <span>已向 Moyang Reader 更新服务完成检查。</span>}
        {status === "available" && <span>下载后会校验签名，并在安装完成后重启应用。</span>}
        {status === "downloading" && <span>{progressLabel}</span>}
        {status === "ready" && <span>应用已经更新，可以重启进入新版本。</span>}
        {isError && <span>{error ?? "请稍后重试。"}</span>}
        {status === "downloading" && progress !== null && (
          <div className="update-progress" aria-label={progressLabel}>
            <span style={{ width: Math.round(progress * 100) + "%" }} />
          </div>
        )}
        {status === "available" && notes && <p>{notes}</p>}
      </div>
      <div className="update-actions">
        {status === "available" && (
          <button type="button" className="toolbar-button primary" onClick={onInstall}>
            下载并安装
          </button>
        )}
        {status === "ready" && (
          <button type="button" className="toolbar-button primary" onClick={onRelaunch}>
            重启应用
          </button>
        )}
        {status !== "downloading" && (
          <button type="button" className="quiet-button" onClick={onDismiss}>
            {status === "up-to-date" ? "知道了" : "稍后处理"}
          </button>
        )}
      </div>
    </section>
  );
}
