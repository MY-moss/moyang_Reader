import { describe, expect, it } from "vitest";

import { normalizeExternalUrl } from "./external-url";

describe("normalizeExternalUrl", () => {
  it.each([
    ["https://example.com/path", "https://example.com/path"],
    ["http://example.com", "http://example.com/"],
    ["mailto:user@example.com", "mailto:user@example.com"],
    ["tel:+8613800138000", "tel:+8613800138000"],
    ["//example.com/path", "https://example.com/path"],
  ])("allows supported external links", (input, expected) => {
    expect(normalizeExternalUrl(input)).toBe(expected);
  });

  it.each(["javascript:alert(1)", "data:text/html,boom", "file:///C:/secret.txt", "ftp://example.com/a"])(
    "rejects unsupported protocols",
    (input) => {
      expect(() => normalizeExternalUrl(input)).toThrow(/不支持的外部链接协议/);
    },
  );

  it("rejects malformed and empty values", () => {
    expect(() => normalizeExternalUrl("  ")).toThrow(/不能为空/);
    expect(() => normalizeExternalUrl("not a url")).toThrow(/格式无效/);
  });

  it("rejects credentials embedded in web urls", () => {
    expect(() => normalizeExternalUrl("https://user:secret@example.com/path")).toThrow(/用户名或密码/);
  });
});
