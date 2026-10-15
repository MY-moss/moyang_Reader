import type { DocumentKind, ReaderMode } from "../../shared/types";

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

  if (kind === "text") return "source";
  if (kind === "markdown") return wysiwygSafe ? "wysiwyg" : "source";
  return "rendered";
}
