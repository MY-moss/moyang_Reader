import type { ReadingScale, ReadingWidth } from "./types";

export type ReaderPreferences = {
  allowRemoteResources: boolean;
  startupUpdateCheck: boolean;
  readingScale: ReadingScale;
  readingWidth: ReadingWidth;
};

export const defaultReaderPreferences: ReaderPreferences = {
  allowRemoteResources: false,
  startupUpdateCheck: false,
  readingScale: "medium",
  readingWidth: "standard",
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
      readingScale:
        parsed.readingScale === "small" || parsed.readingScale === "large" || parsed.readingScale === "medium"
          ? parsed.readingScale
          : defaultReaderPreferences.readingScale,
      readingWidth:
        parsed.readingWidth === "narrow" || parsed.readingWidth === "wide" || parsed.readingWidth === "standard"
          ? parsed.readingWidth
          : defaultReaderPreferences.readingWidth,
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
