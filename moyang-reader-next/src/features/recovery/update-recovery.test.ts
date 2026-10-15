import { afterEach, describe, expect, it } from "vitest";
import {
  clearUpdateRecovery,
  formatUpdateRecoveryNotice,
  loadUpdateRecovery,
  saveUpdateRecovery,
} from "./update-recovery";

afterEach(() => localStorage.clear());

describe("update recovery", () => {
  it("persists a failed update and explains the safe recovery path", () => {
    saveUpdateRecovery({
      attemptedVersion: "v0.8.0",
      currentVersion: "0.7.2",
      failedAt: 123,
      reason: "签名校验失败",
    });

    expect(loadUpdateRecovery()).toEqual({
      attemptedVersion: "v0.8.0",
      currentVersion: "0.7.2",
      failedAt: 123,
      reason: "签名校验失败",
    });
    expect(formatUpdateRecoveryNotice(loadUpdateRecovery()!)).toContain("不要降级安装");
  });

  it("clears recovery metadata after a later version is confirmed", () => {
    saveUpdateRecovery({ attemptedVersion: "0.8.0", currentVersion: "0.7.2", failedAt: 123, reason: "网络中断" });
    clearUpdateRecovery();
    expect(loadUpdateRecovery()).toBeNull();
  });
});
