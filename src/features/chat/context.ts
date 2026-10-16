import { aiRequest } from "../../platform/ai-bridge";
import type { ChatSource } from "../../shared/chat-types";
import { contentHash } from "../documents/source-chunks";
type Recall = {
  items: {
    id: string;
    title: string;
    source?: string;
    content: string;
    layer: string;
    revision: number;
    scope: { project: string };
  }[];
  warning?: string;
};
export async function chatContext(
  text: string,
  project: string,
  memory: boolean,
  attachments: ChatSource[],
  signal?: AbortSignal,
) {
  const sources: ChatSource[] = attachments.map((s) => ({ ...s, kind: "document" as const }));
  let warning = "";
  if (memory) {
    const requestId = crypto.randomUUID();
    const cancel = () => {
      void aiRequest("cancel_search", { request_id: requestId }).catch(() => undefined);
    };
    signal?.throwIfAborted();
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      const result = await aiRequest<Recall>("recall", {
        query: text,
        project: project.trim(),
        layer: "l1",
        max_chars: 5000,
        request_id: requestId,
      });
      sources.push(
        ...result.items.map((s) => ({
          id: s.id,
          title: s.title,
          source: s.source ?? "AI 库",
          text: s.content,
          layer: s.layer,
          project: s.scope.project,
          revision: s.revision,
          kind: "ai" as const,
        })),
      );
      warning = result.warning ?? "";
    } finally {
      signal?.removeEventListener("abort", cancel);
    }
  }
  const seen = new Set<string>(),
    unique: ChatSource[] = [];
  for (const source of sources) {
    const fingerprint = await contentHash(source.text);
    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      unique.push({ ...source, fingerprint });
    }
  }
  return { sources: unique, warning };
}
