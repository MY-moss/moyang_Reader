import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";

import { isTauriRuntime } from "./bridge";
import {
  createSettingsController,
  loadInitialAppSettings,
  type SettingsControllerOptions,
  type SettingsPersistenceStatus,
} from "./settings-controller";
import type { ReaderPreferences } from "./preferences";
import type { Locale } from "./i18n";
import { saveContextPanelOpen, saveContextPanelTab, savePaneWidths, saveSidebarCollapsed } from "./storage";
import type { PaneWidths } from "./pane-layout";
import type { ContextPanelTab, ThemeMode } from "./types";

export type SettingsLifecycleOptions = Pick<
  SettingsControllerOptions,
  "isNative" | "readNative" | "writeNative" | "saveLocal" | "schedule" | "clearSchedule" | "debounceMs"
>;

export type SettingsLifecycle = {
  preferences: ReaderPreferences;
  setPreferences: Dispatch<SetStateAction<ReaderPreferences>>;
  theme: ThemeMode;
  setTheme: Dispatch<SetStateAction<ThemeMode>>;
  locale: Locale;
  setLocale: Dispatch<SetStateAction<Locale>>;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  rightPanelOpen: boolean;
  setRightPanelOpen: Dispatch<SetStateAction<boolean>>;
  activeContextTab: ContextPanelTab;
  setActiveContextTab: Dispatch<SetStateAction<ContextPanelTab>>;
  paneWidths: PaneWidths;
  setPaneWidths: Dispatch<SetStateAction<PaneWidths>>;
  preferencesRef: MutableRefObject<ReaderPreferences>;
  paneWidthsRef: MutableRefObject<PaneWidths>;
  settingsPersistenceStatus: SettingsPersistenceStatus;
  flushAppSettings: () => Promise<boolean>;
};

export function useSettingsLifecycle(options: SettingsLifecycleOptions = {}): SettingsLifecycle {
  const [initialAppSettings] = useState(loadInitialAppSettings);
  const storedAppSettings = initialAppSettings.storedSnapshot;
  const nativeRuntime = options.isNative ?? isTauriRuntime();
  const [theme, setTheme] = useState<ThemeMode>(() => initialAppSettings.theme);
  const [locale, setLocale] = useState(() => initialAppSettings.locale);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => initialAppSettings.sidebarCollapsed);
  const [rightPanelOpen, setRightPanelOpen] = useState(() => initialAppSettings.rightPanelOpen);
  const [activeContextTab, setActiveContextTab] = useState<ContextPanelTab>(() => initialAppSettings.activeContextTab);
  const [paneWidths, setPaneWidths] = useState(() => initialAppSettings.paneWidths);
  const [preferences, setPreferences] = useState<ReaderPreferences>(() => initialAppSettings.preferences);
  const [settingsPersistenceStatus, setSettingsPersistenceStatus] = useState<SettingsPersistenceStatus>("idle");
  const [settingsController] = useState(() =>
    createSettingsController({
      ...options,
      isNative: nativeRuntime,
      onStatus: setSettingsPersistenceStatus,
    }),
  );
  const [nativeSettingsReady, setNativeSettingsReady] = useState(() => !nativeRuntime);
  const preferencesRef = useRef(preferences);
  const paneWidthsRef = useRef(paneWidths);
  const flushAppSettings = useCallback(() => settingsController.flush(), [settingsController]);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    paneWidthsRef.current = paneWidths;
  }, [paneWidths]);

  useEffect(() => {
    if (!nativeRuntime) return;

    let active = true;
    void settingsController
      .readNativeSettings(storedAppSettings)
      .then(({ snapshot: nativeSnapshot }) => {
        if (!active) return;
        if (nativeSnapshot) {
          preferencesRef.current = nativeSnapshot.preferences;
          setPreferences(nativeSnapshot.preferences);
          setTheme(nativeSnapshot.theme);
          setLocale(nativeSnapshot.locale);
          setSidebarCollapsed(nativeSnapshot.sidebarCollapsed);
          setRightPanelOpen(nativeSnapshot.rightPanelOpen);
          setActiveContextTab(nativeSnapshot.activeContextTab);
          paneWidthsRef.current = nativeSnapshot.paneWidths;
          setPaneWidths(nativeSnapshot.paneWidths);
        }
        setNativeSettingsReady(true);
      })
      .catch(() => {
        // Older installations may not have a native settings file yet. Legacy local storage remains usable.
        if (active) setNativeSettingsReady(true);
      });

    return () => {
      active = false;
    };
  }, [nativeRuntime, settingsController, storedAppSettings]);

  useEffect(() => {
    if (!nativeSettingsReady) return;

    settingsController.persist({
      preferences,
      theme,
      locale,
      sidebarCollapsed,
      rightPanelOpen,
      activeContextTab,
      paneWidths,
    });
  }, [
    activeContextTab,
    locale,
    nativeSettingsReady,
    paneWidths,
    preferences,
    rightPanelOpen,
    settingsController,
    sidebarCollapsed,
    theme,
  ]);

  useEffect(() => () => settingsController.dispose(), [settingsController]);

  useEffect(() => {
    saveSidebarCollapsed(sidebarCollapsed);
  }, [sidebarCollapsed]);

  useEffect(() => {
    saveContextPanelOpen(rightPanelOpen);
  }, [rightPanelOpen]);

  useEffect(() => {
    saveContextPanelTab(activeContextTab);
  }, [activeContextTab]);

  useEffect(() => {
    savePaneWidths(paneWidths);
  }, [paneWidths]);

  return {
    preferences,
    setPreferences,
    theme,
    setTheme,
    locale,
    setLocale,
    sidebarCollapsed,
    setSidebarCollapsed,
    rightPanelOpen,
    setRightPanelOpen,
    activeContextTab,
    setActiveContextTab,
    paneWidths,
    setPaneWidths,
    preferencesRef,
    paneWidthsRef,
    settingsPersistenceStatus,
    flushAppSettings,
  };
}
