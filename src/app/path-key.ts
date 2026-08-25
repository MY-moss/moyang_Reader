/**
 * Normalize a filesystem path for comparisons and map keys.
 *
 * Path identity must not depend on the user's locale. JavaScript's
 * `toLowerCase()` is intentionally locale-independent, unlike
 * `toLocaleLowerCase()`.
 */
export function normalizePathKey(path: string): string {
  return path
    .replace(/[\\/]+/g, "\\")
    .replace(/\\$/, "")
    .toLowerCase();
}
