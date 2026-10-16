import type { ChatProvider } from "./chat-types";

export function providerModels(provider?: Pick<ChatProvider, "model" | "models">): string[] {
  return [...new Set([...(provider?.models ?? []), provider?.model ?? ""].map((id) => id.trim()).filter(Boolean))];
}
