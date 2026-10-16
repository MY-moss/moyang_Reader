import { DocumentPreview } from "../../features/reader/components/DocumentPreview";
import { useState } from "react";
import type { Bookroom } from "../useBookroom";
import type { ReaderApplication } from "../useReaderApplication";

const titles = {
  document: "文档",
  recent: "最近打开",
  search: "搜索阅读库",
  bookmarks: "收藏",
  annotations: "摘录与批注",
  views: "保存的视图",
  recovery: "恢复中心",
};
export function BookroomPageView({ bookroom: m, model }: { bookroom: Bookroom; model: ReaderApplication }) {
  const [viewTitle, setViewTitle] = useState("");
  const run = (operation: Promise<unknown>) => {
    void operation.catch((cause) => m.setError(String(cause)));
  };
  return (
    <main className="bookroom-page">
      <header>
        <h1>{titles[m.page]}</h1>
        <button onClick={() => m.setPage("document")}>返回文档</button>
      </header>
      {m.notice && <p role="status">{m.notice}</p>}
      {m.error && (
        <div className="error-state" role="alert">
          {m.error}
          <button
            onClick={() => {
              m.setError("");
              m.refresh();
            }}
          >
            重试
          </button>
        </div>
      )}
      {m.page === "recent" && (
        <div className="bookroom-rows">
          {model.recentFiles.map((file) => (
            <button key={file.path} onClick={() => run(m.navigate({ path: file.path }))}>
              <strong>{file.name}</strong>
              <small>{file.path}</small>
            </button>
          ))}
          {!model.recentFiles.length && <p>打开过的本地文档会显示在这里。</p>}
        </div>
      )}
      {m.page === "search" && (
        <>
          <input
            autoFocus
            className="bookroom-search-input"
            type="search"
            aria-label="全文搜索阅读库"
            value={m.query}
            onChange={(event) => m.setQuery(event.target.value)}
            placeholder="搜索正文、段落或 PDF 页面…"
          />
          {!model.workspacePath ? (
            <p>添加阅读库后即可搜索其中的 Markdown、文本、Word 与文字型 PDF。</p>
          ) : (
            <>
              <div className="bookroom-search-controls">
                <label>
                  类型
                  <select
                    value={model.selectedFileKind}
                    onChange={(event) => model.setSelectedFileKind(event.target.value as typeof model.selectedFileKind)}
                  >
                    {[
                      ["all", "全部"],
                      ["markdown", "Markdown"],
                      ["text", "文本"],
                      ["docx", "Word"],
                      ["pdf", "PDF"],
                    ].map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  标签
                  <select
                    value={model.selectedTag ?? ""}
                    onChange={(event) => model.setSelectedTag(event.target.value || null)}
                  >
                    <option value="">全部</option>
                    {model.availableTags.map((tag) => (
                      <option key={tag}>{tag}</option>
                    ))}
                  </select>
                </label>
                <label>
                  排序
                  <select
                    value={m.sort}
                    onChange={(event) => {
                      m.setSort(event.target.value as "relevance" | "name");
                      m.setOffset(0);
                    }}
                  >
                    <option value="relevance">相关性</option>
                    <option value="name">文件名</option>
                  </select>
                </label>
              </div>
              <p role="status">
                {m.busy ? "正在搜索…（暂时保留上次结果）" : `${m.results.total} 份匹配文档`}
                {m.indexProgress && ` · ${m.indexProgress}`}
              </p>
              {!m.busy && !m.error && !m.results.items.length && <p>没有匹配内容。可以缩短关键词，或清除筛选条件。</p>}
              <div className="bookroom-results">
                {m.results.items.map((item) => (
                  <section key={item.path}>
                    <h2>{item.title}</h2>
                    <small>{item.path}</small>
                    {item.hits.map((hit, index) => (
                      <button key={index} onClick={() => run(m.navigate(hit.location))}>
                        <span>
                          {hit.location.page ? `第 ${hit.location.page} 页` : `段落 ${hit.location.paragraph ?? 1}`}
                        </span>
                        <p>{hit.text}</p>
                      </button>
                    ))}
                  </section>
                ))}
              </div>
              {m.results.total > 20 && (
                <nav className="bookroom-pagination" aria-label="搜索结果分页">
                  <button disabled={m.offset === 0} onClick={() => m.setOffset(Math.max(0, m.offset - 20))}>
                    上一页
                  </button>
                  <span>
                    {Math.floor(m.offset / 20) + 1} / {Math.ceil(m.results.total / 20)}
                  </span>
                  <button disabled={m.offset + 20 >= m.results.total} onClick={() => m.setOffset(m.offset + 20)}>
                    下一页
                  </button>
                </nav>
              )}
              <button onClick={() => run(m.bookmarkSearch())}>收藏此搜索</button>
              <form
                className="save-view-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (viewTitle.trim()) run(m.saveView(viewTitle.trim()).then(() => setViewTitle("")));
                }}
              >
                <input
                  aria-label="视图名称"
                  placeholder="为这个搜索与筛选组合命名"
                  value={viewTitle}
                  onChange={(event) => setViewTitle(event.target.value)}
                />
                <button disabled={!viewTitle.trim()}>保存视图</button>
              </form>
            </>
          )}
          {!!m.indexErrors.length && (
            <details>
              <summary>{m.indexErrors.length} 份文档暂未更新索引</summary>
              {m.indexErrors.map((error) => (
                <p key={error}>{error}</p>
              ))}
              <button onClick={m.retryIndex}>重新检查</button>
            </details>
          )}
        </>
      )}
      {m.page === "bookmarks" && (
        <div className="bookroom-rows">
          {m.bookmarks.map((item) => (
            <section key={item.id}>
              <button onClick={() => run(item.view ? m.applyView(item.view) : m.navigate(item.location))}>
                <strong>{item.title}</strong>
                <small>{item.location.path}</small>
              </button>
              <button onClick={() => run(m.remove("bookmark", item.id))}>取消收藏</button>
            </section>
          ))}
          {!m.bookmarks.length && <p>阅读时收藏文档或选中的位置，之后可从这里回到原处。</p>}
        </div>
      )}
      {m.page === "annotations" && (
        <div className="bookroom-rows">
          {m.annotations.map((item) => (
            <section key={item.id}>
              <blockquote>{item.quote || `第 ${item.location.page ?? 1} 页`}</blockquote>
              <p>{item.comment}</p>
              <small>{item.location.path}</small>
              <div>
                <button onClick={() => run(m.navigate(item.location))}>查看来源</button>
                <button onClick={() => run(m.remove("annotation", item.id))}>删除摘录</button>
              </div>
            </section>
          ))}
          {!m.annotations.length && <p>在正文中选中文字后添加摘录，或为当前 PDF 页面记录批注。</p>}
        </div>
      )}
      {m.page === "views" && (
        <div className="bookroom-rows">
          {m.views.map((view) => (
            <section key={view.id}>
              <button onClick={() => run(m.applyView(view))}>
                <strong>{view.title}</strong>
                <small>
                  {view.query || "全部内容"} · {view.kind} {view.tag && ` · #${view.tag}`}
                </small>
              </button>
              <button onClick={() => run(m.remove("view", view.id))}>删除视图</button>
            </section>
          ))}
          {!m.views.length && <p>在全文搜索中保存常用关键词、类型和标签组合。</p>}
        </div>
      )}
      {m.page === "recovery" && (
        <>
          <h2>回收站</h2>
          <p>恢复遇到同名文件时另存为新名称，保留双方内容。</p>
          <div className="bookroom-rows">
            {m.recycled.map((item) => (
              <section key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {item.path} · {new Date(item.deletedAt).toLocaleString()}
                  </small>
                </div>
                <button onClick={() => run(m.previewRecycled(item.id))}>预览</button>
                <button onClick={() => run(m.restore(item.id))}>恢复</button>
              </section>
            ))}
            {!m.recycled.length && <p>当前阅读库的回收站为空。</p>}
          </div>
          {m.recyclePreview && (
            <section className="recycle-preview">
              <header>
                <h3>{m.recyclePreview.name}</h3>
                <button onClick={() => m.setRecyclePreview(null)}>关闭预览</button>
              </header>
              {m.recyclePreview.folder ? (
                <>
                  <p>文件夹中的项目（最多显示 200 项）</p>
                  <ul>
                    {m.recyclePreview.children.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <DocumentPreview path={m.recyclePreview.path} name={m.recyclePreview.name} />
              )}
            </section>
          )}
          <h2>当前文档的历史版本</h2>
          <p>{model.documentState?.name ?? "先打开一份文档，再查看保存历史。"}</p>
          <div className="bookroom-history">
            {m.versions.map((version) => (
              <button key={version.id} onClick={() => run(m.previewVersion(version.id))}>
                <strong>{new Date(version.created).toLocaleString()}</strong>
                <span>{version.size.toLocaleString()} 字符</span>
                <small>{version.preview}</small>
              </button>
            ))}
          </div>
          {!m.versions.length && <p>本地文档保存后会建立历史版本。</p>}
          {m.versionPreview !== null && (
            <section className="version-preview">
              <h3>恢复预览</h3>
              <div className="version-compare">
                <section>
                  <h4>当前内容</h4>
                  <pre>{model.sourceDraft}</pre>
                </section>
                <section>
                  <h4>所选历史</h4>
                  <pre>{m.versionPreview}</pre>
                </section>
              </div>
              <button onClick={() => run(m.restoreVersion())}>恢复到编辑器</button>
            </section>
          )}
          <button onClick={() => model.setDraftRecoveryOpen(true)}>查看未保存的恢复草稿</button>
        </>
      )}
    </main>
  );
}

export function ExcerptComposer({
  quote: initial,
  onSave,
  onClose,
}: {
  quote: string;
  onSave: (quote: string, comment: string) => Promise<void>;
  onClose: () => void;
}) {
  const [quote, setQuote] = useState(initial);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <aside className="excerpt-composer" aria-label="添加摘录">
      <header>
        <h2>留下这段思考</h2>
        <button onClick={onClose} aria-label="关闭摘录">
          关闭
        </button>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          void onSave(quote, comment)
            .then(onClose)
            .catch((cause) => {
              setError(String(cause));
              setBusy(false);
            });
        }}
      >
        <label>
          摘录
          <textarea
            value={quote}
            onChange={(event) => setQuote(event.target.value)}
            placeholder="PDF 可以填写当前页的摘录或说明"
            rows={8}
          />
        </label>
        <label>
          批注
          <textarea autoFocus value={comment} onChange={(event) => setComment(event.target.value)} rows={5} />
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="toolbar-button primary" disabled={busy || (!quote.trim() && !comment.trim())}>
          {busy ? "正在保存…" : "保存摘录"}
        </button>
      </form>
    </aside>
  );
}
