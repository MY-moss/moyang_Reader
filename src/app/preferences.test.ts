import { afterEach, describe, expect, it } from "vitest";
import {
  defaultReaderPreferences,
  loadReaderPreferences,
  saveReaderPreferences,
  type ReaderPreferences,
} from "./preferences";

afterEach(() => localStorage.clear());

describe("reader preferences", () => {
  it("defaults to local-only resources and manual update checks", () => {
    expect(loadReaderPreferences()).toEqual(defaultReaderPreferences);
  });

  it("persists supported preferences", () => {
    const preferences: ReaderPreferences = {
      allowRemoteResources: true,
      startupUpdateCheck: true,
      annotationEnabled: false,
      readingScale: "large",
      readingZoom: 115,
      readingWidth: "wide",
      exportPaper: "letter",
      exportOrientation: "landscape",
      exportMargin: "compact",
    };

    saveReaderPreferences(preferences);

    expect(loadReaderPreferences()).toEqual(preferences);
  });

  it("ignores malformed or partial values safely", () => {
    localStorage.setItem("moyang-reader-preferences", JSON.stringify({ allowRemoteResources: true }));

    expect(loadReaderPreferences()).toEqual({
      allowRemoteResources: true,
      startupUpdateCheck: false,
      annotationEnabled: true,
      readingScale: "medium",
      readingZoom: 100,
      readingWidth: "standard",
      exportPaper: "a4",
      exportOrientation: "portrait",
      exportMargin: "standard",
    });
  });
});
