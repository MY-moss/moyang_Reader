import { useEffect, useState } from "react";
import { normalizePathKey } from "../../platform/path-key";
import {
  chooseStorageTarget,
  prepareStorageMove,
  startStorageMove,
  storageInfo,
  type StorageInfo,
  type StoragePlan,
} from "../../platform/storage-management";

export function StorageSettings({ beforeRestart }: { beforeRestart?: () => Promise<void> }) {
  const [info, setInfo] = useState<StorageInfo | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [target, setTarget] = useState(""),
    [models, setModels] = useState(false),
    [plan, setPlan] = useState<StoragePlan | null>(null);
  const [starting, setStarting] = useState(false);
  const size = (n: number) =>
    n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(2)} GB` : `${(n / 1024 ** 2).toFixed(1)} MB`;
  const run = async (task: () => Promise<void>) => {
    setError("");
    setBusy(true);
    try {
      await task();
    } catch (e) {
      setError(String(e));
      setStarting(false);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    let active = true;
    void storageInfo()
      .then((v) => {
        if (active) setInfo(v);
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="settings-section storage-settings" aria-label="存储位置">
      <h3>存储位置</h3>
      <p>把资料放在容量充足的磁盘。这里显示实际保存位置，日常笔记仍留在你自己的文件夹里。</p>
      {error && <p role="alert">{error}</p>}
      {!info && !error && <p role="status">正在统计本机存储…</p>}
      {info && !info.native && <p>浏览器预览的数据由浏览器管理。请在 Windows 桌面版选择磁盘和迁移数据。</p>}
      {info?.native && (
        <>
          {info.report && (
            <div className="storage-report" role={info.report.status === "error" ? "alert" : "status"}>
              <strong>{info.report.message}</strong>
              <p>{info.report.target}</p>
              {info.report.retained?.length ? (
                <p>以下旧副本尚未清理，可在确认新位置可用后处理：{info.report.retained.join("；")}</p>
              ) : null}
            </div>
          )}
          <dl className="storage-locations">
            {info.locations.map((item) => (
              <div key={item.key}>
                <dt>
                  {item.label}
                  <span>{size(item.bytes)}</span>
                </dt>
                <dd>{item.physical}</dd>
                {normalizePathKey(item.logical) !== normalizePathKey(item.physical) && (
                  <dd className="storage-alias">已有连接通过原路径访问；内容实际保存在上方位置。</dd>
                )}
              </div>
            ))}
          </dl>
          <div className="settings-actions">
            <button
              className="quiet-button"
              disabled={busy}
              onClick={() => void run(async () => setInfo(await storageInfo()))}
            >
              刷新占用
            </button>
            <button
              className="quiet-button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const chosen = await chooseStorageTarget();
                  if (chosen) {
                    setTarget(chosen);
                    setPlan(null);
                  }
                })
              }
            >
              选择新位置
            </button>
          </div>
          {target && (
            <div className="storage-move">
              <h4>迁移到</h4>
              <p className="storage-path">{target}</p>
              {info.locations.some((p) => p.key === "models") && (
                <label className="settings-option">
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={models}
                    onChange={(e) => {
                      setModels(e.target.checked);
                      setPlan(null);
                    }}
                  />
                  <span>
                    <strong>同时迁移本应用的模型</strong>
                    <small>勾选前请退出本地 Ollama 服务；不勾选则模型位置保持不变。</small>
                  </span>
                </label>
              )}
              <p>
                检查后会列出迁移范围。开始时先保存内容，关闭应用，复制并校验文件，再自动重新打开。请先关闭正在连接该资料库的
                Agent。
              </p>
              <button
                className="quiet-button"
                disabled={busy}
                onClick={() => void run(async () => setPlan(await prepareStorageMove(models)))}
              >
                {busy ? "正在检查…" : "检查迁移"}
              </button>
              {plan && (
                <div className="storage-plan">
                  <p>
                    需要迁移 <strong>{size(plan.bytes)}</strong> · 目标剩余 {size(plan.free)}
                  </p>
                  <ul>
                    {plan.items.map((item) => (
                      <li key={item.key}>
                        {item.label} → {item.key}
                      </li>
                    ))}
                  </ul>
                  <p>
                    复制验证成功后释放原数据占用，原路径保留为很小的目录链接，已有 MCP
                    配置仍可使用。迁移失败会恢复原路径，并保留失败信息。
                  </p>
                  <button
                    className="toolbar-button primary"
                    disabled={busy || !beforeRestart}
                    onClick={() =>
                      void run(async () => {
                        setStarting(true);
                        await beforeRestart?.();
                        await startStorageMove();
                      })
                    }
                  >
                    保存并迁移
                  </button>
                </div>
              )}
            </div>
          )}
          <details className="storage-notes">
            <summary>其他占用和使用提醒</summary>
            <p>应用与在线更新包：{info.program}。更新包不包含模型，上一版保留以便回退。</p>
            <p>
              自动 AI
              快照与历史随资料库一起迁移；你手动导出的备份仍在原来选择的位置。界面数据包含未完成草稿，不能当作缓存直接删除。
            </p>
            <p>请使用稳定连接的本机磁盘。断开移动硬盘后不要删除原路径链接或新建空资料库；重新接好磁盘再启动。</p>
            <p>
              {info.externalModels
                ? `外部 Ollama 使用 OLLAMA_MODELS：${info.externalModels}。请在该服务中更改位置。`
                : "独立安装的 Ollama、第三方 MCP 和其他 Agent 的数据由各自管理，本功能只迁移上方列出的本应用数据。"}
            </p>
          </details>
          {starting && (
            <div className="storage-working" role="status">
              <strong>正在保存并准备迁移</strong>
              <p>窗口关闭后请稍等，完成后会自动重新打开。</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
