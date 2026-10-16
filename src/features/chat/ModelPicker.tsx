import { useState } from "react";
import type { ChatProvider } from "../../shared/chat-types";
import { providerModels } from "../../shared/provider-models";

export function ModelPicker({
  provider,
  value,
  disabled,
  onChange,
}: {
  provider?: ChatProvider;
  value: string;
  disabled: boolean;
  onChange: (model: string) => void;
}) {
  const models = providerModels(provider);
  const [manual, setManual] = useState(false);
  const custom = manual || (Boolean(value) && !models.includes(value));
  return (
    <div className="chat-model-picker">
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
              {model}
            </option>
          ))}
          <option value="custom">自定义模型 ID…</option>
        </select>
      </label>
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
