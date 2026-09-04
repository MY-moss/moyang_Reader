import { describe, expect, it } from "vitest";
import { IPC_COMMANDS, isIpcCommandName } from "./ipc-contract";

const EXPECTED_COMMAND_NAMES = [
  "initial_paths",
  "resolve_open_paths",
  "choose_document_paths",
  "choose_image_paths",
  "choose_workspace_path",
  "authorize_stored_path",
  "choose_save_path",
  "close_window",
  "read_app_settings",
  "write_app_settings",
  "read_annotations",
  "write_annotations",
  "read_text_file",
  "read_previous_version",
  "read_binary_file",
  "path_exists",
  "file_size",
  "file_metadata",
  "watch_workspace",
  "unwatch_workspace",
  "list_workspace_files",
  "list_workspace_entries",
  "list_workspace_directories",
  "search_workspace",
  "index_workspace",
  "refresh_workspace",
  "create_markdown_file",
  "create_workspace_note",
  "create_workspace_folder",
  "rename_workspace_entry",
  "delete_workspace_entry",
  "duplicate_workspace_entry",
  "copy_workspace_entry",
  "move_workspace_entry",
  "reveal_workspace_entry",
  "write_text_file",
  "write_binary_file",
  "write_binary_file_chunk",
  "write_binary_file_raw",
  "write_binary_file_chunk_raw",
  "commit_binary_file",
  "discard_binary_file",
  "export_pdf_file",
] as const;

describe("IPC command contract", () => {
  it("keeps one unique name for every registered Rust command", () => {
    expect(Object.values(IPC_COMMANDS)).toEqual(EXPECTED_COMMAND_NAMES);
    expect(new Set(Object.values(IPC_COMMANDS)).size).toBe(EXPECTED_COMMAND_NAMES.length);
  });

  it("recognizes registered names without accepting arbitrary strings", () => {
    expect(isIpcCommandName(IPC_COMMANDS.readTextFile)).toBe(true);
    expect(isIpcCommandName("read_text_file" as string)).toBe(true);
    expect(isIpcCommandName("read_text_file_typo")).toBe(false);
  });
});
