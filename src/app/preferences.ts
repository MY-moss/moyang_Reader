export type ReaderPreferences = {
  allowRemoteResources: boolean;
  startupUpdateCheck: boolean;
};

export const defaultReaderPreferences: ReaderPreferences = {
  allowRemoteResources: false,
  startupUpdateCheck: false,
};

const readerPreferencesKey = "moyang-reader-preferences";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function loadReaderPreferences(): ReaderPreferences {
  try {
    const raw = localStorage.getItem(readerPreferencesKey);
    if (!raw) return defaultReaderPreferences;

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return defaultReaderPreferences;

    return {
      allowRemoteResources:
        typeof parsed.allowRemoteResources === "boolean"
          ? parsed.allowRemoteResources
          : defaultReaderPreferences.allowRemoteResources,
      startupUpdateCheck:
        typeof parsed.startupUpdateCheck === "boolean"
          ? parsed.startupUpdateCheck
          : defaultReaderPreferences.startupUpdateCheck,
    };
  } catch {
    return defaultReaderPreferences;
  }
}

export function saveReaderPreferences(preferences: ReaderPreferences): void {
  try {
    localStorage.setItem(readerPreferencesKey, JSON.stringify(preferences));
  } catch {
    // Local storage may be unavailable in a restricted browser preview.
  }
}
