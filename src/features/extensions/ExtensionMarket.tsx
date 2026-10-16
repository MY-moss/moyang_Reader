import { useMemo, useRef, useState } from "react";
import { extensionKinds, type ExtensionKind, type ExtensionPackage } from "../../shared/extension-types";
import { openExternalUrl } from "../../platform/bridge";
import { Icon } from "../../shared/components/Icon";
import { downloadAi } from "../ai/transfers";
import { compareVersions, readExtensionFile, compatiblePackage, localSkillRevision } from "./package";
import { ExtensionMcp } from "./ExtensionMcp";
import type { ExtensionManager } from "./useExtensions";
import { curatedCatalogUrl } from "./catalog";

export default function ExtensionMarket({
  manager: m,
  onClose,
  onOpenSkill,
  onOpenAssistant,
  readerCommands = [],
  onRunReader,
}: {
  manager: ExtensionManager;
  onClose: () => void;
  onOpenSkill: (id: string) => void;
  onOpenAssistant?: (id: string) => void;
  readerCommands?: Array<{ id: string; disabled?: boolean }>;
  onRunReader?: (id: string) => void;
}) {
  const [view, setView] = useState<"discover" | "installed" | "updates">("discover"),
    [kind, setKind] = useState<ExtensionKind | "all">("all"),
    [query, setQuery] = useState("");
  const [selection, setSelection] = useState<{ package: ExtensionPackage; source: string } | null>(null);
  const [catalogForm, setCatalogForm] = useState(false),
    [url, setUrl] = useState("");
  const [notice, setNotice] = useState(""),
    [confirmRemove, setConfirmRemove] = useState(false),
    [importing, setImporting] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const updates = m.state.installed.flatMap((installed) => {
    const candidate = m.entries
      .filter(
        (entry) =>
          entry.package.id === installed.package.id &&
          entry.source === installed.source &&
          compareVersions(entry.package.version, installed.package.version) > 0,
      )
      .sort((a, b) => compareVersions(b.package.version, a.package.version))[0];
    return candidate ? [candidate] : [];
  });
  const entries =
    view === "installed"
      ? m.state.installed.map((i) => ({ package: i.package, source: i.source }))
      : view === "updates"
        ? updates
        : m.entries;
  const visible = useMemo(
    () =>
      entries.filter(
        ({ package: p }) =>
          (kind === "all" || p.kind === kind) &&
          `${p.name} ${p.description} ${p.author}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
      ),
    [entries, kind, query],
  );
  const installed = m.state.installed.find((i) => i.package.id === selection?.package.id);
  const pkg = selection?.package;
  const needsUpdate = installed && pkg && compareVersions(pkg.version, installed.package.version) > 0;
  const canInstall = pkg && (!installed || needsUpdate);
  const busy = m.busy || importing;
  const choose = (entry: { package: ExtensionPackage; source: string }) => {
    setSelection(entry);
    setConfirmRemove(false);
    setNotice("");
    m.setError("");
  };
  const install = async (copy = false) => {
    if (!selection) return;
    if (await m.install(selection.package, selection.source, copy))
      setNotice(
        selection.package.kind === "skill" ? "已加入 AI 技能库，Agent 可以按需读取。" : "扩展已安装，可在下方管理。",
      );
  };
  return (
    <section
      className={`extension-market${selection ? " extension-selected" : ""}`}
      role="region"
      aria-label="插件市场"
    >
      <header className="extension-header">
        <div>
          <h1>插件市场</h1>
          <p>让书房适合你的阅读，也适合与你协作的 AI。</p>
        </div>
        <button onClick={onClose}>
          <Icon name="back" />
          返回工作台
        </button>
      </header>
      <div className="extension-toolbar">
        <nav aria-label="扩展列表">
          <button
            aria-current={view === "discover" ? "page" : undefined}
            onClick={() => {
              setView("discover");
              setSelection(null);
            }}
          >
            发现
          </button>
          <button
            aria-current={view === "installed" ? "page" : undefined}
            onClick={() => {
              setView("installed");
              setSelection(null);
            }}
          >
            已安装 <span>{m.state.installed.length}</span>
          </button>
          <button
            aria-current={view === "updates" ? "page" : undefined}
            onClick={() => {
              setView("updates");
              setSelection(null);
            }}
          >
            更新 <span>{updates.length}</span>
          </button>
        </nav>
        <div className="extension-actions">
          <button disabled={busy} onClick={() => file.current?.click()}>
            <Icon name="plus" />
            导入扩展包
          </button>
          <button onClick={() => setCatalogForm((value) => !value)}>管理目录源</button>
        </div>
        <input
          ref={file}
          type="file"
          accept=".json,.zip,.md"
          aria-label="导入扩展包"
          hidden
          onChange={async (e) => {
            const selected = e.target.files?.[0];
            e.target.value = "";
            if (!selected) return;
            setImporting(true);
            m.setError("");
            try {
              const imported = await readExtensionFile(selected);
              choose({
                package: localSkillRevision(
                  imported,
                  m.state.installed.find((i) => i.package.id === imported.id)?.package,
                ),
                source: `本地：${selected.name}`,
              });
            } catch (cause) {
              m.setError(String(cause));
            } finally {
              setImporting(false);
            }
          }}
        />
      </div>
      {catalogForm && (
        <section className="extension-catalogs" aria-label="目录源">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void m.refreshCatalog(url).then((ok) => {
                if (ok) {
                  setUrl("");
                  setNotice("目录已载入，已安装内容保持原样。");
                }
              });
            }}
          >
            <label>
              远程目录地址
              <input
                type="url"
                required
                placeholder="https://…/catalog.json"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>
            <button disabled={busy}>添加目录</button>
          </form>
          <p>内置精选离线可用。外部目录仅在点击刷新时联网；安装前可以查看来源与代码。</p>
          <button disabled={busy} onClick={() => void m.refreshCatalog(curatedCatalogUrl, "精选在线目录")}>
            检查精选更新
          </button>
          {m.state.catalogs.map((c) => (
            <div className="extension-catalog-row" key={c.url}>
              <div>
                <strong>{c.name}</strong>
                <small>
                  {c.url} · {new Date(c.checkedAt).toLocaleString()}
                </small>
              </div>
              <button disabled={busy} onClick={() => void m.refreshCatalog(c.url)}>
                刷新目录
              </button>
              <button disabled={busy} onClick={() => void m.removeCatalog(c.url)}>
                移除目录
              </button>
            </div>
          ))}
        </section>
      )}
      {m.error && (
        <div className="extension-message" role="alert">
          {m.failedCatalog ? (
            <>
              <div>
                <span>目录更新失败。已有安装仍可使用；请检查网络或目录地址后重试。</span>
                <small>{m.failedCatalog.url}</small>
                <details>
                  <summary>查看错误详情</summary>
                  {m.error}
                </details>
              </div>
              <button
                disabled={busy}
                onClick={() => {
                  const catalog = m.failedCatalog;
                  if (catalog) {
                    setNotice("");
                    void m.refreshCatalog(catalog.url, catalog.name);
                  }
                }}
              >
                重试目录更新
              </button>
            </>
          ) : (
            <>
              <span>{m.error}</span>
              <button disabled={busy} onClick={() => void m.reload()}>
                重新读取安装状态
              </button>
            </>
          )}
        </div>
      )}
      {!m.error && (notice || busy) && (
        <p className="extension-message" role="status">
          {busy ? "正在处理，请稍候…" : notice}
        </p>
      )}
      {!m.ready ? (
        <p className="extension-empty">{m.error ? "扩展存储暂时不可用，已有安装未被清空。" : "正在读取扩展…"}</p>
      ) : (
        <div className="extension-body">
          <div className="extension-list-pane">
            <div className="extension-filter">
              <label className="sr-only" htmlFor="extension-query">
                搜索扩展
              </label>
              <input
                id="extension-query"
                type="search"
                placeholder="搜索名称或用途"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                aria-label="扩展类型"
                value={kind}
                onChange={(e) => setKind(e.target.value as ExtensionKind | "all")}
              >
                <option value="all">全部类型</option>
                {Object.entries(extensionKinds).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {visible.length ? (
              <ul className="extension-list">
                {visible.map((entry) => {
                  const p = entry.package,
                    current = m.state.installed.find((i) => i.package.id === p.id);
                  return (
                    <li key={`${entry.source}:${p.id}`}>
                      <button
                        className="extension-row"
                        aria-pressed={selection?.package.id === p.id && selection.source === entry.source}
                        onClick={() => choose(entry)}
                      >
                        <Icon
                          name={
                            p.kind === "assistant"
                              ? "chat"
                              : p.kind === "reader"
                                ? "extensions"
                                : p.kind === "theme"
                                  ? "theme"
                                  : p.kind === "skill"
                                    ? "skill"
                                    : "connection"
                          }
                        />
                        <div>
                          <div className="extension-row-title">
                            <strong>{p.name}</strong>
                            <span>{current ? (current.enabled ? "已安装" : "已停用") : extensionKinds[p.kind]}</span>
                          </div>
                          <p>{p.description}</p>
                          <small>
                            {p.author} · {p.version}
                            {entry.source === "内置精选" ? " · 精选" : " · 自定义来源"}
                          </small>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="extension-empty">
                <h2>
                  {query || kind !== "all"
                    ? "没有匹配的扩展"
                    : view === "updates"
                      ? "当前没有可用更新"
                      : "还没有安装扩展"}
                </h2>
                <p>
                  {query || kind !== "all"
                    ? "试试其他关键词或查看全部类型。"
                    : view === "updates"
                      ? "可以在目录源中刷新，检查作者发布的新版本。"
                      : "从发现列表选一个适合你的扩展，也可以导入本地包。"}
                </p>
              </div>
            )}
          </div>
          {pkg && selection ? (
            <article className="extension-detail" aria-label="扩展详情">
              <button className="extension-back" onClick={() => setSelection(null)}>
                <Icon name="back" />
                返回列表
              </button>
              <div className="extension-detail-heading">
                <span>{extensionKinds[pkg.kind]}</span>
                <h2>{pkg.name}</h2>
                <p>{pkg.description}</p>
              </div>
              <dl>
                <div>
                  <dt>作者</dt>
                  <dd>{pkg.author}</dd>
                </div>
                <div>
                  <dt>版本</dt>
                  <dd>
                    {pkg.version}
                    {installed && installed.package.version !== pkg.version
                      ? `（已安装 ${installed.package.version}）`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt>来源</dt>
                  <dd>{selection.source}</dd>
                </div>
                <div>
                  <dt>许可</dt>
                  <dd>{pkg.license || "作者未声明"}</dd>
                </div>
              </dl>
              <div className="extension-actions">
                {canInstall && (
                  <button
                    className="primary-action"
                    disabled={busy || !compatiblePackage(pkg)}
                    onClick={() => void install()}
                  >
                    {!compatiblePackage(pkg)
                      ? `需要 Moyang ${pkg.minAppVersion}`
                      : needsUpdate
                        ? `更新到 ${pkg.version}`
                        : "安装扩展"}
                  </button>
                )}
                {installed && ["reader", "theme", "assistant"].includes(pkg.kind) && (
                  <button disabled={busy} onClick={() => void m.toggle(pkg.id)}>
                    {installed.enabled ? "停用" : "启用"}
                  </button>
                )}
                {installed?.skillId && <button onClick={() => onOpenSkill(installed.skillId!)}>在技能库打开</button>}
                {installed?.enabled && pkg.kind === "assistant" && (
                  <button className="primary-action" disabled={busy} onClick={() => onOpenAssistant?.(pkg.id)}>
                    开始聊天
                  </button>
                )}
                {pkg.homepage && (
                  <button onClick={() => void openExternalUrl(pkg.homepage!).catch((e) => m.setError(String(e)))}>
                    查看项目来源
                  </button>
                )}
                <button
                  onClick={() => {
                    void downloadAi(
                      `${pkg.id}-${pkg.version}.json`,
                      new TextEncoder().encode(JSON.stringify(pkg, null, 2)),
                      "json",
                    ).catch((e) => m.setError(String(e)));
                  }}
                >
                  导出包
                </button>
              </div>
              {pkg.kind === "reader" && (
                <p>运行时只把当前文档交给插件。修改会先展示比较结果，由你采用；请安装你信任的代码。</p>
              )}
              {pkg.readme && <div className="extension-readme">{pkg.readme}</div>}
              {pkg.assistant && (
                <details>
                  <summary>助手的行为说明</summary>
                  <div className="extension-readme">{pkg.assistant.prompt}</div>
                  <p>
                    API 服务和模型由你在聊天页面选择。停用或卸载此助手会保留聊天记录；重新启用任意聊天助手后可继续查看。
                  </p>
                </details>
              )}
              {pkg.commands?.length ? (
                <section>
                  <h3>可用命令</h3>
                  <p>打开支持的文档后可直接运行，也可在阅读页的更多操作或命令面板中使用。</p>
                  <ul>
                    {pkg.commands.map((c) => {
                      const id = `extension:${pkg.id}:${c.id}`;
                      const runnable =
                        installed?.enabled &&
                        installed.package.commands?.some((item) => item.id === c.id) &&
                        readerCommands.some((item) => item.id === id && !item.disabled);
                      return (
                        <li key={c.id} className="extension-command-row">
                          <span>
                            {c.name} · {c.modifiesDocument ? "可修改正文" : "只读"}
                          </span>
                          {installed && (
                            <button disabled={busy || !runnable} onClick={() => onRunReader?.(id)}>
                              运行：{c.name}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {installed && (
                    <p>
                      {!installed.enabled
                        ? "启用插件后可运行。"
                        : `使用当前打开的文档。支持：${(installed.package.formats ?? ["markdown", "text"]).map((kind) => ({ markdown: "Markdown", text: "TXT", docx: "DOCX" })[kind]).join("、")}；未打开适用文档时按钮不可用。`}
                    </p>
                  )}
                </section>
              ) : null}
              {pkg.skill && (
                <details>
                  <summary>技能正文与资源（{pkg.skill.assets.length}）</summary>
                  <pre>{pkg.skill.body}</pre>
                  <ul>
                    {pkg.skill.assets.map((a) => (
                      <li key={a.path}>{a.path}</li>
                    ))}
                  </ul>
                </details>
              )}
              {pkg.files && (
                <details>
                  <summary>查看插件代码</summary>
                  {Object.entries(pkg.files).map(([path, source]) => (
                    <div key={path}>
                      <h3>{path}</h3>
                      <pre>{source}</pre>
                    </div>
                  ))}
                </details>
              )}
              {installed?.package.kind === "mcp" && (
                <ExtensionMcp
                  key={`${installed.package.id}:${installed.package.version}`}
                  installed={installed}
                  manager={m}
                />
              )}
              {needsUpdate && pkg.kind === "skill" && (
                <button disabled={busy} onClick={() => void install(true)}>
                  保留原技能，安装副本
                </button>
              )}
              {installed && (
                <section className="extension-maintenance">
                  <h3>管理安装</h3>
                  {installed.previous && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void m.install(installed.previous!, installed.source, false, true).then((ok) => {
                          if (ok) {
                            setSelection({ package: installed.previous!, source: installed.source });
                            setNotice("已回退上一版。");
                          }
                        })
                      }
                    >
                      回退上一版 {installed.previous.version}
                    </button>
                  )}
                  {!confirmRemove ? (
                    <button disabled={busy} onClick={() => setConfirmRemove(true)}>
                      卸载扩展
                    </button>
                  ) : (
                    <div>
                      <p>
                        {pkg.kind === "skill"
                          ? "卸载扩展记录后，技能库中的正文、改进与历史仍保留。"
                          : "卸载会移除本地安装和上一版本。导出的包可再次安装。"}
                      </p>
                      <div className="extension-actions">
                        <button
                          disabled={busy}
                          onClick={() =>
                            void m.uninstall(pkg.id).then((ok) => {
                              if (ok) {
                                setConfirmRemove(false);
                                setNotice("扩展已卸载。");
                              }
                            })
                          }
                        >
                          确认卸载
                        </button>
                        <button onClick={() => setConfirmRemove(false)}>保留扩展</button>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </article>
          ) : (
            <aside className="extension-intro">
              <Icon name="extensions" />
              <h2>按你的习惯添一项能力</h2>
              <p>
                选中扩展查看用途、来源和版本。阅读插件在调用时运行，主题随明暗模式切换，技能与 MCP 和你的 Agent
                一起使用。
              </p>
              <p>这里使用 Moyang 的扩展格式。Obsidian 插件需要适配其 API，不能直接安装。</p>
            </aside>
          )}
        </div>
      )}
    </section>
  );
}
