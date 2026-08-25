import type { DocumentKind, ReaderMode } from "./types";

export function nextReaderModeAfterOpen(
  currentMode: ReaderMode,
  preserveMode: boolean,
  kind: DocumentKind = "markdown",
  wysiwygSafe = true,
): ReaderMode {
  if (preserveMode) {
    if (currentMode === "wysiwyg" && (kind !== "markdown" || !wysiwygSafe)) {
      return kind === "markdown" || kind === "text" ? "source" : "rendered";
    }
    if (currentMode === "source" && kind !== "markdown" && kind !== "text") return "rendered";
    return currentMode;
  }

  if (kind === "markdown") return wysiwygSafe ? "wysiwyg" : "source";
  if (kind === "text") return "source";
  return "rendered";
}
