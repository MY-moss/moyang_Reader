import { afterEach, expect, it, vi } from "vitest";
import { streamChat } from "./chat";
import type { ChatProvider } from "../shared/chat-types";
const provider: ChatProvider = {
  id: "fixture",
  name: "fixture",
  baseUrl: "http://localhost:7331/v1",
  protocol: "openai",
  model: "test",
  hasKey: false,
};
afterEach(() => vi.unstubAllGlobals());
it("retries only explicit usage-parameter rejection once before any answer", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "unsupported stream_options" } }), { status: 400 }),
    )
    .mockResolvedValueOnce(new Response('data: {"choices":[{"delta":{"content":"回答"}}]}\n\ndata: [DONE]\n\n'));
  vi.stubGlobal("fetch", fetcher);
  let text = "";
  await streamChat(
    provider,
    { model: "test", messages: [], stream_options: { include_usage: true } },
    new AbortController().signal,
    (s) => {
      text += s;
    },
    () => {},
  );
  expect(text).toBe("回答");
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).not.toHaveProperty("stream_options");
});
it("never retries quota or transport errors", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("quota", { status: 429 }));
  vi.stubGlobal("fetch", fetcher);
  await expect(
    streamChat(
      provider,
      { stream_options: { include_usage: true } },
      new AbortController().signal,
      () => {},
      () => {},
    ),
  ).rejects.toThrow("额度");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
