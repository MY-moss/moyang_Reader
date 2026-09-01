function relativeParts(value: string): string[] | null {
  const normalized = value.trim().replace(/[\\/]+/g, "/");
  if (!normalized || normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)) return null;

  const parts = normalized.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) return null;
  return parts;
}

/**
 * Convert two workspace-relative paths into a Markdown-relative resource path.
 *
 * Both inputs must come from the same already-authorized workspace. Keeping
 * this helper relative-only prevents an absolute path from leaking into a
 * Markdown document.
 */
export function relativeMarkdownAssetPath(documentPath: string, assetPath: string): string | null {
  const documentParts = relativeParts(documentPath);
  const assetParts = relativeParts(assetPath);
  if (!documentParts || !assetParts || documentParts.length < 1 || assetParts.length < 1) return null;

  const documentDirectory = documentParts.slice(0, -1);
  let common = 0;
  while (common < documentDirectory.length && common < assetParts.length) {
    if (documentDirectory[common]?.toLowerCase() !== assetParts[common]?.toLowerCase()) break;
    common += 1;
  }

  const parentSegments = Array.from({ length: documentDirectory.length - common }, () => "..");
  return [...parentSegments, ...assetParts.slice(common)].join("/") || null;
}
