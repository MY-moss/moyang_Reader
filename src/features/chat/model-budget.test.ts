import { expect, it } from "vitest";
import { estimateTokens, modelBudget } from "./model-budget";
import { boundedMessages, streamDecoder } from "./protocol";
import type { ChatThread } from "../../shared/chat-types";
it("reserves each model's output and handles Chinese by bytes instead of one character per token", () => {
  const p = {
    modelOptions: {
      small: { contextTokens: 512, outputTokens: 128 },
      large: { contextTokens: 32000, outputTokens: 8000 },
    },
  };
  expect(modelBudget(p, "small").input).toBe(345);
  expect(modelBudget(p, "large").input).toBe(21600);
  expect(estimateTokens("中文")).toBe(3);
  const thread = { messages: [{ role: "user", content: "中文".repeat(150) }] } as ChatThread;
  expect(() => boundedMessages(thread, "规则", modelBudget(p, "small").input, estimateTokens)).toThrow("过长");
  expect(boundedMessages(thread, "规则", modelBudget(p, "large").input, estimateTokens).messages).toHaveLength(2);
  expect(() =>
    modelBudget({ modelOptions: { broken: { contextTokens: 512, outputTokens: 512 } } }, "broken"),
  ).toThrow();
});
it("does not manufacture zero usage from an empty or incomplete service report", () => {
  const reports: unknown[] = [];
  const parser = streamDecoder(
    () => {},
    (usage) => reports.push(usage),
  );
  parser.feed(
    new TextEncoder().encode('data: {"usage":{}}\n\ndata: {"usage":{"prompt_tokens":12}}\n\ndata: [DONE]\n\n'),
  );
  parser.finish();
  expect(reports).toEqual([]);
});
