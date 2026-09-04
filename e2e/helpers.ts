import { expect, type Locator, type Page } from "@playwright/test";

export async function readEditorText(editor: Locator): Promise<string> {
  return editor.evaluate((node) => {
    if (node instanceof HTMLTextAreaElement) return node.value;

    // CodeMirror renders only the visible viewport, so reading .cm-line DOM
    // truncates long documents. Pull the authoritative text from the internal
    // view state instead: .cm-content -> cmTile -> root -> view -> state.doc.
    const content = (node.classList.contains("cm-content") ? node : node.querySelector(".cm-content")) as
      (HTMLElement & { cmTile?: { root?: { view?: { state?: { doc?: { toString(): string } } } } } }) | null;
    const docText = content?.cmTile?.root?.view?.state?.doc?.toString();
    if (typeof docText === "string") return docText;
    throw new Error("CodeMirror internal view state path changed — update readEditorText");
  });
}

/**
 * Milkdown serializes a few syntaxes to an equivalent-but-different style:
 * `-` bullets become `*`, `---` becomes `***`, table separators are re-padded,
 * and the brackets of wiki links are escaped (`[[x]]` -> `\[\[x]]`). Map those
 * known rewrites back so the round-trip check compares semantics, not style.
 */
export function normalizeSerializedMarkdown(value: string): string {
  return value
    .replace(/\\([[\]])/g, "$1")
    .replace(/^(\s*)\* /gm, "$1- ")
    .replace(/^(\s*)\*\*\*\s*$/gm, "$1---")
    .replace(/^\|[\s|:-]+\|$/gm, "|---|")
    .replace(/\s+/g, "");
}

export async function expectEditorText(editor: Locator, expected: string): Promise<void> {
  const normalizedExpected = normalizeSerializedMarkdown(expected);
  await expect
    .poll(async () => {
      const value = await readEditorText(editor);
      return normalizeSerializedMarkdown(value);
    })
    .toBe(normalizedExpected);
}

export async function openMoreMenu(page: Page): Promise<void> {
  const menu = page.locator(".toolbar-overflow");
  if ((await menu.getAttribute("open")) === null) {
    await page.locator(".toolbar-overflow-trigger").click();
  }
}

export async function openSettingsMenu(page: Page, label = "设置"): Promise<void> {
  await openMoreMenu(page);
  await page.locator(".topbar .settings-menu summary", { hasText: label }).click();
}

export async function clickToolbarAction(page: Page, name: string): Promise<void> {
  await openMoreMenu(page);
  await page.getByRole("button", { name, exact: true }).click();
}

export async function switchToRenderedMode(page: Page): Promise<void> {
  await clickToolbarAction(page, "源文本");
  await clickToolbarAction(page, "阅读");
  const menu = page.locator(".toolbar-overflow");
  if ((await menu.getAttribute("open")) !== null) await page.locator(".toolbar-overflow-trigger").click();
}

export async function readSearchHighlightCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const runtime = globalThis as unknown as {
      CSS?: {
        highlights?: {
          get?: (name: string) => { size?: number } | undefined;
        };
      };
    };
    const customHighlight = runtime.CSS?.highlights?.get?.("moyang-search-hit");
    if (typeof customHighlight?.size === "number") return customHighlight.size;
    return document.querySelectorAll("mark.moyang-search-hit").length;
  });
}

export async function expectSearchHighlightCount(page: Page, count: number): Promise<void> {
  await expect(page.locator("article.reader-content")).toHaveAttribute("data-search-result-count", String(count));
  await expect.poll(() => readSearchHighlightCount(page)).toBe(count);
}

