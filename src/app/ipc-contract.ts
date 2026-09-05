import { invoke as tauriInvoke, type InvokeArgs, type InvokeOptions } from "@tauri-apps/api/core";
import type { TextAnnotation } from "./annotations";
import type {
  FileStamp,
  OpenPath,
  WorkspaceDirectory,
  WorkspaceFile,
  WorkspaceIndexEntry,
  WorkspaceListing,
  WorkspaceRefreshResult,
  WorkspaceSearchResult,
} from "./types";

/**
 * The Rust command names are declared once here. Keep the values in sync with
 * the `#[tauri::command]` functions registered in `src-tauri/src/lib.rs`.
 * Runtime IPC is intentionally unchanged; this module only supplies names and
 * static payload/result types to the frontend bridge.
 */
export const IPC_COMMANDS = {
  initialPaths: "initial_paths",
  resolveOpenPaths: "resolve_open_paths",
  chooseDocumentPaths: "choose_document_paths",
  chooseImagePaths: "choose_image_paths",
  chooseWorkspacePath: "choose_workspace_path",
  authorizeStoredPath: "authorize_stored_path",
  chooseSavePath: "choose_save_path",
  closeWindow: "close_window",
  readAppSettings: "read_app_settings",
  writeAppSettings: "write_app_settings",
  readAnnotations: "read_annotations",
  writeAnnotations: "write_annotations",
  readTextFile: "read_text_file",
  readPreviousVersion: "read_previous_version",
  readBinaryFile: "read_binary_file",
  pathExists: "path_exists",
  fileSize: "file_size",
  fileMetadata: "file_metadata",
  watchWorkspace: "watch_workspace",
  unwatchWorkspace: "unwatch_workspace",
  listWorkspaceFiles: "list_workspace_files",
  listWorkspaceEntries: "list_workspace_entries",
  listWorkspaceDirectories: "list_workspace_directories",
  searchWorkspace: "search_workspace",
  indexWorkspace: "index_workspace",
  refreshWorkspace: "refresh_workspace",
  createMarkdownFile: "create_markdown_file",
  createWorkspaceNote: "create_workspace_note",
  createWorkspaceFolder: "create_workspace_folder",
  renameWorkspaceEntry: "rename_workspace_entry",
  deleteWorkspaceEntry: "delete_workspace_entry",
  duplicateWorkspaceEntry: "duplicate_workspace_entry",
  copyWorkspaceEntry: "copy_workspace_entry",
  moveWorkspaceEntry: "move_workspace_entry",
  revealWorkspaceEntry: "reveal_workspace_entry",
  writeTextFile: "write_text_file",
  writeBinaryFile: "write_binary_file",
  writeBinaryFileChunk: "write_binary_file_chunk",
  writeBinaryFileRaw: "write_binary_file_raw",
  writeBinaryFileChunkRaw: "write_binary_file_chunk_raw",
  commitBinaryFile: "commit_binary_file",
  discardBinaryFile: "discard_binary_file",
  exportPdfFile: "export_pdf_file",
} as const;

export type IpcCommandName = (typeof IPC_COMMANDS)[keyof typeof IPC_COMMANDS];

export type SaveFormat = "markdown" | "html" | "docx" | "pdf" | "json";

export type IpcCommandMap = {
  [IPC_COMMANDS.initialPaths]: { args: undefined; result: OpenPath[] };
  [IPC_COMMANDS.resolveOpenPaths]: { args: { paths: string[] }; result: OpenPath[] };
  [IPC_COMMANDS.chooseDocumentPaths]: { args: undefined; result: string[] };
  [IPC_COMMANDS.chooseImagePaths]: { args: undefined; result: string[] };
  [IPC_COMMANDS.chooseWorkspacePath]: { args: undefined; result: string | null };
  [IPC_COMMANDS.authorizeStoredPath]: { args: { path: string; workspace: boolean }; result: string };
  [IPC_COMMANDS.chooseSavePath]: {
    args: { defaultPath: string; format: SaveFormat };
    result: string | null;
  };
  [IPC_COMMANDS.closeWindow]: { args: undefined; result: void };
  [IPC_COMMANDS.readAppSettings]: { args: undefined; result: string | null };
  [IPC_COMMANDS.writeAppSettings]: { args: { contents: string }; result: void };
  [IPC_COMMANDS.readAnnotations]: { args: { root: string }; result: TextAnnotation[] };
  [IPC_COMMANDS.writeAnnotations]: {
    args: { root: string; annotations: readonly TextAnnotation[] };
    result: void;
  };
  [IPC_COMMANDS.readTextFile]: { args: { path: string }; result: string };
  [IPC_COMMANDS.readPreviousVersion]: { args: { path: string }; result: string | null };
  [IPC_COMMANDS.readBinaryFile]: { args: { path: string }; result: ArrayBuffer | number[] };
  [IPC_COMMANDS.pathExists]: { args: { path: string }; result: boolean };
  [IPC_COMMANDS.fileSize]: { args: { path: string }; result: number };
  [IPC_COMMANDS.fileMetadata]: { args: { path: string }; result: FileStamp };
  [IPC_COMMANDS.watchWorkspace]: { args: { root: string }; result: void };
  [IPC_COMMANDS.unwatchWorkspace]: { args: { root: string }; result: void };
  [IPC_COMMANDS.listWorkspaceFiles]: { args: { root: string }; result: WorkspaceFile[] };
  [IPC_COMMANDS.listWorkspaceEntries]: { args: { root: string }; result: WorkspaceListing };
  [IPC_COMMANDS.listWorkspaceDirectories]: { args: { root: string }; result: WorkspaceDirectory[] };
  [IPC_COMMANDS.searchWorkspace]: { args: { root: string; query: string }; result: WorkspaceSearchResult[] };
  [IPC_COMMANDS.indexWorkspace]: { args: { root: string }; result: WorkspaceIndexEntry[] };
  [IPC_COMMANDS.refreshWorkspace]: {
    args: { root: string; paths: string[] };
    result: WorkspaceRefreshResult;
  };
  [IPC_COMMANDS.createMarkdownFile]: {
    args: { root: string; baseFile: string; target: string };
    result: string;
  };
  [IPC_COMMANDS.createWorkspaceNote]: {
    args: { root: string; parentPath: string; name: string };
    result: string;
  };
  [IPC_COMMANDS.createWorkspaceFolder]: {
    args: { root: string; parentPath: string; name: string };
    result: string;
  };
  [IPC_COMMANDS.renameWorkspaceEntry]: {
    args: { root: string; entryPath: string; name: string };
    result: string;
  };
  [IPC_COMMANDS.deleteWorkspaceEntry]: { args: { root: string; entryPath: string }; result: void };
  [IPC_COMMANDS.duplicateWorkspaceEntry]: {
    args: { root: string; entryPath: string; name: string };
    result: string;
  };
  [IPC_COMMANDS.copyWorkspaceEntry]: {
    args: { root: string; entryPath: string; destinationParentPath: string };
    result: string;
  };
  [IPC_COMMANDS.moveWorkspaceEntry]: {
    args: { root: string; entryPath: string; destinationParentPath: string };
    result: string;
  };
  [IPC_COMMANDS.revealWorkspaceEntry]: { args: { root: string; entryPath: string }; result: void };
  [IPC_COMMANDS.writeTextFile]: { args: { path: string; contents: string }; result: void };
  [IPC_COMMANDS.writeBinaryFile]: { args: { path: string; contents: number[] }; result: void };
  [IPC_COMMANDS.writeBinaryFileChunk]: {
    args: { path: string; contents: number[]; append: boolean; destinationPath: string };
    result: void;
  };
  [IPC_COMMANDS.commitBinaryFile]: {
    args: { tempPath: string; destinationPath: string };
    result: void;
  };
  [IPC_COMMANDS.discardBinaryFile]: {
    args: { path: string; destinationPath: string };
    result: void;
  };
  [IPC_COMMANDS.exportPdfFile]: { args: { path: string; html: string }; result: void };
};

export type IpcCommand = keyof IpcCommandMap;
export type IpcRawCommand = typeof IPC_COMMANDS.writeBinaryFileRaw | typeof IPC_COMMANDS.writeBinaryFileChunkRaw;

type IpcArgs<C extends IpcCommand> = IpcCommandMap[C]["args"];
type IpcResult<C extends IpcCommand> = IpcCommandMap[C]["result"];

/** Invoke a normal registered Rust command with its statically declared payload/result. */
export function invokeCommand<C extends IpcCommand>(
  command: C,
  ...args: IpcArgs<C> extends undefined ? [] : [args: IpcArgs<C>]
): Promise<IpcResult<C>> {
  if (args.length === 0) return tauriInvoke<IpcResult<C>>(command);
  return tauriInvoke<IpcResult<C>>(command, args[0] as InvokeArgs);
}

/** Invoke the two raw-body commands while retaining Tauri's request options. */
export function invokeRawCommand(command: IpcRawCommand, body: ArrayBuffer, options: InvokeOptions): Promise<void> {
  return tauriInvoke<void>(command, body, options);
}

const IPC_COMMAND_NAME_SET = new Set<string>(Object.values(IPC_COMMANDS));

export function isIpcCommandName(value: string): value is IpcCommandName {
  return IPC_COMMAND_NAME_SET.has(value);
}
