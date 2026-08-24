import type { ExportMargin, ExportOrientation, ExportPaper, ReadingScale, ReadingWidth } from "./types";

export type ReaderPreferences = {
  allowRemoteResources: boolean;
  startupUpdateCheck: boolean;
  readingScale: ReadingScale;
  readingWidth: ReadingWidth;
  exportPaper: ExportPaper;
  exportOrientation: ExportOrientation;
  exportMargin: ExportMargin;
};

export const defaultReaderPreferences: ReaderPreferences = {
  allowRemoteResources: false,
  startupUpdateCheck: false,
  readingScale: "medium",
  readingWidth: "standard",
  exportPaper: "a4",
  exportOrientation: "portrait",
  exportMargin: "standard",
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
      exportPaper:
        parsed.exportPaper === "letter" || parsed.exportPaper === "a4"
          ? parsed.exportPaper
          : defaultReaderPreferences.exportPaper,
      exportOrientation:
        parsed.exportOrientation === "landscape" || parsed.exportOrientation === "portrait"
          ? parsed.exportOrientation
          : defaultReaderPreferences.exportOrientation,
      exportMargin:
        parsed.exportMargin === "compact" || parsed.exportMargin === "wide" || parsed.exportMargin === "standard"
          ? parsed.exportMargin
          : defaultReaderPreferences.exportMargin,
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
