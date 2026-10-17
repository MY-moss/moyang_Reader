import type { ChatModelOptions, ChatProvider } from "../../shared/chat-types";

// UTF-8 / 2 is a transparent planning estimate, not a tokenizer or billing figure.
export const estimateTokens = (text: string) => Math.ceil(new TextEncoder().encode(text).length / 2);
export function modelBudget(provider: Pick<ChatProvider, "modelOptions">, model: string) {
  const options: ChatModelOptions = provider.modelOptions?.[model] ?? {};
  const context = options.contextTokens ?? 16384;
  const output = options.outputTokens ?? 4096;
  if (
    !Number.isInteger(context) ||
    !Number.isInteger(output) ||
    context < 512 ||
    context > 2000000 ||
    output < 1 ||
    output >= context
  )
    throw new Error("模型预算无效：上下文需为 512–2000000 tokens，输出须大于零且小于上下文。");
  return { context, output, input: Math.floor((context - output) * 0.9), options };
}
