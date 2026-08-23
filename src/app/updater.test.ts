import { describe, expect, it } from "vitest";
import { describeUpdateError } from "./updater";

describe("update error messages", () => {
  it("explains signature failures without exposing implementation details", () => {
    expect(describeUpdateError(new Error("signature verification failed"))).toContain("签名校验失败");
  });

  it("maps network failures to a retryable message", () => {
    expect(describeUpdateError(new Error("request timeout"))).toContain("检查网络");
  });

  it("keeps an unknown error readable", () => {
    expect(describeUpdateError(new Error("unexpected failure"))).toBe("更新失败：unexpected failure");
  });
});
