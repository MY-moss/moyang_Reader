import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAppSettingsSnapshot, serializeAppSettings } from "./app-settings";
import { defaultReaderPreferences } from "./preferences";
import { useSettingsLifecycle, type SettingsLifecycleOptions } from "./settings-lifecycle";

const reactGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

function SettingsHarness({ options = {} }: { options?: SettingsLifecycleOptions }) {
  const settings = useSettingsLifecycle(options);
  const [flushResult, setFlushResult] = useState("");

  return (
    <div>
      <output
        data-theme={settings.theme}
        data-locale={settings.locale}
        data-scale={settings.preferences.readingScale}
        data-sidebar-collapsed={String(settings.sidebarCollapsed)}
        data-pane-width={String(settings.paneWidths.sidebar)}
        data-status={settings.settingsPersistenceStatus}
        data-flush={flushResult}
      />
      <button
        type="button"
        data-update
        onClick={() => settings.setPreferences((current) => ({ ...current, readingScale: "large" }))}
      >
        更新设置
      </button>
      <button
        type="button"
        data-flush-button
        onClick={() => void settings.flushAppSettings().then((value) => setFlushResult(String(value)))}
      >
        保存设置
      </button>
    </div>
  );
}

function renderHarness(options: SettingsLifecycleOptions = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<SettingsHarness options={options} />);
  });
  return { container, root };
}

beforeEach(() => {
  reactGlobal.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  delete reactGlobal.IS_REACT_ACT_ENVIRONMENT;
  vi.restoreAllMocks();
});

describe("settings lifecycle", () => {
  it("loads the consolidated local snapshot and persists state changes", () => {
    const snapshot = createAppSettingsSnapshot(
      {
        preferences: { ...defaultReaderPreferences, readingScale: "small" },
        theme: "ink",
        locale: "en-US",
        sidebarCollapsed: true,
        rightPanelOpen: false,
        activeContextTab: "properties",
        paneWidths: { sidebar: 280, context: 360 },
      },
      123,
    );
    localStorage.setItem("moyang-reader-app-settings", serializeAppSettings(snapshot));

    const { container, root } = renderHarness();
    const output = container.querySelector("output")!;

    expect(output.dataset.theme).toBe("ink");
    expect(output.dataset.locale).toBe("en-US");
    expect(output.dataset.scale).toBe("small");
    expect(output.dataset.sidebarCollapsed).toBe("true");
    expect(output.dataset.paneWidth).toBe("280");
    expect(output.dataset.status).toBe("saved");

    act(() => container.querySelector<HTMLButtonElement>("[data-update]")?.click());

    expect(output.dataset.scale).toBe("large");
    expect(JSON.parse(localStorage.getItem("moyang-reader-app-settings")!).preferences.readingScale).toBe("large");

    act(() => root.unmount());
  });

  it("restores a newer native snapshot before exposing the ready state", async () => {
    const nativeSnapshot = createAppSettingsSnapshot(
      {
        preferences: { ...defaultReaderPreferences, readingScale: "large" },
        theme: "porcelain",
        locale: "zh-CN",
        sidebarCollapsed: true,
        rightPanelOpen: true,
        activeContextTab: "outline",
        paneWidths: { sidebar: 300, context: 400 },
      },
      456,
    );
    const readNative = vi.fn().mockResolvedValue(serializeAppSettings(nativeSnapshot));
    const { container, root } = renderHarness({ isNative: true, readNative });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const output = container.querySelector("output")!;
    expect(readNative).toHaveBeenCalledOnce();
    expect(output.dataset.theme).toBe("porcelain");
    expect(output.dataset.locale).toBe("zh-CN");
    expect(output.dataset.scale).toBe("large");
    expect(output.dataset.sidebarCollapsed).toBe("true");
    expect(output.dataset.paneWidth).toBe("300");

    act(() => root.unmount());
  });

  it("flushes pending native persistence when requested", async () => {
    const writeNative = vi.fn().mockResolvedValue(undefined);
    const { container, root } = renderHarness({
      isNative: true,
      readNative: vi.fn().mockResolvedValue(null),
      writeNative,
      debounceMs: 1000,
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => container.querySelector<HTMLButtonElement>("[data-update]")?.click());
    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-flush-button]")?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(writeNative).toHaveBeenCalled();
    expect(container.querySelector("output")?.dataset.flush).toBe("true");

    act(() => root.unmount());
  });

  it("flushes pending native persistence when unmounted", async () => {
    const writeNative = vi.fn().mockResolvedValue(undefined);
    const { root } = renderHarness({
      isNative: true,
      readNative: vi.fn().mockResolvedValue(null),
      writeNative,
      debounceMs: 1000,
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => root.unmount());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(writeNative).toHaveBeenCalled();
  });
});
