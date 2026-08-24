import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  OpenPath,
  WorkspaceFile,
  WorkspaceIndexEntry,
  WorkspaceRefreshResult,
  WorkspaceSearchResult,
} from "./types";

export function isTauriRuntime(): boolean {
  return Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

export async function openExternalUrl(url: string): Promise<void> {
  const normalized = url.startsWith("//") ? `${window.location.protocol}${url}` : url;
  if (isTauriRuntime()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(normalized);
    return;
  }

  window.open(normalized, "_blank", "noopener,noreferrer");
}

export async function chooseDocumentPaths(): Promise<string[]> {
  if (!isTauriRuntime()) return [];
  return invoke<string[]>("choose_document_paths");
}

export async function chooseWorkspacePath(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return invoke<string | null>("choose_workspace_path");
}

/** Re-authorize a path the user previously opened from the local recent list. */
export async function authorizeStoredPath(path: string, workspace: boolean): Promise<string> {
  if (!isTauriRuntime()) return path;
  return invoke<string>("authorize_stored_path", { path, workspace });
}

export async function chooseSavePath(
  defaultPath: string,
  format: "markdown" | "html" | "docx",
): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return invoke<string | null>("choose_save_path", { defaultPath, format });
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

export async function refreshWorkspace(root: string, paths: string[]): Promise<WorkspaceRefreshResult> {
  if (!isTauriRuntime()) return { scopePaths: paths, files: [], index: [] };
  return invoke<WorkspaceRefreshResult>("refresh_workspace", { root, paths });
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

  let active = true;
  const unlisten = await listen<{ root: string; paths: string[] }>("workspace-changed", (event) => {
    if (event.payload.root === root) onPaths(event.payload.paths);
  });

  try {
    if (!active) {
      unlisten();
      return null;
    }
    await invoke("watch_workspace", { root });
  } catch (error) {
    unlisten();
    throw error;
  }

  return () => {
    active = false;
    unlisten();
    void invoke("unwatch_workspace", { root }).catch(() => undefined);
  };
}

export async function fileExists(path: string): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>("path_exists", { path });
}

export async function fileSize(path: string): Promise<number> {
  if (!isTauriRuntime()) return 0;
  return invoke<number>("file_size", { path });
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

  const bytes = await invoke<ArrayBuffer | number[]>("read_binary_file", { path });
  return bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : Uint8Array.from(bytes);
}

export async function writeTextFile(path: string, contents: string): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("浏览器预览模式不能写回本地文件。");
  }

  await invoke("write_text_file", { path, contents });
}

export async function writeBinaryFile(path: string, contents: Uint8Array): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("浏览器预览模式不能写回本地文件。");
  }

  await invoke("write_binary_file_raw", contents, {
    headers: { path: encodeURIComponent(path) },
  });
}

export async function initialPaths(): Promise<OpenPath[]> {
  if (!isTauriRuntime()) return [];
  return invoke<OpenPath[]>("initial_paths");
}

export async function resolveOpenPaths(paths: string[]): Promise<OpenPath[]> {
  if (!isTauriRuntime()) return [];
  return invoke<OpenPath[]>("resolve_open_paths", { paths });
}

export async function closeWindow(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("close_window");
}

export async function subscribeToCloseRequest(onRequest: () => void): Promise<UnlistenFn | null> {
  if (!isTauriRuntime()) return null;
  return listen("close-requested", () => onRequest());
}

export async function subscribeToOpenPaths(onPaths: (paths: OpenPath[]) => void): Promise<UnlistenFn | null> {
  if (!isTauriRuntime()) return null;
  return listen<OpenPath[]>("open-paths", (event) => onPaths(event.payload));
}

export async function subscribeToFileDrop(onPaths: (paths: string[]) => void): Promise<UnlistenFn | null> {
  if (!isTauriRuntime()) return null;

  const { getCurrentWebview } = await import("@tauri-apps/api/webview");
  return getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type === "drop") onPaths(event.payload.paths);
  });
}
