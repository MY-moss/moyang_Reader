import type { ReaderMode } from "./types";

export function nextReaderModeAfterOpen(currentMode: ReaderMode, preserveMode: boolean): ReaderMode {
  return preserveMode ? currentMode : "rendered";
}
