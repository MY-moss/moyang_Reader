import { describe, expect, it } from "vitest";
import { describeUpdateError, updateActionForStatus } from "./updater";

describe("update toolbar actions", () => {
  it("reopens an existing update instead of discarding it", () => {
    expect(updateActionForStatus("available")).toBe("open");
    expect(updateActionForStatus("downloading")).toBe("open");
    expect(updateActionForStatus("ready")).toBe("open");
  });

  it("checks for a new update when there is no update to reopen", () => {
    expect(updateActionForStatus("idle")).toBe("check");
    expect(updateActionForStatus("checking")).toBe("check");
    expect(updateActionForStatus("error")).toBe("check");
    expect(updateActionForStatus("up-to-date")).toBe("check");
  });
});

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
