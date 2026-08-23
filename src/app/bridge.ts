import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { WorkspaceFile, WorkspaceIndexEntry, WorkspaceSearchResult } from "./types";

export function isTauriRuntime(): boolean {
  return Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

export async function chooseDocumentPath(): Promise<string | null> {
  if (!isTauriRuntime()) return null;

  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [
      {
        name: "文档",
        extensions: ["md", "markdown", "mdown", "mkd", "txt", "text", "log", "docx", "pdf", "avif", "gif", "jpeg", "jpg", "png", "svg", "webp"],
      },
    ],
  });

  return typeof selected === "string" ? selected : null;
}

export async function chooseWorkspacePath(): Promise<string | null> {
  if (!isTauriRuntime()) return null;

  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({ directory: true, multiple: false });
  return typeof selected === "string" ? selected : null;
}

export async function chooseSavePath(defaultPath: string, format: "markdown" | "html"): Promise<string | null> {
  if (!isTauriRuntime()) return null;

  const { save } = await import("@tauri-apps/plugin-dialog");
  const options = format === "html"
    ? { name: "HTML 网页", extensions: ["html", "htm"] }
    : { name: "Markdown / 文本", extensions: ["md", "markdown", "txt"] };
  return save({
    title: format === "html" ? "导出 HTML" : "导出 Markdown",
    defaultPath,
    filters: [options],
  });
}

export async function listWorkspaceFiles(root: string): Promise<WorkspaceFile[]> {
  if (!isTauriRuntime()) return [];
  return invoke<WorkspaceFile[]>("list_workspace_files", { root });
}

export async function searchWorkspace(root: string, query: string): Promise<WorkspaceSearchResult[]> {
  if (!isTauriRuntime()) return [];
  return invoke<WorkspaceSearchResult[]>("search_workspace", { root, query });
}

export async function indexWorkspace(root: string): Promise<WorkspaceIndexEntry[]> {
  if (!isTauriRuntime()) return [];
  return invoke<WorkspaceIndexEntry[]>("index_workspace", { root });
}

export async function createMarkdownFile(root: string, baseFile: string, target: string): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error("浏览器预览模式不能创建工作区文档。");
  }
  return invoke<string>("create_markdown_file", { root, baseFile, target });
}

export async function subscribeToWorkspaceChanges(
  root: string,
  onPaths: (paths: string[]) => void,
): Promise<(() => void) | null> {
  if (!isTauriRuntime()) return null;

  const { watch } = await import("@tauri-apps/plugin-fs");
  return watch(root, (event) => onPaths(event.paths), { recursive: true, delayMs: 300 });
}

export async function fileExists(path: string): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>("path_exists", { path });
}

export async function readTextFile(path: string): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error("浏览器预览模式不能直接读取本地路径，请使用文件选择器。");
  }

  return invoke<string>("read_text_file", { path });
}

export async function readBinaryFile(path: string): Promise<Uint8Array> {
  if (!isTauriRuntime()) {
    throw new Error("浏览器预览模式不能直接读取本地路径，请使用文件选择器。");
  }

  const bytes = await invoke<number[]>("read_binary_file", { path });
  return Uint8Array.from(bytes);
}

export async function writeTextFile(path: string, contents: string): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("浏览器预览模式不能写回本地文件。");
  }

  await invoke("write_text_file", { path, contents });
}

export async function initialPaths(): Promise<string[]> {
  if (!isTauriRuntime()) return [];
  return invoke<string[]>("initial_paths");
}

export async function subscribeToOpenPaths(
  onPaths: (paths: string[]) => void,
): Promise<UnlistenFn | null> {
  if (!isTauriRuntime()) return null;
  return listen<string[]>("open-paths", (event) => onPaths(event.payload));
}
