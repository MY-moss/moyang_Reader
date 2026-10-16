import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { aiKinds } from "../../shared/ai-types";
import { Icon } from "../../shared/components/Icon";
import { isTauriRuntime, chooseDocumentPaths } from "../../platform/bridge";
import { AiConnections } from "./AiConnections";
import { AiDetail } from "./AiDetail";
import { AiEditor } from "./AiEditor";
import { importAiFile, importAiDirectory, importAiPath, importAiWeb } from "./transfers";
import { AiActivity } from "./AiActivity";
import { AiConflictPanel } from "./AiConflictPanel";
import { useAiSpace } from "./useAiSpace";
export default function AiSpace({
  active,
  navigationActive = true,
  sidebarTarget,
  action,
  onNavigate,
  chatEnabled,
  chatActive,
  onOpenChat,
}: {
  active: boolean;
  navigationActive?: boolean;
  sidebarTarget?: HTMLElement | null;
  action?: { key: number; type: "search" | "skill"; id?: string } | null;
  onNavigate?: () => void;
  chatEnabled?: boolean;
  chatActive?: boolean;
  onOpenChat?: () => void;
}) {
  const m = useAiSpace(active);
  const handledAction = useRef<number | null>(null);
  const focusedAction = useRef<number | null>(null);
  const { setConnections, setActivity, setKind, setSelected, setActiveDraft, select } = m;
  useEffect(() => {
    if (!active || !action || handledAction.current === action.key) return;
    handledAction.current = action.key;
    setConnections(false);
    setActivity(false);
    if (action.type === "skill" && action.id) {
      setKind("skill");
      void select(action.id);
    } else if (action.type === "search" && window.matchMedia("(max-width: 820px)").matches) {
      setSelected(null);
      setActiveDraft(null);
    }
  }, [active, action, setConnections, setActivity, setKind, setSelected, setActiveDraft, select]);
  useLayoutEffect(() => {
    if (active && action?.type === "search" && !m.connections && !m.activity && focusedAction.current !== action.key) {
      const input = document.querySelector<HTMLInputElement>(".ai-search");
      if (input && input.getClientRects().length) {
        input.focus();
        focusedAction.current = action.key;
      }
    }
  }, [active, action, m.connections, m.activity, m.selected, m.activeDraft]);
  const fileRef = useRef<HTMLInputElement>(null);
  const directoryRef = useRef<HTMLInputElement | null>(null);
  const [webUrl, setWebUrl] = useState<string | null>(null),
    [importing, setImporting] = useState(false);
  const importFile = async () => {
    if (!isTauriRuntime() || m.kind === "skill") {
      fileRef.current?.click();
      return;
    }
    setImporting(true);
    try {
      const paths = await chooseDocumentPaths();
      for (const path of paths) m.stageImport(await importAiPath(path, m.kind));
    } catch (e) {
      m.notify(String(e), true);
    } finally {
      setImporting(false);
    }
  };
  const category = aiKinds.find((k) => k.key === m.kind)!;
  const sidebar = (
    <aside
      className="ai-sidebar"
      aria-label="AI 空间导航"
      onClickCapture={(event) => {
        if ((event.target as Element).closest("button")) onNavigate?.();
      }}
    >
      {chatEnabled && (
        <nav aria-label="AI 对话">
          <button aria-current={navigationActive && chatActive ? "page" : undefined} onClick={onOpenChat}>
            <Icon name="chat" />
            <span>书房聊天</span>
          </button>
        </nav>
      )}
      <div className="ai-nav-label">我的积累</div>
      <nav>
        {aiKinds.map((item) => (
          <button
            key={item.key}
            aria-current={
              navigationActive && !chatActive && !m.connections && !m.activity && m.kind === item.key
                ? "page"
                : undefined
            }
            onClick={() => {
              m.setKind(item.key);
              m.setConnections(false);
              m.setActivity(false);
              m.setArchived(false);
              m.setSelected(null);
            }}
          >
            <Icon name={item.key} />
            <span>{item.label}</span>
            <small>{m.stats?.[item.key] ?? 0}</small>
          </button>
        ))}
      </nav>
      <button
        className="ai-activity-nav"
        aria-current={navigationActive && !chatActive && m.activity ? "page" : undefined}
        onClick={() => {
          m.setConnections(false);
          m.setActivity(true);
        }}
      >
        <Icon name="history" />
        近期活动与冲突
      </button>
      {Object.values(m.drafts).length > 0 && (
        <div className="ai-draft-list">
          <div className="ai-nav-label">正在编辑</div>
          {Object.values(m.drafts).map((d) => (
            <button
              key={d.key}
              aria-pressed={navigationActive && !chatActive && !m.activity && !m.connections && m.activeDraft === d.key}
              onClick={() => {
                m.setActiveDraft(d.key!);
                m.setConnections(false);
                m.setActivity(false);
              }}
            >
              {d.fields.title || "未命名草稿"}
              <small>{d.saveError ? "需处理" : d.dirty ? "草稿" : "已保存"}</small>
            </button>
          ))}
        </div>
      )}
      <div className="ai-nav-bottom">
        <button
          aria-current={navigationActive && !chatActive && m.connections ? "page" : undefined}
          onClick={() => m.setConnections(true)}
        >
          <Icon name="connection" /> 接入与备份
        </button>
        <p>{isTauriRuntime() ? "本地保存 · 与日常笔记分开" : "浏览器预览 · 独立存储"}</p>
      </div>
    </aside>
  );
  return (
    <div
      className={`ai-space${sidebarTarget ? " ai-integrated" : ""}${m.selected || m.draft || m.connections ? " ai-has-detail" : ""}`}
    >
      {sidebarTarget ? createPortal(sidebar, sidebarTarget) : sidebar}
      <div className="ai-content-shell">
        {m.message && (
          <div className={`ai-notice${m.message.error ? " is-error" : ""}`} role={m.message.error ? "alert" : "status"}>
            <span>{m.message.text}</span>
            <button aria-label="关闭提示" onClick={() => m.setMessage(null)}>
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
        {m.discarded && (
          <div className="ai-notice" role="status">
            草稿已放弃。<button onClick={m.restoreDiscarded}>撤销放弃</button>
          </div>
        )}
        {m.activity ? (
          <AiActivity
            active={active}
            dataVersion={m.dataVersion}
            stats={m.stats}
            onSelect={(id) => void m.select(id)}
            notify={m.notify}
          />
        ) : m.connections ? (
          <AiConnections
            active={active}
            dataVersion={m.dataVersion}
            stats={m.stats}
            refresh={m.refresh}
            notify={m.notify}
          />
        ) : (
          <>
            <header className="ai-page-header">
              <div>
                <h1>{category.label}</h1>
                <p>{category.description}</p>
              </div>
              <div className="ai-inline-actions">
                <button disabled={importing} onClick={() => void importFile()}>
                  导入{m.kind === "skill" ? "技能" : "资料"}
                </button>
                {m.kind === "skill" ? (
                  <button onClick={() => directoryRef.current?.click()}>导入目录</button>
                ) : (
                  m.kind === "knowledge" && <button onClick={() => setWebUrl("")}>导入网页</button>
                )}
                <button className="ai-primary" onClick={m.newEntry}>
                  <Icon name="plus" size={16} /> 新建
                  {m.kind === "knowledge" ? "知识" : m.kind === "memory" ? "记忆" : "技能"}
                </button>
              </div>
              <input
                hidden
                ref={fileRef}
                type="file"
                accept={m.kind === "skill" ? ".md,.zip" : ".md,.markdown,.txt,.docx,.pdf"}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    const fields = await importAiFile(file, m.kind);
                    m.stageImport(fields);
                    m.notify("已载入草稿，检查后保存即可。");
                  } catch (error) {
                    m.notify(String(error), true);
                  }
                }}
              />
            </header>
            <input
              type="file"
              hidden
              multiple
              ref={(element) => {
                directoryRef.current = element;
                if (element) element.setAttribute("webkitdirectory", "");
              }}
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (!files.length) return;
                try {
                  m.stageImport(await importAiDirectory(files));
                } catch (error) {
                  m.notify(String(error), true);
                }
              }}
            />
            {webUrl !== null && (
              <form
                className="ai-web-import"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setImporting(true);
                  try {
                    m.stageImport(await importAiWeb(webUrl));
                    setWebUrl(null);
                  } catch (error) {
                    m.notify(String(error), true);
                  } finally {
                    setImporting(false);
                  }
                }}
              >
                <label>
                  网页地址
                  <input
                    type="url"
                    required
                    autoFocus
                    value={webUrl}
                    onChange={(e) => setWebUrl(e.target.value)}
                    placeholder="https://"
                  />
                </label>
                <button disabled={importing}>{importing ? "正在提取正文…" : "提取到草稿"}</button>
                <button type="button" onClick={() => setWebUrl(null)}>
                  取消
                </button>
                <p>登录页面或动态页面也可以复制正文后新建知识。</p>
              </form>
            )}
            <div className="ai-workspace">
              <section className="ai-list-panel" aria-label="AI 内容列表">
                <div className="ai-list-filters">
                  <input
                    aria-label="搜索 AI 内容"
                    className="ai-search"
                    placeholder="搜索内容、标题或标签…"
                    value={m.query}
                    onChange={(e) => m.setQuery(e.target.value)}
                  />
                  <details className="ai-filter-details">
                    <summary>
                      {m.project !== "*" || m.agent || m.archived || m.includeExpired ? "筛选 · 已启用" : "筛选"}
                      <Icon name="chevron" size={14} />
                    </summary>
                    <div className="ai-scope-filters">
                      <select aria-label="筛选项目" value={m.project} onChange={(e) => m.setProject(e.target.value)}>
                        <option value="*">全部资料</option>
                        <option value="">仅全局</option>
                        {m.stats?.projects.map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                      <select aria-label="筛选 Agent" value={m.agent} onChange={(e) => m.setAgent(e.target.value)}>
                        <option value="">所有 Agent</option>
                        {m.stats?.agents.map((a) => (
                          <option key={a}>{a}</option>
                        ))}
                      </select>
                    </div>
                    <div className="ai-filter-line">
                      <label className="ai-checkbox">
                        <input type="checkbox" checked={m.archived} onChange={(e) => m.setArchived(e.target.checked)} />
                        已归档
                      </label>
                      {m.kind === "memory" && (
                        <label className="ai-checkbox">
                          <input
                            type="checkbox"
                            checked={m.includeExpired}
                            onChange={(e) => m.setIncludeExpired(e.target.checked)}
                          />
                          含过期
                        </label>
                      )}
                      <button aria-label="刷新 AI 内容" onClick={m.refresh}>
                        刷新
                      </button>
                    </div>
                  </details>
                </div>
                {m.search.warning && <p className="ai-search-warning">{m.search.warning}</p>}
                {m.loadError && (
                  <div className="ai-search-warning" role="alert">
                    {m.loadError}
                    <button onClick={m.refresh}>重试</button>
                  </div>
                )}
                <div className="ai-list-count" aria-live="polite">
                  {m.loading ? "正在检索…" : `${m.search.total} 条${m.archived ? "归档" : "内容"}`}
                  {m.semanticLoading && <span> · 正在补充语义结果</span>}
                  {m.checked.length >= 2 && (
                    <button onClick={() => void m.merge()}>合并所选 {m.checked.length} 条</button>
                  )}
                </div>
                <div className="ai-record-list">
                  {m.search.items.map((hit) => (
                    <div key={hit.id} className={`ai-record-row${m.selected?.id === hit.id ? " is-selected" : ""}`}>
                      {m.kind === "memory" && !m.archived && (
                        <input
                          className="ai-merge-check"
                          type="checkbox"
                          aria-label={`选择记忆：${hit.title}`}
                          checked={m.checked.includes(hit.id)}
                          onChange={(e) =>
                            m.setChecked((ids) =>
                              e.target.checked ? [...ids, hit.id] : ids.filter((id) => id !== hit.id),
                            )
                          }
                        />
                      )}
                      <button
                        className="ai-record-button"
                        aria-pressed={m.selected?.id === hit.id}
                        onClick={() => {
                          void m.select(hit.id);
                        }}
                      >
                        <strong>
                          {hit.pinned ? "· " : ""}
                          {hit.title}
                        </strong>
                        <span>{hit.summary || hit.excerpt}</span>
                        <small>
                          {hit.project || "通用"} · {new Date(hit.updated_at).toLocaleDateString()}
                        </small>
                      </button>
                    </div>
                  ))}
                  {!m.loading && !m.loadError && !m.search.items.length && (
                    <div className="ai-list-empty">
                      {m.query.trim() || m.project !== "*" || m.agent || m.includeExpired
                        ? "没有匹配内容。可以调整关键词或清除筛选。"
                        : m.archived
                          ? "没有归档内容。"
                          : "这里还没有内容。"}
                      {(m.query.trim() || m.project !== "*" || m.agent || m.archived || m.includeExpired) && (
                        <button
                          className="ai-reset-filters"
                          onClick={() => {
                            m.setQuery("");
                            m.setProject("*");
                            m.setAgent("");
                            m.setArchived(false);
                            m.setIncludeExpired(false);
                          }}
                        >
                          清除筛选
                        </button>
                      )}
                      {!m.query.trim() && !m.archived && m.project === "*" && !m.agent && m.stats?.[m.kind] === 0 && (
                        <div className="ai-list-onboarding">
                          <p>
                            从一条
                            {m.kind === "memory" ? "偏好或经验" : m.kind === "skill" ? "常用流程" : "有来源的资料"}
                            开始。日常笔记不会自动进入 AI 库。
                          </p>
                          <button className="ai-primary" onClick={m.newEntry}>
                            新建第一条{m.kind === "memory" ? "记忆" : m.kind === "skill" ? "技能" : "知识"}
                          </button>
                          <button className="ai-text-button" onClick={() => m.setConnections(true)}>
                            连接我的 Agent <Icon name="forward" size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {(m.search.total > 30 || m.page > 0) && (
                  <div className="ai-pagination">
                    <button disabled={m.page === 0} onClick={() => m.setPage((p) => p - 1)}>
                      上一页
                    </button>
                    <span>
                      {m.page + 1} / {Math.max(1, Math.ceil(m.search.total / 30))}
                    </span>
                    <button disabled={(m.page + 1) * 30 >= m.search.total} onClick={() => m.setPage((p) => p + 1)}>
                      下一页
                    </button>
                  </div>
                )}
              </section>
              <main className="ai-detail-panel">
                <button
                  className="ai-mobile-back"
                  onClick={() => {
                    m.setActiveDraft(null);
                    m.setSelected(null);
                  }}
                >
                  <Icon name="back" size={16} /> 返回列表
                </button>
                {m.conflict && m.draft?.key === m.conflict.key && (
                  <AiConflictPanel
                    key={`${m.conflict.key}:${m.conflict.remote.revision}`}
                    local={m.draft.fields.body}
                    base={m.draft.baseBody}
                    remote={m.conflict.remote.body}
                    busy={m.busy}
                    onResolve={(body, copy) => void m.resolve(body, copy)}
                  />
                )}
                {!m.draft && m.selected && m.query && (
                  <div className="ai-search-fragments">
                    {m.search.items
                      .find((h) => h.id === m.selected?.id)
                      ?.fragments?.map((f) => (
                        <details key={f.ordinal}>
                          <summary>
                            命中片段 {f.ordinal + 1}
                            {f.location.page ? ` · 第 ${f.location.page} 页` : ""}
                          </summary>
                          <p>{f.text}</p>
                          {/^(?:[a-z]:|\/|\\\\)/i.test(f.location.uri) && (
                            <button
                              onClick={() =>
                                window.dispatchEvent(
                                  new CustomEvent("moyang:open-ai-source", {
                                    detail: {
                                      path: f.location.uri,
                                      page: f.location.page,
                                      paragraph: f.location.paragraph,
                                      quote: f.location.quote,
                                      hash: f.location.fingerprint,
                                    },
                                  }),
                                )
                              }
                            >
                              定位来源
                            </button>
                          )}
                        </details>
                      ))}
                  </div>
                )}
                {m.draft ? (
                  <AiEditor
                    key={m.draft.key}
                    draft={m.draft}
                    busy={m.busy}
                    onChange={m.setDraft}
                    onSave={() => void m.save()}
                    onCancel={() => m.setDraft(null)}
                    onComposition={m.setComposing}
                    onResourceLoading={m.setResourceLoading}
                  />
                ) : m.selected ? (
                  <AiDetail
                    key={`${m.selected.id}:${m.selected.revision}`}
                    record={m.selected}
                    onEdit={() =>
                      m.setDraft({
                        fields: m.selected!,
                        id: m.selected!.id,
                        expected_revision: m.selected!.revision,
                        baseBody: m.selected!.body,
                        dirty: false,
                      })
                    }
                    onSelect={(id) => void m.select(id)}
                    onChange={(r) => {
                      m.setSelected(r);
                      m.refresh();
                    }}
                    notify={m.notify}
                  />
                ) : (
                  <div className="ai-empty-detail">
                    <h2>
                      {m.kind === "memory"
                        ? "从记住一件小事开始。"
                        : m.kind === "skill"
                          ? "好方法，值得再用一次。"
                          : "让知识成为下一次回答的依据。"}
                    </h2>
                    <p>
                      {m.kind === "memory"
                        ? "记下你喜欢的表达方式、正在做的项目和已经验证的经验。以后换一个 Agent，也能从这里接着往下做。"
                        : m.kind === "skill"
                          ? "整理一个常用流程，写清适用场景和步骤。支持导入 SKILL.md 或包含脚本与参考资料的技能包。"
                          : "导入资料或写下一份知识笔记，保留来源。Agent 可以按需检索，并把新的发现整理回来。"}
                    </p>
                    <button className="ai-primary" onClick={m.newEntry}>
                      新建第一条{m.kind === "memory" ? "记忆" : m.kind === "skill" ? "技能" : "知识"}
                    </button>
                    <button className="ai-text-button" onClick={() => m.setConnections(true)}>
                      连接我的 Agent <Icon name="forward" size={16} />
                    </button>
                  </div>
                )}
              </main>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
