import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useAppUpdates } from "./useAppUpdates";
import { installAppUpdate } from "../platform/updater";
vi.mock("../platform/bridge", () => ({ isTauriRuntime: () => false }));
vi.mock("../platform/updater", () => ({ installAppUpdate: vi.fn(async () => undefined) }));

it("can download an available update after deferring its notice", async () => {
  const pending = { version: "0.14.0", close: vi.fn(async () => undefined) };
  const setAvailableUpdate = vi.fn(),
    setUpdateStatus = vi.fn(),
    setUpdateNoticeVisible = vi.fn();
  const input = {
    updateRef: { current: pending },
    updateCheckInFlightRef: { current: false },
    setAvailableUpdate,
    setUpdateStatus,
    setUpdateNoticeVisible,
    setUpdateError: vi.fn(),
    setUpdateProgress: vi.fn(),
    setCurrentVersion: vi.fn(),
    currentVersion: "0.13.0",
    initialStartupUpdateCheckRef: { current: false },
    documentCacheRef: { current: { remove: vi.fn() } },
    browserDocumentsRef: { current: new Map() },
    previewUrlsRef: { current: new Map() },
  };
  let api!: ReturnType<typeof useAppUpdates>;
  function Harness() {
    api = useAppUpdates(input as unknown as Parameters<typeof useAppUpdates>[0]);
    return null;
  }
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => root.render(<Harness />));
    act(() => api.dismissUpdateNotice());
    expect(setUpdateNoticeVisible).toHaveBeenCalledWith(false);
    expect(pending.close).not.toHaveBeenCalled();
    expect(setAvailableUpdate).not.toHaveBeenCalled();
    await act(async () => api.installUpdate());
    expect(installAppUpdate).toHaveBeenCalledWith(pending, expect.any(Function));
    expect(setUpdateStatus).toHaveBeenLastCalledWith("ready");
  } finally {
    await act(async () => root.unmount());
  }
});
