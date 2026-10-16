import { loadReadingPosition, saveReadingPosition } from "../../platform/storage";
import { normalizePathKey } from "../../platform/path-key";
import type { ReaderMode } from "../../shared/types";
export type PaneView = { scroll: number; page: number; zoom: number; mode?: ReaderMode };
const KEY = "moyang.pane.views.v1";
const cache = new Map<string, PaneView>();
let loaded = false;
const identity = (pane: number, path: string) => pane + ":" + normalizePathKey(path);
function hydrate() {
  if (loaded) return;
  loaded = true;
  try {
    const values = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (Array.isArray(values))
      for (const [key, view] of values.slice(-200)) {
        if (typeof key === "string" && view && Number.isFinite(view.scroll) && Number.isFinite(view.page))
          cache.set(key, view);
      }
  } catch {
    /* Layout recovery must not affect file access. */
  }
}
export function readPaneView(pane: number, path: string): PaneView {
  hydrate();
  return cache.get(identity(pane, path)) ?? { scroll: loadReadingPosition(path), page: 1, zoom: 100 };
}
export function savePaneView(pane: number, path: string, patch: Partial<PaneView>) {
  hydrate();
  const key = identity(pane, path);
  cache.set(key, { ...readPaneView(pane, path), ...patch });
  if (patch.scroll !== undefined && !path.startsWith("browser://")) saveReadingPosition(path, patch.scroll);
  while (cache.size > 200) cache.delete(cache.keys().next().value!);
  try {
    localStorage.setItem(KEY, JSON.stringify([...cache]));
  } catch {
    /* Content drafts are stored independently. */
  }
}
export function rebasePaneViews(from: string, to: string) {
  hydrate();
  const previous = normalizePathKey(from),
    next = normalizePathKey(to);
  for (const [key, view] of [...cache]) {
    const separator = key.indexOf(":");
    const path = key.slice(separator + 1);
    if (path === previous || path.startsWith(previous + "\\")) {
      cache.delete(key);
      cache.set(key.slice(0, separator + 1) + next + path.slice(previous.length), view);
    }
  }
  try {
    localStorage.setItem(KEY, JSON.stringify([...cache]));
  } catch {
    /* Layout only. */
  }
}
