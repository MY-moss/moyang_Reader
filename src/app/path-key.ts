/**
 * Normalize a filesystem path for comparisons and map keys.
 *
 * Path identity must not depend on the user's locale. JavaScript's
 * `toLowerCase()` is intentionally locale-independent, unlike
 * `toLocaleLowerCase()`.
 */
export function normalizePathKey(path: string): string {
  const windowsPath = path.replace(/\//g, "\\");
  const withoutNamespacePrefix = windowsPath.startsWith("\\\\?\\UNC\\")
    ? `\\\\${windowsPath.slice("\\\\?\\UNC\\".length)}`
    : windowsPath.startsWith("\\\\?\\")
      ? windowsPath.slice("\\\\?\\".length)
      : windowsPath;

  return withoutNamespacePrefix
    .replace(/[\\/]+/g, "\\")
    .replace(/\\$/, "")
    .toLowerCase();
}

/** Return whether a path is the root itself or a descendant of that root. */
export function isPathWithin(path: string, root: string): boolean {
  const candidate = normalizePathKey(path);
  const normalizedRoot = normalizePathKey(root);
  return Boolean(normalizedRoot) && (candidate === normalizedRoot || candidate.startsWith(`${normalizedRoot}\\`));
}
