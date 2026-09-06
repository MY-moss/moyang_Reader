import { isTauriRuntime, readAppSettings, writeAppSettings } from "./bridge";
import {
  createAppSettingsSnapshot,
  loadAppSettingsSnapshot,
  parseAppSettings,
  saveAppSettingsSnapshot,
  serializeAppSettings,
  type AppSettingsInput,
  type AppSettingsSnapshot,
  type LocalSettingsSaveResult,
  type SettingsPersistenceStatus,
} from "./app-settings";
import { loadLocale } from "./i18n";
import { loadReaderPreferences, type ReaderPreferences } from "./preferences";
import { loadContextPanelOpen, loadContextPanelTab, loadPaneWidths, loadSidebarCollapsed } from "./storage";
import type { ThemeMode } from "./types";

export type { SettingsPersistenceStatus } from "./app-settings";

export type InitialAppSettings = AppSettingsInput & {
  storedSnapshot: AppSettingsSnapshot | null;
};

export type NativeSettingsReadResult = {
  snapshot: AppSettingsSnapshot | null;
  status: "empty" | "invalid" | "older" | "accepted" | "unavailable";
};

export type SettingsPersistResult = {
  snapshot: AppSettingsSnapshot;
  localSaved: boolean;
};

export type SettingsControllerOptions = {
  isNative?: boolean;
  readNative?: () => Promise<string | null>;
  writeNative?: (contents: string) => Promise<void>;
  saveLocal?: (input: AppSettingsInput, savedAt?: number) => LocalSettingsSaveResult;
  onStatus?: (status: SettingsPersistenceStatus) => void;
  schedule?: (callback: () => void, delay: number) => number;
  clearSchedule?: (timer: number) => void;
  debounceMs?: number;
};

export type SettingsController = {
  readNativeSettings: (storedSnapshot: AppSettingsSnapshot | null) => Promise<NativeSettingsReadResult>;
  persist: (input: AppSettingsInput) => SettingsPersistResult;
  flush: () => Promise<boolean>;
  dispose: () => void;
};

type PendingNativeWrite = {
  snapshot: AppSettingsSnapshot;
  localSaved: boolean;
};

function readSavedTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem("moyang-reader-theme");
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  } catch {
    return "system";
  }
}

function settingsInputFromSnapshot(snapshot: AppSettingsSnapshot): AppSettingsInput {
  return {
    preferences: { ...snapshot.preferences },
    theme: snapshot.theme,
    locale: snapshot.locale,
    sidebarCollapsed: snapshot.sidebarCollapsed,
    rightPanelOpen: snapshot.rightPanelOpen,
    activeContextTab: snapshot.activeContextTab,
    paneWidths: { ...snapshot.paneWidths },
  };
}

export function loadInitialAppSettings(): InitialAppSettings {
  const storedSnapshot = loadAppSettingsSnapshot();
  if (storedSnapshot) {
    return { ...settingsInputFromSnapshot(storedSnapshot), storedSnapshot };
  }

  const preferences: ReaderPreferences = loadReaderPreferences();
  return {
    storedSnapshot: null,
    preferences: { ...preferences },
    theme: readSavedTheme(),
    locale: loadLocale(),
    sidebarCollapsed: loadSidebarCollapsed(),
    rightPanelOpen: loadContextPanelOpen(),
    activeContextTab: loadContextPanelTab(),
    paneWidths: loadPaneWidths(),
  };
}

export function resolveNativeAppSettings(
  serialized: string | null,
  storedSnapshot: AppSettingsSnapshot | null,
): NativeSettingsReadResult {
  if (!serialized) return { snapshot: null, status: "empty" };

  const nativeSnapshot = parseAppSettings(serialized);
  if (!nativeSnapshot) return { snapshot: null, status: "invalid" };
  if (storedSnapshot && nativeSnapshot.savedAt <= storedSnapshot.savedAt) {
    return { snapshot: null, status: "older" };
  }
  return { snapshot: nativeSnapshot, status: "accepted" };
}

export function createSettingsController(options: SettingsControllerOptions = {}): SettingsController {
  const native = options.isNative ?? isTauriRuntime();
  const readNative = options.readNative ?? readAppSettings;
  const writeNative = options.writeNative ?? writeAppSettings;
  const saveLocal = options.saveLocal ?? saveAppSettingsSnapshot;
  const onStatus = options.onStatus ?? (() => undefined);
  const schedule = options.schedule ?? ((callback, delay) => window.setTimeout(callback, delay));
  const clearSchedule = options.clearSchedule ?? ((timer) => window.clearTimeout(timer));
  const debounceMs = options.debounceMs ?? 220;

  let nativeWriteQueue: Promise<void> = Promise.resolve();
  let pendingNativeWrite: PendingNativeWrite | null = null;
  let scheduledTimer: number | null = null;
  let lastNativeWrite: Promise<boolean> = Promise.resolve(true);
  let writeRevision = 0;

  const clearScheduledWrite = () => {
    if (scheduledTimer === null) return;
    clearSchedule(scheduledTimer);
    scheduledTimer = null;
  };

  const enqueueNativeWrite = (pending: PendingNativeWrite): Promise<boolean> => {
    const revision = ++writeRevision;
    const nativeWrite = nativeWriteQueue
      .catch(() => undefined)
      .then(() => writeNative(serializeAppSettings(pending.snapshot)));
    const result = nativeWrite.then(
      () => {
        if (revision === writeRevision) onStatus(pending.localSaved ? "saved" : "fallback");
        return true;
      },
      () => {
        if (revision === writeRevision) onStatus(pending.localSaved ? "fallback" : "error");
        return false;
      },
    );
    nativeWriteQueue = result.then(() => undefined);
    lastNativeWrite = result;
    return result;
  };

  const schedulePendingNativeWrite = (pending: PendingNativeWrite, delay: number) => {
    clearScheduledWrite();
    pendingNativeWrite = pending;
    scheduledTimer = schedule(() => {
      scheduledTimer = null;
      const current = pendingNativeWrite;
      pendingNativeWrite = null;
      if (current) void enqueueNativeWrite(current);
    }, delay);
  };

  return {
    async readNativeSettings(storedSnapshot) {
      if (!native) return { snapshot: null, status: "unavailable" };

      try {
        return resolveNativeAppSettings(await readNative(), storedSnapshot);
      } catch {
        return { snapshot: null, status: "unavailable" };
      }
    },

    persist(input) {
      const snapshot = createAppSettingsSnapshot(input);
      let localResult: LocalSettingsSaveResult;
      try {
        localResult = saveLocal(input, snapshot.savedAt);
      } catch {
        localResult = { ok: false, reason: "本机设置存储不可用。" };
      }

      if (!native) {
        onStatus(localResult.ok ? "saved" : "error");
        return { snapshot, localSaved: localResult.ok };
      }

      schedulePendingNativeWrite({ snapshot, localSaved: localResult.ok }, localResult.ok ? debounceMs : 0);
      onStatus("saving");
      return { snapshot, localSaved: localResult.ok };
    },

    flush() {
      if (!native) return Promise.resolve(true);

      clearScheduledWrite();
      const pending = pendingNativeWrite;
      pendingNativeWrite = null;
      if (pending) return enqueueNativeWrite(pending);
      return lastNativeWrite;
    },

    dispose() {
      clearScheduledWrite();
      const pending = pendingNativeWrite;
      pendingNativeWrite = null;
      if (native && pending) void enqueueNativeWrite(pending);
    },
  };
}
