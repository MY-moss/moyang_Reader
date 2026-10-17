import type { ChatProvider } from "../../shared/chat-types";
export function ModelOptions({
  provider,
  model,
  onChange,
}: {
  provider: ChatProvider;
  model: string;
  onChange: (p: ChatProvider) => void;
}) {
  const value = provider.modelOptions?.[model] ?? {};
  const update = (patch: typeof value) =>
    onChange({ ...provider, modelOptions: { ...provider.modelOptions, [model]: { ...value, ...patch } } });
  return (
    <details className="chat-model-details">
      <summary>模型预算与兼容选项 · {model || "先选择模型"}</summary>
      {model && (
        <div className="chat-model-options">
          <p>按服务文档填写，保存后供此服务的同一模型使用。默认预算是保守起点，不代表模型实际能力。</p>
          <label>
            上下文上限（tokens）
            <input
              type="number"
              min="512"
              max="2000000"
              value={value.contextTokens ?? 16384}
              onChange={(e) => update({ contextTokens: Number(e.target.value) })}
            />
          </label>
          <label>
            回答输出上限（tokens）
            <input
              type="number"
              min="1"
              max={(value.contextTokens ?? 16384) - 1}
              value={value.outputTokens ?? 4096}
              onChange={(e) => update({ outputTokens: Number(e.target.value) })}
            />
          </label>
          <small>输入按 UTF-8 字节估算并预留 10% 余量；超出时省略最早消息，不截断当前问题。实际限制以服务为准。</small>
          {provider.protocol === "openai" && (
            <>
              <label>
                输出参数
                <select
                  value={value.outputParameter ?? "max_tokens"}
                  onChange={(e) =>
                    update({ outputParameter: e.target.value as "max_tokens" | "max_completion_tokens" })
                  }
                >
                  <option value="max_tokens">max_tokens（兼容服务）</option>
                  <option value="max_completion_tokens">max_completion_tokens</option>
                </select>
              </label>
              <label className="chat-checkbox">
                <input
                  type="checkbox"
                  checked={value.streamUsage !== false}
                  onChange={(e) => update({ streamUsage: e.target.checked })}
                />
                请求服务返回流式用量
              </label>
              <small>服务明确拒绝 stream_options 时只去掉该选项重试一次；未返回用量时显示估算。</small>
            </>
          )}
          <small>
            {value.testedAt
              ? `此模型最近通过聊天测试：${new Date(value.testedAt).toLocaleString()}`
              : "尚未进行聊天测试；模型目录不等于能力验证。"}
          </small>
        </div>
      )}
    </details>
  );
}
