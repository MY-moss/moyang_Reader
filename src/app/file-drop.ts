export type FileDropSupport = "supported" | "mixed" | "unsupported" | "unknown";

export type FileDropSource = "browser" | "native";

export type FileDropState = {
  active: boolean;
  support: FileDropSupport;
  source: FileDropSource;
};

export const idleFileDropState: FileDropState = {
  active: false,
  support: "unknown",
  source: "browser",
};

export type FileDragPayload = {
  files?: ArrayLike<unknown> | null;
  items?: ArrayLike<{ kind: string }> | null;
  types?: ArrayLike<string> | null;
};

export function hasFileDragPayload(dataTransfer: FileDragPayload | null | undefined): boolean {
  if (!dataTransfer) return false;
  if ((dataTransfer.files?.length ?? 0) > 0) return true;
  if (Array.from(dataTransfer.items ?? []).some((item) => item.kind === "file")) return true;
  return Array.from(dataTransfer.types ?? []).some((type) => type.toLowerCase() === "files");
}

export function classifyFileDropPaths(
  paths: readonly string[],
  isSupportedPath: (path: string) => boolean,
): FileDropSupport {
  const candidates = paths.map((path) => path.trim()).filter(Boolean);
  if (candidates.length === 0) return "unknown";

  const supportedCount = candidates.filter(isSupportedPath).length;
  if (supportedCount === 0) return "unsupported";
  return supportedCount === candidates.length ? "supported" : "mixed";
}
