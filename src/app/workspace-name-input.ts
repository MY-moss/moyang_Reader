import { documentAdapterForPath } from "../lib/adapters/registry";

export type WorkspaceNameInputRequest = {
  kind: "file" | "folder";
  root: string;
  parentPath: string;
  initialName: string;
  currentName?: string;
} & ({ action: "create-note" | "create-folder" | "rename" } | { action: "duplicate"; sourcePath: string });
export type WorkspaceNameInputSubmit = (name: string) => Promise<"done" | "cancelled">;
export type WorkspaceNameInput = (
  request: WorkspaceNameInputRequest,
  submit: WorkspaceNameInputSubmit,
) => Promise<boolean>;
export type WorkspaceNameValidation =
  "empty" | "separator" | "characters" | "ending" | "reserved" | "markdownOnly" | "unsupportedType" | "unchanged";

/** Early feedback only: Rust remains the authority for names, paths and collisions. */
export function validateWorkspaceNameInput(
  request: WorkspaceNameInputRequest,
  value: string,
): WorkspaceNameValidation | null {
  const name = value.trim();
  if (!name || name === "." || name === "..") return "empty";
  if (/[\\/]/.test(name)) return "separator";
  if (/[<>"|?*:]/.test(name) || name.includes("\u0000")) return "characters";
  if (name.endsWith(".")) return "ending";
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(name.split(".")[0])) return "reserved";
  if (name === request.currentName) return "unchanged";
  // A leading dot alone is a stem, just as Path::extension treats it in Rust.
  if (name.lastIndexOf(".") > 0) {
    const adapter = documentAdapterForPath(name);
    if (request.action === "create-note" && adapter?.kind !== "markdown") return "markdownOnly";
    if ((request.action === "rename" || request.action === "duplicate") && request.kind === "file" && !adapter)
      return "unsupportedType";
  }
  return null;
}
