import { afterEach, describe, expect, it } from "vitest";
import {
  createAppSettingsSnapshot,
  hasLegacyAppSettings,
  hasStoredAppSettingsSnapshot,
  loadAppSettingsSnapshot,
  parseAppSettings,
  saveAppSettingsSnapshot,
  serializeAppSettings,
} from "./app-settings";
import { defaultReaderPreferences } from "./preferences";

const input = {
  preferences: { ...defaultReaderPreferences, readingScale: "large" as const },
  theme: "dark" as const,
  locale: "en-US" as const,
  sidebarCollapsed: true,
  rightPanelOpen: false,
  activeContextTab: "properties" as const,
  paneWidths: { sidebar: 280, context: 360 },
};

afterEach(() => localStorage.clear());

describe("consolidated app settings", () => {
  it("round-trips preferences and layout state", () => {
    const snapshot = createAppSettingsSnapshot(input, 123);

    expect(parseAppSettings(serializeAppSettings(snapshot))).toEqual(snapshot);
  });

  it("uses safe defaults for unsupported values", () => {
    const parsed = parseAppSettings(
      JSON.stringify({
        format: "moyang-reader-app-settings",
        version: 1,
        preferences: { readingScale: "unknown" },
        theme: "sepia",
        locale: "fr-FR",
        sidebarCollapsed: "yes",
        rightPanelOpen: false,
        activeContextTab: "unknown",
        paneWidths: { sidebar: 2, context: 9999 },
      }),
    );

    expect(parsed?.preferences).toEqual(defaultReaderPreferences);
    expect(parsed?.theme).toBe("system");
    expect(parsed?.locale).toBe("zh-CN");
    expect(parsed?.sidebarCollapsed).toBe(false);
    expect(parsed?.rightPanelOpen).toBe(false);
    expect(parsed?.activeContextTab).toBe("outline");
    expect(parsed?.paneWidths).toEqual({ sidebar: 220, context: 440 });
  });

  it("only treats a valid consolidated snapshot as stored", () => {
    localStorage.setItem("moyang-reader-app-settings", "not-json");
    expect(hasStoredAppSettingsSnapshot()).toBe(false);
    expect(loadAppSettingsSnapshot()).toBeNull();

    localStorage.setItem("moyang-reader-preferences", JSON.stringify(defaultReaderPreferences));
    expect(hasLegacyAppSettings()).toBe(true);
  });

  it("reports a write failure instead of claiming settings were saved", () => {
    const storagePrototype = Object.getPrototypeOf(localStorage);
    const originalSetItem = storagePrototype.setItem;
    Object.defineProperty(storagePrototype, "setItem", {
      configurable: true,
      value: () => {
        throw new Error("storage disabled");
      },
    });

    try {
      const result = saveAppSettingsSnapshot(input, 456);
      expect(result.ok).toBe(false);
    } finally {
      Object.defineProperty(storagePrototype, "setItem", { configurable: true, value: originalSetItem });
    }
  });
});
