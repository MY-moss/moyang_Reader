import { useState } from "react";
import type { ChatProvider } from "../../shared/chat-types";
import { providerModels } from "../../shared/provider-models";

export function ModelPicker({
  provider,
  value,
  disabled,
  onChange,
  onFavorite,
}: {
  provider?: ChatProvider;
  value: string;
  disabled: boolean;
  onChange: (model: string) => void;
  onFavorite?: (model: string) => void;
}) {
  const [query, setQuery] = useState("");
  const all = providerModels(provider);
  const models = all
    .filter((m) => m === value || m.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .sort((a, b) => Number(provider?.favorites?.includes(b)) - Number(provider?.favorites?.includes(a)));
  const [manual, setManual] = useState(false);
  const custom = manual || (Boolean(value) && !all.includes(value));
  return (
    <div className="chat-model-picker">
      {all.length > 5 && (
        <input
          type="search"
          aria-label="搜索模型"
          placeholder="搜索模型"
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      <label>
        <span className="sr-only">本次模型</span>
        <select
          aria-label="本次模型"
          disabled={disabled || !provider}
          value={custom ? "custom" : value ? String(models.indexOf(value)) : ""}
          onChange={(event) => {
            const selected = event.target.value;
            setManual(selected === "custom");
            onChange(selected === "custom" ? "" : (models[Number(selected)] ?? ""));
          }}
        >
          <option value="" disabled>
            选择模型
          </option>
          {models.map((model, index) => (
            <option key={model} value={index}>
              {provider?.favorites?.includes(model) ? "★ " : ""}
              {model}
            </option>
          ))}
          <option value="custom">自定义模型 ID…</option>
        </select>
      </label>
      {value && onFavorite && (
        <button
          type="button"
          disabled={disabled}
          aria-pressed={Boolean(provider?.favorites?.includes(value))}
          aria-label="常用模型"
          onClick={() => onFavorite(value)}
        >
          {provider?.favorites?.includes(value) ? "★" : "☆"}
        </button>
      )}
      {custom && (
        <input
          aria-label="自定义模型 ID"
          placeholder="填写服务支持的模型 ID"
          value={value}
          disabled={disabled || !provider}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}
