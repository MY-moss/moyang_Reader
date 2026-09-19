import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Update } from "@tauri-apps/plugin-updater";

const {
  isTauriRuntime,
  checkForAppUpdate,
  describeUpdateError,
  getCurrentAppVersion,
  installAppUpdate,
  relaunchApp,
  updateActionForStatus,
  recordDiagnosticError,
  clearUpdateRecovery,
  formatUpdateRecoveryNotice,
  loadUpdateRecovery,
  saveUpdateRecovery,
} = vi.hoisted(() => ({
  isTauriRuntime: vi.fn(),
  checkForAppUpdate: vi.fn(),
  describeUpdateError: vi.fn(),
  getCurrentAppVersion: vi.fn(),
  installAppUpdate: vi.fn(),
  relaunchApp: vi.fn(),
  updateActionForStatus: vi.fn(),
  recordDiagnosticError: vi.fn(),
  clearUpdateRecovery: vi.fn(),
  formatUpdateRecoveryNotice: vi.fn(),
  loadUpdateRecovery: vi.fn(),
  saveUpdateRecovery: vi.fn(),
}));

vi.mock("./bridge", () => ({ isTauriRuntime }));
vi.mock("./updater", () => ({
  checkForAppUpdate,
  describeUpdateError,
  getCurrentAppVersion,
  installAppUpdate,
  relaunchApp,
  updateActionForStatus,
}));
vi.mock("./diagnostics", () => ({ recordDiagnosticError }));
vi.mock("./update-recovery", () => ({
  clearUpdateRecovery,
  formatUpdateRecoveryNotice,
  loadUpdateRecovery,
  saveUpdateRecovery,
}));

import { useUpdateController } from "./update-controller";

type UpdateHarnessProps = {
  startupUpdateCheck?: boolean;
};

function UpdateHarness({ startupUpdateCheck = false }: UpdateHarnessProps) {
  const [locale] = useState<"zh-CN">("zh-CN");
  const controller = useUpdateController({ locale, startupUpdateCheck });

  return (
    <div>
      <button type="button" data-action onClick={controller.handleUpdateAction}>
        更新
      </button>
      <button type="button" data-check onClick={() => void controller.checkForUpdates(true)}>
        检查
      </button>
      <button type="button" data-install onClick={() => void controller.installUpdate()}>
        安装
      </button>
      <button type="button" data-relaunch onClick={() => void controller.relaunchUpdatedApp()}>
        重启
      </button>
      <button type="button" data-hide onClick={controller.hideUpdateNotice}>
        隐藏
      </button>
      <button type="button" data-dismiss onClick={controller.dismissUpdateNotice}>
        关闭
      </button>
      <output
        data-status={controller.updateStatus}
        data-version={controller.currentVersion ?? ""}
        data-available-version={controller.availableUpdate?.version ?? ""}
        data-progress={controller.updateProgress === null ? "" : String(controller.updateProgress)}
        data-error={controller.updateError ?? ""}
        data-visible={String(controller.updateNoticeVisible)}
      />
    </div>
  );
}

function renderHarness(props: UpdateHarnessProps = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<UpdateHarness {...props} />);
  });
  return { container, root };
}

function createUpdate(): Update {
  return {
    version: "0.12.0",
    body: "Release notes",
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as Update;
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.clearAllMocks();
  isTauriRuntime.mockReturnValue(true);
  checkForAppUpdate.mockResolvedValue(null);
  describeUpdateError.mockImplementation(
    (cause: unknown) => `mapped:${cause instanceof Error ? cause.message : "error"}`,
  );
  getCurrentAppVersion.mockResolvedValue("0.11.0");
  installAppUpdate.mockResolvedValue(undefined);
  relaunchApp.mockResolvedValue(undefined);
  updateActionForStatus.mockImplementation((status: string) =>
    status === "available" || status === "downloading" || status === "ready" ? "open" : "check",
  );
  loadUpdateRecovery.mockReturnValue(null);
  formatUpdateRecoveryNotice.mockReturnValue("recovery notice");
});

describe("update controller", () => {
  it("protects browser preview from native update operations", async () => {
    isTauriRuntime.mockReturnValue(false);
    const { container, root } = renderHarness();

    act(() => container.querySelector<HTMLButtonElement>("[data-action]")?.click());

    expect(container.querySelector("output")?.dataset.status).toBe("error");
    expect(container.querySelector("output")?.dataset.visible).toBe("true");
    expect(checkForAppUpdate).not.toHaveBeenCalled();

    act(() => root.unmount());
  });

  it("loads an incomplete previous update and clears recovery after the same version succeeds", async () => {
    loadUpdateRecovery.mockReturnValue({
      attemptedVersion: "0.12.0",
      currentVersion: "0.11.0",
      failedAt: 123,
      reason: "网络中断",
    });
    const { container, root } = renderHarness();
    await flushEffects();

    expect(container.querySelector("output")?.dataset.status).toBe("error");
    expect(container.querySelector("output")?.dataset.error).toBe("recovery notice");
    expect(formatUpdateRecoveryNotice).toHaveBeenCalledOnce();

    getCurrentAppVersion.mockResolvedValue("0.12.0");
    act(() => root.unmount());
    const second = renderHarness();
    await flushEffects();
    expect(clearUpdateRecovery).toHaveBeenCalledOnce();
    act(() => second.root.unmount());
  });

  it("checks on demand, exposes progress, and closes the update before relaunch", async () => {
    const update = createUpdate();
    checkForAppUpdate.mockResolvedValue(update);
    installAppUpdate.mockImplementation(async (_pending: Update, onEvent: (event: unknown) => void) => {
      onEvent({ event: "Started", data: { contentLength: 100 } });
      onEvent({ event: "Progress", data: { chunkLength: 25 } });
      onEvent({ event: "Finished", data: {} });
    });
    const { container, root } = renderHarness();

    act(() => container.querySelector<HTMLButtonElement>("[data-action]")?.click());
    await flushEffects();
    expect(container.querySelector("output")?.dataset.status).toBe("available");
    expect(container.querySelector("output")?.dataset.availableVersion).toBe("0.12.0");

    act(() => container.querySelector<HTMLButtonElement>("[data-install]")?.click());
    await flushEffects();
    expect(container.querySelector("output")?.dataset.status).toBe("ready");
    expect(container.querySelector("output")?.dataset.progress).toBe("1");
    expect(update.close).toHaveBeenCalledOnce();

    act(() => container.querySelector<HTMLButtonElement>("[data-relaunch]")?.click());
    await flushEffects();
    expect(relaunchApp).toHaveBeenCalledOnce();

    act(() => root.unmount());
  });

  it("shows an explicit up-to-date result for a manual check", async () => {
    const { container, root } = renderHarness();

    act(() => container.querySelector<HTMLButtonElement>("[data-check]")?.click());
    await flushEffects();

    expect(checkForAppUpdate).toHaveBeenCalledOnce();
    expect(container.querySelector("output")?.dataset.status).toBe("up-to-date");
    expect(container.querySelector("output")?.dataset.visible).toBe("true");

    act(() => root.unmount());
  });

  it("records a failed install as recoverable update state", async () => {
    const update = createUpdate();
    checkForAppUpdate.mockResolvedValue(update);
    installAppUpdate.mockRejectedValue(new Error("network"));
    const { container, root } = renderHarness();

    act(() => container.querySelector<HTMLButtonElement>("[data-check]")?.click());
    await flushEffects();
    act(() => container.querySelector<HTMLButtonElement>("[data-install]")?.click());
    await flushEffects();

    expect(container.querySelector("output")?.dataset.status).toBe("error");
    expect(container.querySelector("output")?.dataset.error).toBe("mapped:network");
    expect(saveUpdateRecovery).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptedVersion: "0.12.0",
        currentVersion: "0.11.0",
        reason: "mapped:network",
      }),
    );
    expect(recordDiagnosticError).toHaveBeenCalled();

    act(() => root.unmount());
  });

  it("runs the optional startup check after the configured delay", async () => {
    vi.useFakeTimers();
    const { container, root } = renderHarness({ startupUpdateCheck: true });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_200);
    });
    await flushEffects();

    expect(checkForAppUpdate).toHaveBeenCalledOnce();
    expect(container.querySelector("output")?.dataset.status).toBe("idle");

    act(() => root.unmount());
  });
});
