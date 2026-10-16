import { describe, expect, it } from "vitest";
import { apiEndpoint, boundedMessages, requestBody, streamDecoder } from "./protocol";
import type { ChatThread } from "../../shared/chat-types";

describe("chat protocols", () => {
  it("normalizes local and compatible endpoints without duplicating paths", () => {
    expect(apiEndpoint("http://127.0.0.1:11434", "openai")).toBe("http://127.0.0.1:11434/v1/chat/completions");
    expect(apiEndpoint("https://example.org/proxy/v1/messages", "anthropic", true)).toBe(
      "https://example.org/proxy/v1/models",
    );
    expect(() => apiEndpoint("https://example.org?key=secret", "openai")).toThrow();
  });
  it("separates Anthropic system content and leaves compatible requests minimal", () => {
    const messages = [
      { role: "system" as const, content: "偏好" },
      { role: "user" as const, content: "你好" },
    ];
    expect(requestBody("anthropic", "custom-model", messages)).toMatchObject({
      system: "偏好",
      messages: [messages[1]],
      max_tokens: 4096,
    });
    expect(requestBody("openai", "custom-model", messages)).toEqual({ model: "custom-model", stream: true, messages });
  });
  it("decodes arbitrarily split Chinese streams and preserves usage", () => {
    let text = "",
      tokens = {};
    const parser = streamDecoder(
      (s) => {
        text += s;
      },
      (u) => {
        tokens = u;
      },
    );
    const bytes = new TextEncoder().encode(
      'data: {"choices":[{"delta":{"content":"你好😀"}}]}\r\n\r\ndata: {"usage":{"prompt_tokens":12,"completion_tokens":3},"choices":[]}\n\ndata: [DONE]\n\n',
    );
    for (const byte of bytes) parser.feed(new Uint8Array([byte]));
    parser.finish();
    expect(text).toBe("你好😀");
    expect(tokens).toEqual({ input: 12, output: 3 });
  });
  it("handles Anthropic deltas and reports interrupted streams and streamed errors", () => {
    let text = "";
    const parser = streamDecoder(
      (s) => {
        text += s;
      },
      () => {},
    );
    parser.feed(
      new TextEncoder().encode(
        'event: content_block_delta\ndata: {"delta":{"type":"text_delta","text":"正文"}}\n\nevent: message_stop\ndata: {"type":"message_stop"}\n\n',
      ),
    );
    parser.finish();
    expect(text).toBe("正文");
    expect(() =>
      streamDecoder(
        () => {},
        () => {},
      ).finish(),
    ).toThrow("提前结束");
    expect(() =>
      streamDecoder(
        () => {},
        () => {},
      ).feed(new TextEncoder().encode('data: {"error":{"message":"配额不足"}}\n\n')),
    ).toThrow("配额不足");
  });
  it("limits sent history without truncating the current request or persisted messages", () => {
    const thread = {
      messages: [
        { role: "user", content: "旧问题" },
        { role: "assistant", content: "旧回答" },
        { role: "user", content: "新问题" },
      ],
    } as ChatThread;
    const pack = boundedMessages(thread, "规则", 8);
    expect(pack.messages.at(-1)?.content).toBe("新问题");
    expect(pack.messages[1].role).toBe("user");
    expect(pack.omitted).toBe(2);
    expect(thread.messages).toHaveLength(3);
  });
  it("includes only explicit user attachments and accounts for their size", () => {
    const thread = {
      messages: [
        {
          role: "user",
          content: "总结",
          sources: [{ id: "file", title: "附加文档", text: "文档证据", source: "notes/a.md" }],
        },
      ],
    } as ChatThread;
    expect(boundedMessages(thread, "规则").messages[1].content).toContain("文档证据");
    expect(() => boundedMessages(thread, "规则", 10)).toThrow("过长");
  });
});
