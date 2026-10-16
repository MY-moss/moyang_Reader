export type ChatProtocol = "openai" | "anthropic";
export type ChatProvider = {
  id: string;
  name: string;
  protocol: ChatProtocol;
  baseUrl: string;
  model: string;
  hasKey: boolean;
};
export type ChatSource = { id: string; title: string; source: string; text: string };
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  status?: "complete" | "stopped" | "error";
  error?: string;
  provider?: string;
  model?: string;
  sources?: ChatSource[];
};
export type ChatThread = {
  id: string;
  title: string;
  revision: number;
  updatedAt: number;
  providerId: string;
  model: string;
  project: string;
  useMemory: boolean;
  assistantId: string;
  messages: ChatMessage[];
};
export type ChatThreadSummary = Omit<ChatThread, "messages">;
export type ChatAssistant = { id: string; name: string; prompt: string; starters: string[] };
export type ChatWireMessage = { role: "user" | "assistant" | "system"; content: string };
export type ChatUsage = { input: number; output: number };
