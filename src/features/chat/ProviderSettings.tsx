import { useEffect, useRef, useState } from "react";
import { chatModels, chatRequest, streamChat } from "../../platform/chat";
import { isTauriRuntime } from "../../platform/bridge";
import type { ChatProvider } from "../../shared/chat-types";
import { providerModels } from "../../shared/provider-models";
import { Icon } from "../../shared/components/Icon";
import { apiEndpoint, requestBody } from "./protocol";

const newProvider = (): ChatProvider => ({
  id: crypto.randomUUID(),
  name: "",
  protocol: "openai",
  baseUrl: "https://api.openai.com/v1",
  model: "",
  models: [],
  hasKey: false,
});
export function ProviderSettings({
  providers,
  selectedId,
  onSaved,
  onClose,
  returnLabel = "返回聊天",
}: {
  providers: ChatProvider[];
  selectedId: string;
  onSaved: () => Promise<unknown>;
  onClose: () => void;
  returnLabel?: string;
}) {
  const [form, setForm] = useState<ChatProvider>(
    () => providers.find((p) => p.id === selectedId) ?? providers[0] ?? newProvider(),
  );
  const [key, setKey] = useState(""),
    [clearKey, setClearKey] = useState(false);
  const [savedForm, setSavedForm] = useState(form);
  const [destination, setDestination] = useState<ChatProvider | "chat" | null>(null);
  const keepEditing = useRef<HTMLButtonElement>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm) || key !== "" || clearKey;
  useEffect(() => {
    if (destination) keepEditing.current?.focus();
  }, [destination]);
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [testing, setTesting] = useState(false),
    [removing, setRemoving] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const select = (p: ChatProvider) => {
    setForm(p);
    setSavedForm(p);
    setKey("");
    setClearKey(false);
    setError("");
    setMessage("");
    setRemoving(false);
  };
  const navigate = (target: ChatProvider | "chat") => {
    setDestination(null);
    if (target === "chat") onClose();
    else select(target);
  };
  const requestNavigation = (target: ChatProvider | "chat") => {
    if (target !== "chat" && target.id === form.id) return;
    if (dirty) setDestination(target);
    else navigate(target);
  };
  const save = async (profile = form) => {
    if (!form.name.trim()) throw new Error("请为服务填写一个便于识别的名称。");
    apiEndpoint(form.baseUrl, form.protocol);
    const saved = await chatRequest<ChatProvider>("save_provider", {
      ...profile,
      models: providerModels(profile),
      name: form.name.trim(),
      apiKey: key.trim(),
      clearKey,
    });
    setForm(saved);
    setSavedForm(saved);
    setKey("");
    setClearKey(false);
    if (!localStorage.getItem("moyang.chat.default")) localStorage.setItem("moyang.chat.default", saved.id);
    await onSaved();
    return saved;
  };
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
      setTesting(false);
      controller.current = null;
    }
  };
  return (
    <section className="chat-settings" aria-label="API 服务设置">
      <header>
        <div>
          <h2>API 服务</h2>
          <p>添加自己的服务，供聊天、记忆整理和嵌入检索分别选择。</p>
        </div>
        <button disabled={busy || Boolean(destination)} onClick={() => requestNavigation("chat")}>
          <Icon name="back" />
          {returnLabel}
        </button>
      </header>
      {destination && (
        <section className="chat-provider-pending" aria-label="未保存的服务配置">
          <p>服务配置尚未保存。保存后继续，或保留当前页面继续填写。</p>
          <div className="chat-actions">
            <button
              disabled={busy}
              className="primary-action"
              onClick={() =>
                void run(async () => {
                  await save();
                  navigate(destination);
                })
              }
            >
              保存后继续
            </button>
            <button disabled={busy} onClick={() => navigate(destination)}>
              放弃修改并继续
            </button>
            <button ref={keepEditing} disabled={busy} onClick={() => setDestination(null)}>
              继续编辑
            </button>
          </div>
        </section>
      )}
      <div className="chat-settings-layout">
        <nav aria-label="我的 API 服务">
          {providers.map((p) => (
            <button
              disabled={busy || Boolean(destination)}
              key={p.id}
              aria-current={form.id === p.id ? "page" : undefined}
              onClick={() => requestNavigation(p)}
            >
              {p.name}
              <small>{p.protocol === "anthropic" ? "Anthropic" : "OpenAI 兼容"}</small>
            </button>
          ))}
          <button disabled={busy || Boolean(destination)} onClick={() => requestNavigation(newProvider())}>
            <Icon name="plus" />
            添加服务
          </button>
        </nav>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await save();
              setMessage("服务已保存。可以获取模型，或测试一次真实回答。");
            });
          }}
        >
          <fieldset disabled={busy}>
            <legend className="sr-only">服务配置</legend>
            <label>
              服务名称
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例如：我的转发服务"
                required
              />
            </label>
            <label>
              接口协议
              <select
                value={form.protocol}
                onChange={(e) => setForm({ ...form, protocol: e.target.value as ChatProvider["protocol"] })}
              >
                <option value="openai">OpenAI 兼容</option>
                <option value="anthropic">Anthropic Messages</option>
              </select>
            </label>
            <label>
              API 基础地址
              <input
                type="url"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                required
              />
            </label>
            <small>填写服务提供方的接口地址，可包含 /v1。支持本地服务；请使用可信的远程服务。</small>
            <label>
              API 密钥
              <input
                type="password"
                autoComplete="new-password"
                value={key}
                placeholder={form.hasKey ? "已有密钥，留空保持不变" : "本地免密服务可以留空"}
                onChange={(e) => {
                  setKey(e.target.value);
                  setClearKey(false);
                }}
              />
            </label>
            {form.hasKey && (
              <label className="chat-checkbox">
                <input type="checkbox" checked={clearKey} onChange={(e) => setClearKey(e.target.checked)} />
                清除已保存的密钥
              </label>
            )}
            <label>
              默认模型
              <input
                value={form.model}
                list="chat-provider-models"
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="填写服务提供方的模型 ID"
              />
            </label>
            <datalist id="chat-provider-models">
              {providerModels(form).map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
            <small>默认模型只用于新对话；聊天时可以随时选择这个服务的其他模型。</small>
            <label>
              可选模型列表
              <textarea
                aria-label="可选模型列表"
                rows={4}
                value={(form.models ?? []).join("\n")}
                onChange={(event) => setForm({ ...form, models: event.target.value.split("\n") })}
                placeholder="每行一个模型 ID，可手动添加，也可点击下方获取模型。"
              />
            </label>
            <small>模型列表随服务保存在本机。获取列表会补充新模型；可在这里移除不需要的条目。</small>
          </fieldset>
          <p className="chat-privacy">
            {isTauriRuntime()
              ? "密钥保存在本机的独立服务配置中，不包含在聊天导出或插件包里。"
              : "浏览器预览只在当前页面暂存密钥，刷新后需要重新填写。跨域请求是否可用取决于 API 服务。"}
          </p>
          {error && (
            <p role="alert" className="is-error">
              {error}
            </p>
          )}
          {message && <p role="status">{message}</p>}
          <div className="chat-actions">
            <button disabled={busy} className="primary-action" type="submit">
              保存服务
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const p = await save();
                  const found = await chatModels(p);
                  if (found.length) await save({ ...p, models: [...providerModels(p), ...found] });
                  setMessage(
                    found.length
                      ? `已获取 ${found.length} 个模型并保存，可在聊天中自由选择。`
                      : "服务未提供模型列表，请手动填写模型 ID。",
                  );
                })
              }
            >
              获取模型
            </button>
            <button
              type="button"
              disabled={busy || !form.model.trim()}
              onClick={() =>
                void run(async () => {
                  const p = await save();
                  const abort = new AbortController();
                  controller.current = abort;
                  setTesting(true);
                  let reply = "";
                  const timer = setTimeout(() => abort.abort(), 30000);
                  try {
                    await streamChat(
                      p,
                      requestBody(p.protocol, p.model, [{ role: "user", content: "请只回复：连接成功" }]),
                      abort.signal,
                      (text) => {
                        reply += text;
                      },
                      () => undefined,
                    );
                    if (!reply.trim()) throw new Error("模型没有返回文字。");
                    setMessage(`连接成功：${reply.slice(0, 120)}`);
                  } finally {
                    clearTimeout(timer);
                  }
                })
              }
            >
              测试回答
            </button>
            {testing && (
              <button type="button" onClick={() => controller.current?.abort()}>
                停止测试
              </button>
            )}
          </div>
          <small>获取模型与测试回答会连接该服务；测试回答可能产生少量 API 用量。</small>
          {providers.some((p) => p.id === form.id) && (
            <div className="chat-provider-manage">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  localStorage.setItem("moyang.chat.default", form.id);
                  setMessage("已设为新对话的默认服务。");
                }}
              >
                设为默认服务
              </button>
              {!removing ? (
                <button disabled={busy} type="button" onClick={() => setRemoving(true)}>
                  移除服务
                </button>
              ) : (
                <>
                  <span>聊天记录会保留。确认移除此服务？</span>
                  <button
                    disabled={busy}
                    type="button"
                    onClick={() =>
                      void run(async () => {
                        await chatRequest("delete_provider", { id: form.id });
                        if (localStorage.getItem("moyang.chat.default") === form.id)
                          localStorage.removeItem("moyang.chat.default");
                        await onSaved();
                        select(newProvider());
                      })
                    }
                  >
                    确认移除
                  </button>
                  <button type="button" onClick={() => setRemoving(false)}>
                    取消
                  </button>
                </>
              )}
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
