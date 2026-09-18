import { describe, expect, it, vi } from "vitest";

const { isTauriRuntime, check, relaunch } = vi.hoisted(() => ({
  isTauriRuntime: vi.fn(),
  check: vi.fn(),
  relaunch: vi.fn(),
}));

vi.mock("./bridge", () => ({ isTauriRuntime }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch }));

import type { Update } from "@tauri-apps/plugin-updater";
import {
  checkForAppUpdate,
  describeUpdateError,
  installAppUpdate,
  relaunchApp,
  updateActionForStatus,
} from "./updater";

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

describe("native update bridge", () => {
  beforeEach(() => {
    isTauriRuntime.mockReset();
    check.mockReset();
    relaunch.mockReset();
    isTauriRuntime.mockReturnValue(true);
    check.mockResolvedValue(null);
    relaunch.mockResolvedValue(undefined);
  });

  it("keeps check, download-and-install, and relaunch wired to the supported plugin APIs", async () => {
    const onEvent = vi.fn();
    const update = {
      downloadAndInstall: vi.fn().mockResolvedValue(undefined),
    } as unknown as Update;
    check.mockResolvedValue(update);

    await expect(checkForAppUpdate()).resolves.toBe(update);
    await installAppUpdate(update, onEvent);
    await relaunchApp();

    expect(check).toHaveBeenCalledWith({ timeout: 8_000 });
    expect(update.downloadAndInstall).toHaveBeenCalledWith(onEvent, { timeout: 10 * 60_000 });
    expect(relaunch).toHaveBeenCalledOnce();
  });

  it("does not invoke updater or process capabilities in browser preview mode", async () => {
    isTauriRuntime.mockReturnValue(false);

    await expect(checkForAppUpdate()).resolves.toBeNull();
    await relaunchApp();

    expect(check).not.toHaveBeenCalled();
    expect(relaunch).not.toHaveBeenCalled();
  });
});

describe("update error messages", () => {
  it("explains signature failures without exposing implementation details", () => {
    expect(
      describeUpdateError({ code: "UPDATE_SIGNATURE_INVALID", message: "signature verification failed" }),
    ).toContain("签名校验失败");
  });

  it("maps network failures to a retryable message", () => {
    expect(describeUpdateError({ code: "UPDATE_NETWORK_FAILED", message: "request timeout" })).toContain("检查网络");
  });

  it("keeps an unknown error readable", () => {
    expect(describeUpdateError(new Error("unexpected failure"))).toBe("更新失败：unexpected failure");
  });

  it("uses the selected locale for structured update failures", () => {
    expect(describeUpdateError({ code: "UPDATE_PERMISSION_DENIED", message: "permission denied" }, "en-US")).toContain(
      "system permission",
    );
  });
});
