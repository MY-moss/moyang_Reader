import type { Locale } from "./i18n";
import { DEFAULT_PANE_WIDTHS, normalizePaneWidths, type PaneWidths } from "./pane-layout";
import { defaultReaderPreferences, type ReaderPreferences } from "./preferences";
import type { ContextPanelTab, ThemeMode } from "./types";

const appSettingsKey = "moyang-reader-app-settings";
const appSettingsFormat = "moyang-reader-app-settings";
const appSettingsVersion = 1;

export type SettingsPersistenceStatus = "idle" | "saving" | "saved" | "fallback" | "error";

export type AppSettingsInput = {
  preferences: ReaderPreferences;
  theme: ThemeMode;
  locale: Locale;
  sidebarCollapsed: boolean;
  rightPanelOpen: boolean;
  activeContextTab: ContextPanelTab;
  paneWidths: PaneWidths;
};

export type AppSettingsSnapshot = AppSettingsInput & {
  format: typeof appSettingsFormat;
  version: typeof appSettingsVersion;
  savedAt: number;
};

export type LocalSettingsSaveResult = { ok: true; snapshot: AppSettingsSnapshot } | { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePreferences(value: unknown): ReaderPreferences {
  if (!isRecord(value)) return { ...defaultReaderPreferences };

  return {
    allowRemoteResources:
      typeof value.allowRemoteResources === "boolean"
        ? value.allowRemoteResources
        : defaultReaderPreferences.allowRemoteResources,
    startupUpdateCheck:
      typeof value.startupUpdateCheck === "boolean"
        ? value.startupUpdateCheck
        : defaultReaderPreferences.startupUpdateCheck,
    readingScale:
      value.readingScale === "small" || value.readingScale === "medium" || value.readingScale === "large"
        ? value.readingScale
        : defaultReaderPreferences.readingScale,
    readingWidth:
      value.readingWidth === "narrow" || value.readingWidth === "standard" || value.readingWidth === "wide"
        ? value.readingWidth
        : defaultReaderPreferences.readingWidth,
    exportPaper: value.exportPaper === "letter" || value.exportPaper === "a4" ? value.exportPaper : "a4",
    exportOrientation:
      value.exportOrientation === "landscape" || value.exportOrientation === "portrait"
        ? value.exportOrientation
        : "portrait",
    exportMargin:
      value.exportMargin === "compact" || value.exportMargin === "standard" || value.exportMargin === "wide"
        ? value.exportMargin
        : "standard",
  };
}

function parseSnapshot(value: unknown): AppSettingsSnapshot | null {
  if (!isRecord(value) || value.format !== appSettingsFormat || value.version !== appSettingsVersion) return null;

  const savedAt = typeof value.savedAt === "number" && Number.isFinite(value.savedAt) ? value.savedAt : 0;
  const activeContextTab =
    value.activeContextTab === "backlinks" || value.activeContextTab === "properties"
      ? value.activeContextTab
      : "outline";
  const theme = value.theme === "light" || value.theme === "dark" ? value.theme : "system";
  const locale = value.locale === "en-US" ? value.locale : "zh-CN";

  return {
    format: appSettingsFormat,
    version: appSettingsVersion,
    savedAt,
    preferences: parsePreferences(value.preferences),
    theme,
    locale,
    sidebarCollapsed: value.sidebarCollapsed === true,
    rightPanelOpen: value.rightPanelOpen !== false,
    activeContextTab,
    paneWidths: normalizePaneWidths(value.paneWidths ?? DEFAULT_PANE_WIDTHS),
  };
}

export function createAppSettingsSnapshot(input: AppSettingsInput, savedAt = Date.now()): AppSettingsSnapshot {
  return {
    format: appSettingsFormat,
    version: appSettingsVersion,
    savedAt,
    preferences: { ...input.preferences },
    theme: input.theme,
    locale: input.locale,
    sidebarCollapsed: input.sidebarCollapsed,
    rightPanelOpen: input.rightPanelOpen,
    activeContextTab: input.activeContextTab,
    paneWidths: normalizePaneWidths(input.paneWidths),
  };
}

export function serializeAppSettings(snapshot: AppSettingsSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export function parseAppSettings(serialized: string): AppSettingsSnapshot | null {
  try {
    return parseSnapshot(JSON.parse(serialized) as unknown);
  } catch {
    return null;
  }
}

export function loadAppSettingsSnapshot(): AppSettingsSnapshot | null {
  try {
    const raw = localStorage.getItem(appSettingsKey);
    return raw ? parseAppSettings(raw) : null;
  } catch {
    return null;
  }
}

export function hasStoredAppSettingsSnapshot(): boolean {
  return loadAppSettingsSnapshot() !== null;
}

/**
 * Detects settings written by versions before the consolidated snapshot existed.
 * A native fallback must not overwrite valid legacy values during the first upgrade.
 */
export function hasLegacyAppSettings(): boolean {
  const keys = [
    "moyang-reader-preferences",
    "moyang-reader-theme",
    "moyang-reader-locale",
    "moyang-reader-sidebar-collapsed",
    "moyang-reader-context-panel-open",
    "moyang-reader-context-panel-tab",
    "moyang-reader-pane-widths",
  ];

  try {
    return keys.some((key) => localStorage.getItem(key) !== null);
  } catch {
    return false;
  }
}

export function saveAppSettingsSnapshot(input: AppSettingsInput, savedAt = Date.now()): LocalSettingsSaveResult {
  const snapshot = createAppSettingsSnapshot(input, savedAt);
  const serialized = serializeAppSettings(snapshot);

  try {
    localStorage.setItem(appSettingsKey, serialized);
    if (localStorage.getItem(appSettingsKey) !== serialized) {
      return { ok: false, reason: "本机设置写入后校验失败。" };
    }
    return { ok: true, snapshot };
  } catch {
    return { ok: false, reason: "本机设置存储不可用。" };
  }
}
