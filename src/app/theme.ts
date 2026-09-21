import type { ThemeMode } from "./types";

/** Keeps settings written by pre-v1 builds readable without a destructive migration. */
export function normalizeThemeMode(value: unknown): ThemeMode {
  if (value === "porcelain" || value === "paper" || value === "ink" || value === "system") return value;
  if (value === "light") return "porcelain";
  if (value === "dark") return "ink";
  return "system";
}
