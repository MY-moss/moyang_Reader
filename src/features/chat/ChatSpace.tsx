import { useEffect, useRef, useState } from "react";
import { openExternalUrl } from "../../platform/bridge";
import { aiRequest } from "../../platform/ai-bridge";
import { emptyAiFields } from "../../shared/ai-types";
import type { ChatAssistant, ChatMessage, ChatSource } from "../../shared/chat-types";
import { Icon } from "../../shared/components/Icon";
import { useModalBehavior } from "../../shared/components/useModalBehavior";
import { renderMarkdown } from "../documents/rendering/markdown";
import { downloadAi } from "../ai/transfers";
import { exportChat } from "./protocol";
import { ProviderSettings } from "./ProviderSettings";
import { useChat } from "./useChat";
import { ContextPreview } from "./ContextPreview";
import { AttachmentPicker } from "./AttachmentPicker";
import { ModelPicker } from "./ModelPicker";

function MessageBody({ message, streaming }: { message: ChatMessage; streaming: boolean }) {
  const [html, setHtml] = useState("");
  useEffect(() => {
    let active = true;
    if (!streaming && message.role === "assistant")
      void renderMarkdown(message.content, { allowRemoteResources: false })
        .then((result) => {
          if (active) setHtml(result.html);
        })
        .catch(() => {
          if (active) setHtml("");
        });
    return () => {
      active = false;
    };
  }, [message.content, message.role, streaming]);
  return html && !streaming ? (
    <div
      className="chat-markdown"
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(e) => {
        const link = (e.target as Element).closest("a");
        if (link) {
          e.preventDefault();
          if (/^https?:/i.test(link.href)) void openExternalUrl(link.href).catch(() => undefined);
        }
      }}
    />
  ) : (
    <div className="chat-plain">{message.content || (streaming ? "正在思考…" : "未收到文字")}</div>
  );
}

export default function ChatSpace({
  assistants,
  selection,
  attachment,
  onOpenAi,
}: {
  assistants: ChatAssistant[];
  selection?: { key: number; id: string } | null;
  attachment?: ChatSource | null;
  onOpenAi?: (id: string) => void;
}) {
  const m = useChat(assistants);
  const contextOptions = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !contextOptions.current?.contains(event.target) && contextOptions.current)
        contextOptions.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && contextOptions.current?.open) {
        contextOptions.current.open = false;
        contextOptions.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const [picking, setPicking] = useState(false);
  const [settings, setSettings] = useState(false),
    [history, setHistory] = useState(false),
    [remove, setRemove] = useState(false);
  const [attached, setAttached] = useState<ChatSource | null>(null),
    [saveAnswer, setSaveAnswer] = useState<{
      message: ChatMessage;
      kind: "knowledge" | "memory";
      title: string;
    } | null>(null);
  const [saving, setSaving] = useState(false);
  const savePanel = useRef<HTMLDivElement>(null),
    saveKind = useRef<HTMLSelectElement>(null);
  useModalBehavior({
    containerRef: savePanel,
    initialFocusRef: saveKind,
    enabled: Boolean(saveAnswer) && !settings,
    onClose: () => {
      if (!saving) setSaveAnswer(null);
    },
  });
  const handled = useRef<number>(),
    scroll = useRef<HTMLDivElement>(null),
    follow = useRef(true);
  const assistant = assistants.find((a) => a.id === m.thread.assistantId),
    provider = m.providers.find((p) => p.id === m.thread.providerId);
  useEffect(() => {
    if (m.busy && !assistant) m.stop();
  }, [assistant, m]);
  useEffect(() => {
    if (!m.ready || m.busy || m.switching) return;
    if (selection && selection.key !== handled.current) {
      m.change({ assistantId: selection.id });
      handled.current = selection.key;
    } else if (!m.thread.assistantId && assistants[0]) m.change({ assistantId: assistants[0].id });
  }, [selection, assistants, m]);
  useEffect(() => {
    if (follow.current) scroll.current?.scrollTo({ top: scroll.current.scrollHeight });
  }, [m.thread.messages]);
  const run = async (task: () => Promise<unknown>) => {
    try {
      await task();
    } catch (cause) {
      m.setError(String(cause));
    }
  };
  const sent = async () => {
    if (!m.draft.trim() || m.busy || m.switching || m.contextLoading) return;
    follow.current = true;
    await m.generate(m.draft, attached ? [attached] : []);
    setAttached(null);
  };
  if (settings)
    return (
      <ProviderSettings
        providers={m.providers}
        selectedId={m.thread.providerId}
        onClose={() => setSettings(false)}
        onSaved={async () => {
          const services = await m.refreshProviders();
          if (!m.thread.providerId && services[0]) m.change({ providerId: services[0].id, model: services[0].model });
        }}
      />
    );
  return (
    <section className="chat-space" aria-label="书房聊天" aria-busy={m.switching}>
      <header className="chat-header">
        <div>
          <h1>书房聊天</h1>
          <small>{m.switching ? "正在保存并切换对话…" : m.busy ? "正在生成 · 可随时停止" : "记录保存在本机"}</small>
        </div>
        <div className="chat-actions">
          <button disabled={m.switching} aria-expanded={history} onClick={() => setHistory(!history)}>
            <Icon name="history" />
            历史
          </button>
          <button
            disabled={m.busy || m.switching || !m.ready}
            onClick={() =>
              void run(async () => {
                await m.open();
                setAttached(null);
                setRemove(false);
              })
            }
          >
            <Icon name="plus" />
            新对话
          </button>
          <button disabled={m.busy || m.switching} onClick={() => setSettings(true)}>
            <Icon name="settings" />
            API 服务
          </button>
        </div>
      </header>
      {history && (
        <div className="chat-history">
          <h2>最近对话</h2>
          {!m.threads.length && <p>发送第一条消息后，对话会保存在这里。</p>}
          {m.threads.map((t) => (
            <button
              disabled={m.busy || m.switching}
              key={t.id}
              aria-current={t.id === m.thread.id ? "page" : undefined}
              onClick={() =>
                void run(async () => {
                  await m.open(t.id);
                  setHistory(false);
                  setAttached(null);
                  setRemove(false);
                })
              }
            >
              <span>{t.title}</span>
              <small>{new Date(t.updatedAt).toLocaleDateString()}</small>
            </button>
          ))}
        </div>
      )}
      {history && m.historyNext && (
        <button disabled={m.historyLoading} onClick={() => void run(m.loadMore)}>
          {m.historyLoading ? "正在读取…" : "更多历史对话"}
        </button>
      )}
      <div
        className="chat-conversation"
        ref={scroll}
        onScroll={(e) => {
          const el = e.currentTarget;
          follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
        }}
      >
        {!m.ready ? (
          m.error ? (
            <div className="chat-welcome">
              <p>本机对话暂时无法读取，记录仍保留在原处。</p>
              <button onClick={m.reload}>重新读取</button>
            </div>
          ) : (
            <p role="status">正在读取本机对话…</p>
          )
        ) : !m.thread.messages.length ? (
          <div className="chat-welcome">
            <Icon name="chat" size={30} />
            <h2>{assistant?.name || "从一个问题开始"}</h2>
            <p>聊一段文字，整理一个想法。只有你发送的消息和选中的资料会交给所选 API。</p>
            {!m.providers.length ? (
              <button className="primary-action" onClick={() => setSettings(true)}>
                添加我的 API 服务
              </button>
            ) : (
              <div className="chat-starters">
                {assistant?.starters.map((text) => (
                  <button key={text} disabled={m.switching} onClick={() => m.setDraft(text)}>
                    {text}
                    <Icon name="next" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          m.thread.messages.map((message, index) => (
            <article key={message.id} className={`chat-message chat-message-${message.role}`}>
              <header className={message.role === "user" ? "sr-only" : undefined}>
                <strong>{message.role === "user" ? "我" : message.provider || "助手"}</strong>
                <small>{message.model}</small>
              </header>
              <MessageBody
                message={message}
                streaming={m.busy && index === m.thread.messages.length - 1 && message.role === "assistant"}
              />
              {message.sources?.length ? (
                <details className="chat-sources">
                  <summary>本次使用的资料 · {message.sources.length}</summary>
                  {message.sources.map((source) => (
                    <div key={source.id}>
                      <strong>{source.title}</strong>
                      <small>{source.source}</small>
                      <pre>{source.text}</pre>
                    </div>
                  ))}
                </details>
              ) : null}
              {message.error && <p className="chat-message-error">{message.error}</p>}
              {!message.content &&
                !m.busy &&
                message.role === "assistant" &&
                index === m.thread.messages.length - 1 && (
                  <button disabled={m.switching} onClick={() => void m.generate()}>
                    <Icon name="retry" />
                    重试回答
                  </button>
                )}
              {message.content && !m.busy && !m.switching && (
                <div className="chat-message-actions">
                  <button
                    aria-label="复制消息"
                    onClick={() =>
                      void run(async () => {
                        await navigator.clipboard.writeText(message.content);
                        m.setNotice("已复制消息。");
                      })
                    }
                  >
                    <Icon name="copy" />
                    <span className={message.role === "user" ? "sr-only" : undefined}>复制</span>
                  </button>
                  {message.role === "assistant" && (
                    <>
                      <button onClick={() => setSaveAnswer({ message, kind: "knowledge", title: m.thread.title })}>
                        存入 AI 库
                      </button>
                      {index === m.thread.messages.length - 1 && (
                        <button disabled={m.switching} onClick={() => void m.generate()}>
                          <Icon name="retry" />
                          重新回答
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </article>
          ))
        )}
        {m.thread.messages.length > 0 && !m.busy && (
          <div className="chat-actions chat-history-actions">
            <button
              onClick={() =>
                void run(() =>
                  downloadAi(
                    `${m.thread.title.replace(/[<>:"/\\|?*]/g, "_")}.md`,
                    new TextEncoder().encode(exportChat(m.thread)),
                    "markdown",
                  ),
                )
              }
            >
              <Icon name="download" />
              导出对话
            </button>
            <button disabled={m.switching} onClick={() => setRemove(!remove)}>
              <Icon name="trash" />
              删除对话
            </button>
            {m.thread.messages.at(-1)?.role === "user" && (
              <button disabled={m.switching} onClick={() => void m.generate()}>
                继续回答
              </button>
            )}
          </div>
        )}
        {remove && (
          <div className="chat-confirm">
            <p>删除本机的这段对话？已存入 AI 库的内容会保留。</p>
            <button
              disabled={m.switching}
              onClick={() =>
                void run(async () => {
                  await m.remove();
                  setRemove(false);
                })
              }
            >
              确认删除
            </button>
            <button onClick={() => setRemove(false)}>取消</button>
          </div>
        )}
      </div>
      <div className="chat-bottom">
        {picking && attachment && (
          <AttachmentPicker
            source={attachment}
            onClose={() => setPicking(false)}
            onConfirm={(source) => {
              setAttached(source);
              setPicking(false);
              m.closeContext();
            }}
          />
        )}
        {m.contextPreview && (
          <ContextPreview
            sources={m.contextPreview}
            excluded={m.excluded}
            toggle={m.toggleContext}
            close={m.closeContext}
            onOpen={onOpenAi}
          />
        )}
        {m.error && (
          <div role="alert" className="chat-alert">
            {m.error}
            <button onClick={() => m.setError("")} aria-label="关闭聊天错误">
              <Icon name="close" />
            </button>
          </div>
        )}
        {m.notice && (
          <p role="status" className="chat-notice">
            {m.notice}
          </p>
        )}
        {m.usage && (
          <small className="chat-usage">
            服务报告用量：输入 {m.usage.input} · 输出 {m.usage.output} tokens
          </small>
        )}
        <form
          className="chat-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void sent();
          }}
        >
          <div className="chat-model-bar">
            <label>
              <span className="sr-only">聊天助手</span>
              <select
                aria-label="聊天助手"
                disabled={m.busy || m.switching}
                value={m.thread.assistantId}
                onChange={(e) => m.change({ assistantId: e.target.value })}
              >
                {!assistant && <option value={m.thread.assistantId}>请选择已启用的助手</option>}
                {assistants.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">API 服务</span>
              <select
                aria-label="API 服务"
                disabled={m.busy || m.switching}
                value={m.thread.providerId}
                onChange={(e) => {
                  const p = m.providers.find((p) => p.id === e.target.value);
                  m.change({ providerId: p?.id ?? "", model: p?.model ?? "" });
                }}
              >
                {!provider && <option value={m.thread.providerId}>选择 API 服务</option>}
                {m.providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <ModelPicker
              key={m.thread.providerId}
              provider={provider}
              disabled={m.busy || m.switching}
              value={m.thread.model}
              onChange={(model) => m.change({ model })}
            />
          </div>
          {attached && (
            <div className="chat-attached">
              <details>
                <summary>
                  {attached.title} · {attached.text.length} 字符
                </summary>
                <pre>{attached.text}</pre>
              </details>
              <button
                type="button"
                disabled={m.busy || m.switching}
                aria-label="移除附件"
                onClick={() => setAttached(null)}
              >
                <Icon name="close" />
              </button>
            </div>
          )}
          <textarea
            aria-label="聊天消息"
            placeholder="写下问题…"
            value={m.draft}
            disabled={m.busy || m.switching || !m.ready}
            onChange={(e) => m.setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void sent();
              }
            }}
          />
          <div className="chat-compose-actions">
            <div className="chat-actions">
              <button
                type="button"
                disabled={m.busy || m.switching || !attachment}
                title={attachment ? "预览后随下一条消息发送" : "先在阅读空间打开文字文档"}
                onClick={() => setPicking(true)}
              >
                <Icon name="file" />
                引用文档或选区
              </button>
              <button
                type="button"
                disabled={m.busy || m.switching || m.contextLoading || !m.draft.trim()}
                onClick={() => void m.previewContext(attached ? [attached] : [])}
              >
                {m.contextLoading ? "正在检索…" : "预览上下文"}
              </button>
              <details className="chat-context-options" ref={contextOptions}>
                <summary>{m.thread.useMemory ? "已开启 AI 库召回" : "AI 库召回"}</summary>
                <div className="chat-context-fields">
                  <label className="chat-checkbox">
                    <input
                      disabled={m.busy || m.switching}
                      type="checkbox"
                      checked={m.thread.useMemory}
                      onChange={(e) => m.change({ useMemory: e.target.checked })}
                    />
                    发送相关知识与记忆
                  </label>
                  <label>
                    项目范围
                    <input
                      disabled={m.busy || m.switching}
                      value={m.thread.project}
                      placeholder="留空仅使用全局资料"
                      onChange={(e) => m.change({ project: e.target.value })}
                    />
                  </label>
                  <small>项目资料仅在填写对应项目时使用。普通笔记不会自动加入。</small>
                </div>
              </details>
            </div>
            {m.busy ? (
              <button type="button" onClick={m.stop}>
                <Icon name="stop" />
                停止
              </button>
            ) : (
              <button
                className="primary-action"
                type="submit"
                disabled={
                  m.switching ||
                  m.contextLoading ||
                  !m.ready ||
                  !m.draft.trim() ||
                  !provider ||
                  !assistant ||
                  !m.thread.model.trim()
                }
              >
                <Icon name="send" />
                发送
              </button>
            )}
          </div>
          <small className="chat-compose-hint">Ctrl + Enter 发送 · Enter 换行 · AI 回答请核实后使用</small>
        </form>
      </div>
      {saveAnswer && (
        <div
          className="chat-save-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) setSaveAnswer(null);
          }}
        >
          <div
            className="chat-save-panel"
            ref={savePanel}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="保存回答到 AI 库"
          >
            <h2>保存这条回答</h2>
            <p>确认内容后再保存。记忆会在未来的协作中使用。</p>
            <label>
              保存为
              <select
                ref={saveKind}
                value={saveAnswer.kind}
                onChange={(e) => setSaveAnswer({ ...saveAnswer, kind: e.target.value as "knowledge" | "memory" })}
              >
                <option value="knowledge">知识</option>
                <option value="memory">长期记忆</option>
              </select>
            </label>
            <label>
              标题
              <input
                value={saveAnswer.title}
                onChange={(e) => setSaveAnswer({ ...saveAnswer, title: e.target.value })}
              />
            </label>
            <textarea
              aria-label="待保存的回答"
              value={saveAnswer.message.content}
              onChange={(e) =>
                setSaveAnswer({ ...saveAnswer, message: { ...saveAnswer.message, content: e.target.value } })
              }
            />
            <div className="chat-actions">
              <button
                disabled={saving || !saveAnswer.title.trim() || !saveAnswer.message.content.trim()}
                onClick={() => {
                  setSaving(true);
                  void run(async () => {
                    await aiRequest("save", {
                      ...emptyAiFields(saveAnswer.kind),
                      title: saveAnswer.title,
                      body: saveAnswer.message.content,
                      source: `moyang-chat:${m.thread.id}/${saveAnswer.message.id}`,
                      project: m.thread.project.trim(),
                      sharing: m.thread.project.trim() ? "project" : "global",
                      reason: "用户确认并从聊天保存",
                    });
                    setSaveAnswer(null);
                    m.setNotice("已存入 AI 库，保留了对话来源。");
                  }).finally(() => setSaving(false));
                }}
              >
                确认保存
              </button>
              <button disabled={saving} onClick={() => setSaveAnswer(null)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
