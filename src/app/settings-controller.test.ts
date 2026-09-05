import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppSettingsSnapshot, serializeAppSettings, type AppSettingsInput } from "./app-settings";
import {
  createSettingsController,
  loadInitialAppSettings,
  type SettingsPersistenceStatus,
} from "./settings-controller";
import { defaultReaderPreferences } from "./preferences";

const input: AppSettingsInput = {
  preferences: { ...defaultReaderPreferences, readingScale: "large" },
  theme: "dark",
  locale: "en-US",
  sidebarCollapsed: true,
  rightPanelOpen: false,
  activeContextTab: "properties",
  paneWidths: { sidebar: 280, context: 360 },
};

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("settings controller", () => {
  it("loads the consolidated snapshot before legacy defaults", () => {
    const snapshot = createAppSettingsSnapshot(input, 123);
    localStorage.setItem("moyang-reader-app-settings", serializeAppSettings(snapshot));
    localStorage.setItem("moyang-reader-theme", "light");

    expect(loadInitialAppSettings()).toMatchObject({
      storedSnapshot: snapshot,
      theme: "dark",
      locale: "en-US",
      preferences: input.preferences,
    });
  });

  it("falls back safely when the consolidated snapshot is corrupted", () => {
    localStorage.setItem("moyang-reader-app-settings", "not-json");
    localStorage.setItem("moyang-reader-theme", "light");

    const initial = loadInitialAppSettings();

    expect(initial.storedSnapshot).toBeNull();
    expect(initial.theme).toBe("light");
    expect(initial.preferences).toEqual(defaultReaderPreferences);
  });

  it("ignores a corrupted native snapshot without blocking startup", async () => {
    const controller = createSettingsController({
      isNative: true,
      readNative: vi.fn().mockResolvedValue("not-json"),
    });

    await expect(controller.readNativeSettings(null)).resolves.toEqual({
      snapshot: null,
      status: "invalid",
    });
  });

  it("accepts a newer native snapshot over the local copy", async () => {
    const localSnapshot = createAppSettingsSnapshot(input, 123);
    const nativeSnapshot = createAppSettingsSnapshot({ ...input, theme: "light" }, 456);
    const controller = createSettingsController({
      isNative: true,
      readNative: vi.fn().mockResolvedValue(serializeAppSettings(nativeSnapshot)),
    });

    await expect(controller.readNativeSettings(localSnapshot)).resolves.toEqual({
      snapshot: nativeSnapshot,
      status: "accepted",
    });
  });

  it("writes locally first, then debounces the native settings write", async () => {
    vi.useFakeTimers();
    const writeNative = vi.fn().mockResolvedValue(undefined);
    const statuses: SettingsPersistenceStatus[] = [];
    const controller = createSettingsController({
      isNative: true,
      writeNative,
      onStatus: (status) => statuses.push(status),
    });

    const result = controller.persist(input);
    expect(result.localSaved).toBe(true);
    expect(writeNative).not.toHaveBeenCalled();
    expect(statuses.at(-1)).toBe("saving");

    await vi.advanceTimersByTimeAsync(220);
    await expect(controller.flush()).resolves.toBe(true);

    expect(writeNative).toHaveBeenCalledOnce();
    expect(statuses.at(-1)).toBe("saved");
    expect(localStorage.getItem("moyang-reader-app-settings")).toBe(serializeAppSettings(result.snapshot));
  });

  it("reports native write failure while retaining the local snapshot", async () => {
    const statuses: SettingsPersistenceStatus[] = [];
    const controller = createSettingsController({
      isNative: true,
      writeNative: vi.fn().mockRejectedValue(new Error("disk full")),
      onStatus: (status) => statuses.push(status),
    });

    controller.persist(input);

    await expect(controller.flush()).resolves.toBe(false);
    expect(statuses.at(-1)).toBe("fallback");
    expect(localStorage.getItem("moyang-reader-app-settings")).not.toBeNull();
  });
});
