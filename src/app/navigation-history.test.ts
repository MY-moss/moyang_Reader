import { describe, expect, it } from "vitest";
import {
  MAX_NAVIGATION_HISTORY_ENTRIES,
  canGoBack,
  canGoForward,
  createNavigationHistory,
  getBackNavigationPath,
  getForwardNavigationPath,
  goBack,
  goForward,
  pushNavigationPath,
  replaceNavigationPath,
} from "./navigation-history";

const note = (name: string) => `C:\\Notes\\${name}.md`;

describe("navigation history", () => {
  it("returns through a multi-document chain", () => {
    let history = createNavigationHistory(note("A"));
    history = pushNavigationPath(history, note("B"));
    history = pushNavigationPath(history, note("C"));

    expect(getBackNavigationPath(history)).toBe(note("B"));
    history = goBack(history);
    expect(history).toMatchObject({ current: note("B"), back: [note("A")], forward: [note("C")] });
    history = goBack(history);
    expect(history).toMatchObject({ current: note("A"), back: [], forward: [note("B"), note("C")] });
  });

  it("supports forward navigation and clears the forward branch after a new push", () => {
    let history = createNavigationHistory(note("A"));
    history = pushNavigationPath(history, note("B"));
    history = pushNavigationPath(history, note("C"));
    history = goBack(history);

    expect(canGoForward(history)).toBe(true);
    expect(getForwardNavigationPath(history)).toBe(note("C"));
    history = goForward(history);
    expect(history.current).toBe(note("C"));
    expect(canGoForward(history)).toBe(false);

    history = goBack(history);
    history = pushNavigationPath(history, note("D"));
    expect(history).toMatchObject({ current: note("D"), back: [note("A"), note("B")], forward: [] });
  });

  it("ignores consecutive duplicate paths using Windows path identity", () => {
    let history = createNavigationHistory(note("A"));
    history = pushNavigationPath(history, "c:/notes/a.md");
    expect(history).toEqual(createNavigationHistory(note("A")));

    history = pushNavigationPath(history, note("B"));
    history = pushNavigationPath(history, "C:/NOTES/B.MD");
    expect(history.back).toEqual([note("A")]);
  });

  it("keeps at most the configured number of back and forward entries", () => {
    let history = createNavigationHistory(note("0"));
    for (let index = 1; index <= MAX_NAVIGATION_HISTORY_ENTRIES + 5; index += 1) {
      history = pushNavigationPath(history, note(String(index)));
    }

    expect(history.back).toHaveLength(MAX_NAVIGATION_HISTORY_ENTRIES);
    expect(history.back[0]).toBe(note("5"));

    for (let index = 0; index < 10; index += 1) history = goBack(history);
    expect(history.forward).toHaveLength(10);
  });

  it("resets the session when a direct open changes the current root", () => {
    let history = createNavigationHistory(note("A"));
    history = pushNavigationPath(history, note("B"));

    expect(replaceNavigationPath(history, note("B"))).toBe(history);
    expect(replaceNavigationPath(history, note("C"))).toEqual(createNavigationHistory(note("C")));
    expect(canGoBack(createNavigationHistory())).toBe(false);
  });
});
