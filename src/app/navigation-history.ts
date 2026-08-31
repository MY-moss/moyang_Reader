import { normalizePathKey } from "./path-key";

export const MAX_NAVIGATION_HISTORY_ENTRIES = 50;

export type NavigationHistoryState = {
  back: string[];
  current: string | null;
  forward: string[];
};

function samePath(left: string | null, right: string | null): boolean {
  if (!left || !right) return left === right;
  return normalizePathKey(left) === normalizePathKey(right);
}

function trimBack(paths: string[]): string[] {
  return paths.length > MAX_NAVIGATION_HISTORY_ENTRIES ? paths.slice(-MAX_NAVIGATION_HISTORY_ENTRIES) : paths;
}

function trimForward(paths: string[]): string[] {
  return paths.length > MAX_NAVIGATION_HISTORY_ENTRIES ? paths.slice(0, MAX_NAVIGATION_HISTORY_ENTRIES) : paths;
}

export function createNavigationHistory(current: string | null = null): NavigationHistoryState {
  return { back: [], current, forward: [] };
}

/** Reset the navigation session when a direct open establishes a new root. */
export function replaceNavigationPath(state: NavigationHistoryState, path: string | null): NavigationHistoryState {
  if (samePath(state.current, path)) return state;
  return createNavigationHistory(path);
}

/** Record a successful user navigation and discard the forward branch. */
export function pushNavigationPath(state: NavigationHistoryState, path: string): NavigationHistoryState {
  if (!path || samePath(state.current, path)) return state;
  if (!state.current) return createNavigationHistory(path);

  const lastBackPath = state.back.at(-1) ?? null;
  const back = samePath(lastBackPath, state.current) ? state.back : trimBack([...state.back, state.current]);
  return { back, current: path, forward: [] };
}

export function canGoBack(state: NavigationHistoryState): boolean {
  return state.current !== null && state.back.length > 0;
}

export function canGoForward(state: NavigationHistoryState): boolean {
  return state.current !== null && state.forward.length > 0;
}

export function getBackNavigationPath(state: NavigationHistoryState): string | null {
  return canGoBack(state) ? (state.back.at(-1) ?? null) : null;
}

export function getForwardNavigationPath(state: NavigationHistoryState): string | null {
  return canGoForward(state) ? (state.forward[0] ?? null) : null;
}

export function goBack(state: NavigationHistoryState): NavigationHistoryState {
  const target = getBackNavigationPath(state);
  if (!target || !state.current) return state;

  return {
    back: state.back.slice(0, -1),
    current: target,
    forward: trimForward([state.current, ...state.forward]),
  };
}

export function goForward(state: NavigationHistoryState): NavigationHistoryState {
  const target = getForwardNavigationPath(state);
  if (!target || !state.current) return state;

  return {
    back: trimBack([...state.back, state.current]),
    current: target,
    forward: state.forward.slice(1),
  };
}
