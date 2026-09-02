import { expect, test, type Locator, type Page } from "@playwright/test";

async function readEditorText(editor: Locator): Promise<string> {
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
function normalizeSerializedMarkdown(value: string): string {
  return value
    .replace(/\\([[\]])/g, "$1")
    .replace(/^(\s*)\* /gm, "$1- ")
    .replace(/^(\s*)\*\*\*\s*$/gm, "$1---")
    .replace(/^\|[\s|:-]+\|$/gm, "|---|")
    .replace(/\s+/g, "");
}

async function expectEditorText(editor: Locator, expected: string): Promise<void> {
  const normalizedExpected = normalizeSerializedMarkdown(expected);
  await expect
    .poll(async () => {
      const value = await readEditorText(editor);
      return normalizeSerializedMarkdown(value);
    })
    .toBe(normalizedExpected);
}

async function openMoreMenu(page: Page): Promise<void> {
  const menu = page.locator(".toolbar-overflow");
  if ((await menu.getAttribute("open")) === null) {
    await page.locator(".toolbar-overflow-trigger").click();
  }
}

async function openSettingsMenu(page: Page, label = "设置"): Promise<void> {
  await openMoreMenu(page);
  await page.locator(".topbar .settings-menu summary", { hasText: label }).click();
}

async function clickToolbarAction(page: Page, name: string): Promise<void> {
  await openMoreMenu(page);
  await page.getByRole("button", { name, exact: true }).click();
}

async function switchToRenderedMode(page: Page): Promise<void> {
  await clickToolbarAction(page, "源文本");
  await clickToolbarAction(page, "阅读");
  const menu = page.locator(".toolbar-overflow");
  if ((await menu.getAttribute("open")) !== null) await page.locator(".toolbar-overflow-trigger").click();
}

async function readSearchHighlightCount(page: Page): Promise<number> {
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

async function expectSearchHighlightCount(page: Page, count: number): Promise<void> {
  await expect(page.locator("article.reader-content")).toHaveAttribute("data-search-result-count", String(count));
  await expect.poll(() => readSearchHighlightCount(page)).toBe(count);
}

test("renders the local reader landing page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Moyang Reader");
  await expect(page.getByRole("heading", { name: "把文档打开，专心阅读。" })).toBeVisible();
  await expect(page.getByRole("button", { name: "打开文档" })).toBeVisible();
  await expect(page.getByRole("button", { name: "添加整个文件夹" })).toBeVisible();
  await expect(page.locator(".brand-logo")).toBeVisible();
  await expect(page.locator('button[title="添加整个文件夹 (Ctrl+Shift+O)"]')).toHaveCount(0);
  await expect(page.locator("summary", { hasText: "批量导出" })).toHaveCount(0);
  await expect(page.getByText("MARKDOWN", { exact: true })).toBeVisible();
});

test("keeps the folder action available after collapsing the sidebar", async ({ page }) => {
  await page.goto("/");

  await page.locator('button[title="隐藏侧栏 (Ctrl+Shift+B)"]').click();
  await expect(page.locator('button[title="添加整个文件夹 (Ctrl+Shift+O)"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "添加整个文件夹" })).toHaveCount(0);
});

test("keeps the folder shortcut available from the landing page", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("Control+Shift+O");
  await expect(page.getByRole("heading", { name: "把文档打开，专心阅读。" })).toBeVisible();
});

test("shows remembered files and workspaces on the next launch", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "moyang-reader-recent-workspaces",
      JSON.stringify([{ path: "C:/Notes/Library", name: "Library" }]),
    );
    localStorage.setItem(
      "moyang-reader-recent-files",
      JSON.stringify([
        { path: "C:/Notes/Library/today.md", name: "today.md", lastOpenedAt: Date.now() - 3_600_000 },
        { path: "C:/Notes/Library/legacy.md", name: "legacy.md" },
      ]),
    );
  });
  await page.goto("/");

  await expect(page.locator('button[title="C:/Notes/Library"]')).toBeVisible();
  await expect(page.getByRole("button", { name: /today\.md/ })).toBeVisible();
  await expect(page.locator('[aria-label="最近打开"]')).toContainText("最近打开：1 小时前");
  await expect(page.locator('[aria-label="最近打开"]')).toContainText("打开时间未知");
});

test("shows weekly local reading history and clears it with confirmation", async ({ page }) => {
  await page.addInitScript(() => {
    const today = new Date();
    const dayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    localStorage.setItem(
      "moyang-reader-reading-history",
      JSON.stringify([
        {
          path: "C:/Notes/Guide.md",
          seconds: 600,
          lastReadAt: Date.now(),
          dailySeconds: { [dayKey]: 600 },
        },
      ]),
    );
  });
  await page.goto("/");

  const historyPanel = page.locator(".reading-history-panel");
  await expect(historyPanel.getByRole("heading", { name: "本周阅读" })).toBeVisible();
  await expect(historyPanel.locator('[aria-label^="本周阅读摘要"]')).toHaveAttribute("aria-label", /1 篇文档/);
  await expect(historyPanel.locator('[aria-label^="本周阅读摘要"]')).toHaveAttribute("aria-label", /10 分钟/);

  await historyPanel.getByTestId("reading-history-clear").click();
  const clearDialog = page.getByRole("dialog", { name: "清理阅读记录？" });
  await expect(clearDialog).toBeVisible();
  await expect(page.getByTestId("reading-history-clear-cancel")).toBeFocused();
  await page.getByTestId("reading-history-clear-confirm").click();
  await expect(clearDialog).toHaveCount(0);
  await expect(historyPanel).toContainText("还没有本机阅读记录。");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("moyang-reader-reading-history"))).toBeNull();
});

test("shows and manages local drafts from the recovery center", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "moyang-reader-drafts",
      JSON.stringify([
        {
          path: "C:/Notes/recovery-note.md",
          draft: "# Recovery note\n\n未保存内容",
          baseSource: "# Recovery note",
          savedAt: Date.now() - 60_000,
        },
        {
          path: "C:/Notes/second-draft.md",
          draft: "# Second draft\n\n另一个未保存草稿",
          baseSource: "# Second draft",
          savedAt: Date.now() - 30_000,
        },
      ]),
    );
  });
  await page.goto("/");

  const draftTrigger = page.getByRole("button", { name: /^草稿 \d+$/ });
  await expect(draftTrigger).toHaveAccessibleName("草稿 2");
  await draftTrigger.click();
  await expect(page.getByRole("dialog", { name: "未保存草稿" })).toBeVisible();
  await expect(page.getByRole("button", { name: "关闭草稿恢复中心" })).toBeFocused();
  await page.getByRole("button", { name: "查看 recovery-note.md 当前文件与草稿的差异" }).click();
  const comparisonDialog = page.getByRole("dialog", { name: "恢复前查看差异" });
  await expect(comparisonDialog).toContainText("新增行");
  await expect(comparisonDialog).toContainText("还需要核对当前文件");
  await expect(comparisonDialog).toContainText("草稿保存时的原文");
  await expect(comparisonDialog).toContainText("未保存内容");
  await page.keyboard.press("Escape");
  await expect(comparisonDialog).toHaveCount(0);

  await draftTrigger.click();
  await expect(
    page.getByRole("button", { name: "打开 recovery-note.md 的当前文件（不会自动恢复草稿）" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "丢弃 recovery-note.md 草稿" }).click();
  const discardDialog = page.getByRole("dialog", { name: "丢弃草稿？" });
  await expect(discardDialog).toBeVisible();
  await expect(page.getByTestId("draft-discard-cancel")).toBeFocused();
  await page.getByTestId("draft-discard-cancel").click();
  await expect(discardDialog).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "未保存草稿" })).toBeVisible();

  await page.getByRole("button", { name: "丢弃 recovery-note.md 草稿" }).click();
  await page.getByTestId("draft-discard-confirm").click();
  await expect(draftTrigger).toHaveAccessibleName("草稿 1");

  await expect(page.getByRole("dialog", { name: "未保存草稿" })).toBeVisible();
  await page.getByRole("button", { name: "清空全部" }).click();
  const clearAllDialog = page.getByRole("dialog", { name: "清空全部草稿？" });
  await expect(clearAllDialog).toBeVisible();
  await expect(clearAllDialog).toContainText("原文件不会被修改");
  await expect(page.getByTestId("draft-clear-all-cancel")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(clearAllDialog).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "未保存草稿" })).toBeVisible();

  await page.getByRole("button", { name: "清空全部" }).click();
  await page.getByTestId("draft-clear-all-confirm").click();
  await expect(draftTrigger).toHaveCount(0);
});

test("opens the quick-open palette from the keyboard", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "quick-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Quick note\n\n快速打开测试"),
  });
  await expect(page.locator(".wysiwyg-editor")).toBeVisible();
  await switchToRenderedMode(page);
  await expect(page.getByRole("heading", { name: "Quick note" })).toBeVisible();

  const quickOpenTrigger = page.locator('.toolbar > button[title="快速打开文档 (Ctrl+P)"]');
  await quickOpenTrigger.click();
  await expect(page.getByRole("dialog", { name: "快速打开" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "快速打开文档" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "快速打开" })).toHaveCount(0);
  await expect(quickOpenTrigger).toBeFocused();

  await page.keyboard.press("Control+P");
  const quickOpenDialog = page.getByRole("dialog", { name: "快速打开" });
  const quickOpenSearch = page.getByRole("searchbox", { name: "快速打开文档" });
  await expect(quickOpenDialog).toBeVisible();
  await expect(quickOpenSearch).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(quickOpenDialog.getByRole("option").last()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(quickOpenSearch).toBeFocused();

  await quickOpenSearch.fill("quick-note");
  await expect(page.getByRole("option", { name: /quick-note\.md/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "快速打开" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Quick note" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "目录" })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(5);
});

test("creates and locates a reading annotation from a selected passage", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "annotation-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Annotation note\n\n这段内容可以被高亮并添加批注。"),
  });

  await expect(page.locator('.wysiwyg-editor [contenteditable="true"]')).toBeVisible({ timeout: 15_000 });
  await switchToRenderedMode(page);
  const paragraph = page.locator(".reader-body p").first();
  await expect(paragraph).toBeVisible();
  await paragraph.evaluate((element) => {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await paragraph.click({ button: "right" });

  const readerMenu = page.getByRole("menu", { name: "阅读内容菜单" });
  await expect(readerMenu.getByRole("menuitem", { name: "高亮 / 批注" })).toBeEnabled();
  await readerMenu.getByRole("menuitem", { name: "高亮 / 批注" }).click();

  const dialog = page.getByRole("dialog", { name: "添加高亮 / 批注" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("这段内容可以被高亮并添加批注。");
  await dialog.getByRole("textbox", { name: "备注（可选）" }).fill("稍后回到这里整理");
  await dialog.getByRole("button", { name: "保存批注" }).click();

  await expect(page.getByRole("tab", { name: "批注" })).toBeVisible();
  await page.getByRole("tab", { name: "批注" }).click();
  await expect(page.locator(".annotation-item")).toHaveCount(1);
  await expect(page.locator(".annotation-item")).toContainText("稍后回到这里整理");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const runtime = globalThis as unknown as {
          CSS?: { highlights?: { get?: (name: string) => { size?: number } | undefined } };
        };
        return (
          runtime.CSS?.highlights?.get?.("moyang-annotation")?.size ??
          document.querySelectorAll("mark.moyang-annotation-hit").length
        );
      }),
    )
    .toBe(1);
});

test("keeps a direct read/edit action for immediate WYSIWYG editing", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "direct-edit.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Direct edit\n\n可以直接编辑。"),
  });

  await expect(page.locator('.wysiwyg-editor [contenteditable="true"]')).toBeVisible({ timeout: 15_000 });
  const modeButton = page.locator(".editor-mode-button");
  await expect(modeButton).toHaveText("阅读");

  await modeButton.click();
  await expect(page.getByRole("heading", { name: "Direct edit" })).toBeVisible();
  await expect(modeButton).toHaveText("编辑");

  await page.keyboard.press("Control+E");
  await expect(page.locator('.wysiwyg-editor [contenteditable="true"]')).toBeVisible({ timeout: 15_000 });
});

test("keeps outline navigation inside the reader and supports resizable sidebars", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "layout-navigation.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      [
        "# Layout navigation",
        "",
        ...Array.from({ length: 14 }, (_, index) => `首段占位内容 ${index + 1}，用于验证中央滚动容器。`),
        "",
        "## 第二章",
        "",
        ...Array.from({ length: 14 }, (_, index) => `第二章内容 ${index + 1}。`),
        "",
        "## 第三章",
        "",
        ...Array.from({ length: 14 }, (_, index) => `第三章内容 ${index + 1}。`),
      ].join("\n"),
    ),
  });

  await switchToRenderedMode(page);
  await expect(page.getByRole("heading", { name: "第三章" })).toBeVisible();

  const contentArea = page.locator(".content-area");
  await page.getByRole("link", { name: "第三章" }).click();
  await expect
    .poll(() => contentArea.evaluate((element) => element.scrollTop), { timeout: 5_000 })
    .toBeGreaterThan(100);
  await expect
    .poll(() =>
      contentArea.evaluate((element) => {
        const heading = element.querySelector<HTMLElement>("#第三章");
        return heading ? heading.getBoundingClientRect().top - element.getBoundingClientRect().top : -1;
      }),
    )
    .toBeGreaterThan(0);

  await page.keyboard.press("Control+Shift+R");
  await expect(page.locator(".context-sidebar")).toHaveCount(0);
  await page.keyboard.press("Control+Shift+R");
  await expect(page.locator(".context-sidebar")).toBeVisible();

  const appShell = page.locator(".app-shell");
  const leftHandle = page.locator(".pane-resize-handle-sidebar");
  const leftBox = await leftHandle.boundingBox();
  if (!leftBox) throw new Error("左侧栏分隔线没有可用几何位置");
  await page.mouse.move(leftBox.x + leftBox.width / 2, leftBox.y + 220);
  await page.mouse.down();
  await page.mouse.move(leftBox.x + leftBox.width / 2 + 72, leftBox.y + 220);
  await page.mouse.up();
  await expect
    .poll(() => appShell.evaluate((element) => getComputedStyle(element).getPropertyValue("--sidebar-width")))
    .toBe("332px");

  const rightHandle = page.locator(".pane-resize-handle-context");
  const rightBox = await rightHandle.boundingBox();
  if (!rightBox) throw new Error("右侧栏分隔线没有可用几何位置");
  await page.mouse.move(rightBox.x + rightBox.width / 2, rightBox.y + 220);
  await page.mouse.down();
  await page.mouse.move(rightBox.x + rightBox.width / 2 - 56, rightBox.y + 220);
  await page.mouse.up();
  await expect
    .poll(() => appShell.evaluate((element) => getComputedStyle(element).getPropertyValue("--context-width")))
    .toBe("376px");
});

test("shares undo and redo history between WYSIWYG and source editing", async ({ page }) => {
  await page.goto("/");
  const initialSource = [
    "# Editor history",
    "",
    "原始内容。",
    "",
    ...Array.from({ length: 60 }, (_, index) => `阅读位置测试段落 ${index + 1}。`),
    "",
  ].join("\n");
  await page.locator('input[type="file"]').setInputFiles({
    name: "editor-history.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(initialSource),
  });

  const editable = page.locator('.wysiwyg-editor [contenteditable="true"]');
  await expect(editable).toBeVisible({ timeout: 15_000 });
  await editable.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("可撤销内容。");
  await expect(editable).toContainText("可撤销内容。");

  // Milkdown emits the serialized Markdown on a short debounce. Wait for the
  // application-level history to receive that snapshot before undoing it.
  await page.waitForTimeout(350);
  const undoButton = page.getByRole("button", { name: "撤销", exact: true });
  const redoButton = page.getByRole("button", { name: "重做", exact: true });
  await expect(undoButton).toBeEnabled();

  const contentArea = page.locator(".content-area");
  await contentArea.evaluate((element) => {
    element.scrollTop = Math.min(320, element.scrollHeight - element.clientHeight);
    element.dispatchEvent(new Event("scroll"));
  });
  const positionBeforeUndo = await contentArea.evaluate((element) => element.scrollTop);
  expect(positionBeforeUndo).toBeGreaterThan(0);

  await page.keyboard.press("Control+Z");
  await expect(editable).not.toContainText("可撤销内容。");
  await expect
    .poll(() => contentArea.evaluate((element) => element.scrollTop), { timeout: 5_000 })
    .toBeGreaterThanOrEqual(Math.max(0, positionBeforeUndo - 4));
  await expect(redoButton).toBeEnabled();

  await page.keyboard.press("Control+Shift+Z");
  await expect(redoButton).toBeDisabled();
  await expect(editable).toContainText("可撤销内容。");
  await expect
    .poll(() => contentArea.evaluate((element) => element.scrollTop), { timeout: 5_000 })
    .toBeGreaterThanOrEqual(Math.max(0, positionBeforeUndo - 4));

  await clickToolbarAction(page, "源文本");
  const editor = page.getByRole("textbox", { name: "Markdown 源文本" });
  await expect.poll(() => readEditorText(editor)).toContain("可撤销内容。");

  await editor.click();
  await page.keyboard.press("Control+Z");
  await expect.poll(() => readEditorText(editor)).not.toContain("可撤销内容。");
  await page.keyboard.press("Control+Y");
  await expect.poll(() => readEditorText(editor)).toContain("可撤销内容。");
});

test("groups rapid source typing into one undo step", async ({ page }) => {
  await page.goto("/");
  const initialSource = "# Source history\n\n初始内容。\n";
  await page.locator('input[type="file"]').setInputFiles({
    name: "source-history.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(initialSource),
  });

  await expect(page.locator('.wysiwyg-editor [contenteditable="true"]')).toBeVisible({ timeout: 15_000 });
  await clickToolbarAction(page, "源文本");
  const editor = page.getByRole("textbox", { name: "Markdown 源文本" });
  await expect(editor).toBeVisible();
  await editor.click();
  await editor.press("Control+End");
  await page.keyboard.type("连续输入应作为一个撤销组。");
  await expect.poll(() => readEditorText(editor)).toContain("连续输入应作为一个撤销组。");

  await editor.press("Control+Z");
  await expect.poll(() => readEditorText(editor)).toBe(initialSource);

  await editor.press("Control+Y");
  await expect.poll(() => readEditorText(editor)).toContain("连续输入应作为一个撤销组。");
});

test("opens the command palette and restores trigger focus", async ({ page }) => {
  await page.goto("/");

  await openMoreMenu(page);
  const commandTrigger = page.getByRole("button", { name: "命令面板", exact: true });
  await commandTrigger.focus();
  await page.keyboard.press("Control+Shift+P");
  const palette = page.getByRole("dialog", { name: "命令面板" });
  await expect(palette).toBeVisible();
  await expect(palette.getByRole("option", { name: /打开文档/ })).toBeVisible();
  await expect(palette.getByRole("searchbox", { name: "搜索命令" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);
  await expect(commandTrigger).toBeFocused();
});

test("keeps supported markdown syntax through the wysiwyg editor", async ({ page }) => {
  const corpus = [
    "# 回归样例 Round Trip",
    "",
    "## 行内样式",
    "",
    "段落包含**加粗**、*斜体*、~~删除线~~和`行内代码`，以及一个[外部链接](https://example.com)。",
    "",
    "普通 Wiki 双链：[[Another note]]。",
    "",
    "## 列表与任务",
    "",
    "- 一级列表",
    "- 嵌套列表",
    "  1. 有序项",
    "  2. 另一个有序项",
    "",
    "- [ ] 未完成任务",
    "- [x] 已完成任务",
    "",
    "> 引用一行文字。",
    "",
    "## 代码与表格",
    "",
    "```ts",
    "const answer = 42;",
    "```",
    "",
    "| 列一 | 列二 |",
    "| ---- | ---- |",
    "| A | B |",
    "",
    "![示例图片](image.png)",
    "",
    "---",
    "",
    "结束段落。",
  ].join("\n");

  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "round-trip-sample.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(corpus),
  });

  await expect(page.locator(".wysiwyg-editor")).toBeVisible();
  // The Milkdown editing surface must actually mount; before the commonmark
  // preset fix the wrapper was visible while the contenteditable stayed blank.
  const editable = page.locator('.wysiwyg-editor [contenteditable="true"]');
  await expect(editable).toBeVisible({ timeout: 15_000 });

  // Make a net-zero edit (type a space, delete it) so the editor serializes
  // the document itself while keeping the content unchanged.
  await editable.click();
  await page.keyboard.type(" ");
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(300);

  await clickToolbarAction(page, "源文本");

  const editor = page.getByRole("textbox", { name: "Markdown 源文本" });
  await expectEditorText(editor, corpus);
});

test("keeps heading hierarchy and list rhythm readable", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "typography-sample.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# 主标题\n\n#### 四级标题\n\n- 一级项目\n  - 嵌套项目\n"),
  });

  await expect(page.locator(".wysiwyg-editor")).toBeVisible();
  const wysiwygHeading = page.locator(".wysiwyg-editor h4");
  await expect(wysiwygHeading).toHaveText("四级标题");
  const wysiwygFontSize = await wysiwygHeading.evaluate((element) => getComputedStyle(element).fontSize);
  expect(Number.parseFloat(wysiwygFontSize)).toBe(19);

  await switchToRenderedMode(page);

  const heading = page.locator(".markdown-body h4");
  const list = page.locator(".markdown-body ul").first();
  await expect(heading).toHaveText("四级标题");
  await expect(list).toBeVisible();

  const styles = await heading.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { fontSize: computed.fontSize, marginBottom: computed.marginBottom };
  });
  const listStyles = await list.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { marginBottom: computed.marginBottom, paddingLeft: computed.paddingLeft };
  });

  expect(Number.parseFloat(styles.fontSize)).toBe(19);
  expect(styles.marginBottom).toBe("10px");
  expect(listStyles.marginBottom).toBe("20px");
  expect(Number.parseFloat(listStyles.paddingLeft)).toBeGreaterThan(0);
});

test("inserts a heading from the wysiwyg slash menu", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "slash-menu-sample.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("第一段。\n\n第二段。\n"),
  });

  const editable = page.locator('.wysiwyg-editor [contenteditable="true"]');
  await expect(editable).toBeVisible({ timeout: 15_000 });

  // Move to the end of the document and start a fresh empty paragraph so the
  // slash trigger is deterministic regardless of where the click lands.
  await editable.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");

  await page.keyboard.type("/");
  const overlay = page.getByRole("listbox", { name: "块级命令候选" });
  await expect(overlay).toBeVisible();
  await expect(overlay.getByRole("option", { name: /标题 1/ })).toBeVisible();

  // Arrow navigation must wrap through the same state used by Enter/Tab.
  await page.keyboard.press("ArrowDown");
  await expect(overlay.getByRole("option", { name: /标题 2/ })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowUp");
  await expect(overlay.getByRole("option", { name: /标题 1/ })).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("Escape");
  await expect(overlay).toHaveCount(0);
  await page.keyboard.press("Backspace");

  await page.keyboard.type("/h1");
  await expect(overlay.getByRole("option", { name: /标题 1/ })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(overlay).toHaveCount(0);

  await page.keyboard.type("新标题");
  await expect(page.locator(".wysiwyg-editor h1", { hasText: "新标题" })).toBeVisible();

  await clickToolbarAction(page, "源文本");
  const editor = page.getByRole("textbox", { name: "Markdown 源文本" });
  await expect.poll(async () => (await readEditorText(editor)).trim()).toContain("# 新标题");
});

test("inserts a list from the source mode slash menu", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "slash-source-sample.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# 源码模式\n\n正文。\n"),
  });

  await clickToolbarAction(page, "源文本");
  const editor = page.getByRole("textbox", { name: "Markdown 源文本" });
  await expect(editor).toBeVisible();

  // Control+End lands on the empty trailing line where `/` triggers the menu.
  await editor.click();
  await page.keyboard.press("Control+End");
  // Type with delays: the slash source re-runs on every keystroke, so the
  // menu rebuilds asynchronously and a burst-typed query races the Enter key.
  await editor.pressSequentially("/ul", { delay: 80 });

  const tooltip = page.locator(".cm-tooltip-autocomplete");
  await expect(tooltip).toBeVisible();
  // Exact text: the unfiltered menu also contains "无序列表", so a regex match
  // could pass before the query has been applied.
  await expect(tooltip).toHaveText("无序列表- 列表项");

  await page.keyboard.press("Enter");
  await expect.poll(async () => readEditorText(editor)).toContain("- ");
});

test("opens an editor context menu and keeps the selected Markdown formatting", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "context-menu-sample.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Context menu\n\n选择这段文字。\n"),
  });

  const editable = page.locator('.wysiwyg-editor [contenteditable="true"]');
  await expect(editable).toBeVisible({ timeout: 15_000 });
  const paragraph = page.locator(".wysiwyg-editor .editor p").first();
  await paragraph.selectText();
  await paragraph.click({ button: "right" });

  const menu = page.getByRole("menu", { name: "正文编辑菜单" });
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: "粗体" }).click();
  await expect(menu).toHaveCount(0);

  await clickToolbarAction(page, "源文本");
  const source = page.getByRole("textbox", { name: "Markdown 源文本" });
  await expect.poll(async () => readEditorText(source)).toContain("**选择这段文字。**");
});

test("pastes clipboard text from the editor context menu", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText: async () => "右键粘贴内容" },
    });
  });
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "context-menu-paste.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Context menu paste\n\n原文\n"),
  });

  const editable = page.locator('.wysiwyg-editor [contenteditable="true"]');
  await expect(editable).toBeVisible({ timeout: 15_000 });
  await page.locator(".wysiwyg-editor .editor p").filter({ hasText: "原文" }).click({ button: "right" });

  const menu = page.getByRole("menu", { name: "正文编辑菜单" });
  await expect(menu.getByRole("menuitem", { name: "粘贴 Ctrl V", exact: true })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "粘贴为纯文本", exact: true })).toBeVisible();
  await menu.getByRole("menuitem", { name: "粘贴 Ctrl V", exact: true }).click();

  await clickToolbarAction(page, "源文本");
  const source = page.getByRole("textbox", { name: "Markdown 源文本" });
  await expect.poll(async () => readEditorText(source)).toContain("右键粘贴内容");
});

test("finds selected text from the editor context menu", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "context-menu-find.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Context menu find\n\n在当前文档中查找这句话。\n"),
  });

  const editable = page.locator('.wysiwyg-editor [contenteditable="true"]');
  await expect(editable).toBeVisible({ timeout: 15_000 });
  const paragraph = page.locator(".wysiwyg-editor .editor p").first();
  await paragraph.selectText();
  await paragraph.click({ button: "right" });

  const menu = page.getByRole("menu", { name: "正文编辑菜单" });
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: "查找选中文本" }).click();

  await expect(page.getByRole("searchbox", { name: "搜索文档" })).toHaveValue("在当前文档中查找这句话。");
});

test("opens a reader context menu for selected text and links", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "reader-context-menu.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      "# Reader context menu\n\n阅读模式中的选中文本。\n\n" +
        Array.from({ length: 40 }, (_, index) => `第 ${index + 1} 行用于验证右键菜单不会随正文滚动漂移。`).join(
          "\n\n",
        ) +
        "\n\n[外部链接](https://example.com)\n",
    ),
  });

  await expect(page.locator('.wysiwyg-editor [contenteditable="true"]')).toBeVisible({ timeout: 15_000 });
  await switchToRenderedMode(page);

  const paragraph = page.locator(".reader-content p").filter({ hasText: "阅读模式中的选中文本" }).first();
  await paragraph.selectText();
  const paragraphBox = await paragraph.boundingBox();
  expect(paragraphBox).not.toBeNull();
  const clickPosition = { x: 24, y: Math.min(12, Math.max(4, (paragraphBox?.height ?? 16) / 2)) };
  const expectedPoint = {
    x: (paragraphBox?.x ?? 0) + clickPosition.x,
    y: (paragraphBox?.y ?? 0) + clickPosition.y,
  };
  await paragraph.click({ button: "right", position: clickPosition });

  const menu = page.getByRole("menu", { name: "阅读内容菜单" });
  await expect(menu).toBeVisible();
  await page.waitForTimeout(150);
  const menuBeforeScroll = await menu.boundingBox();
  expect(menuBeforeScroll).not.toBeNull();
  expect(Math.abs((menuBeforeScroll?.x ?? 0) - expectedPoint.x)).toBeLessThanOrEqual(4);
  expect(Math.abs((menuBeforeScroll?.y ?? 0) - expectedPoint.y)).toBeLessThanOrEqual(4);
  await page.locator(".content-area").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await page.waitForTimeout(150);
  const menuAfterScroll = await menu.boundingBox();
  expect(menuAfterScroll).not.toBeNull();
  expect(Math.abs((menuAfterScroll?.x ?? 0) - (menuBeforeScroll?.x ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((menuAfterScroll?.y ?? 0) - (menuBeforeScroll?.y ?? 0))).toBeLessThanOrEqual(1);
  await expect(menu.getByRole("menuitem", { name: "复制选中文本" })).toBeEnabled();
  await expect(menu.getByRole("menuitem", { name: "查找选中文本" })).toBeEnabled();
  await menu.getByRole("menuitem", { name: "查找选中文本" }).click();
  await expect(page.getByRole("searchbox", { name: "搜索文档" })).toBeVisible();

  await page.keyboard.press("Escape");
  const link = page.locator('.reader-content a[href="https://example.com"]');
  await link.click({ button: "right" });
  const linkMenu = page.getByRole("menu", { name: "阅读内容菜单" });
  await expect(linkMenu.getByRole("menuitem", { name: "复制链接地址" })).toBeVisible();
  await expect(linkMenu.getByRole("menuitem", { name: "打开链接" })).toBeVisible();
});

test("adds, jumps to and deletes a document bookmark", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "bookmark-slice.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      [
        "# Bookmark slice",
        "",
        ...Array.from({ length: 36 }, (_, index) => `前置阅读内容 ${index + 1}，用于验证书签跳转。`),
        "",
        "## Important section",
        "",
        "需要稍后回来的内容。",
      ].join("\n"),
    ),
  });

  await expect(page.locator('.wysiwyg-editor [contenteditable="true"]')).toBeVisible({ timeout: 15_000 });
  await switchToRenderedMode(page);

  await page.getByRole("heading", { name: "Important section" }).click({ button: "right" });
  const menu = page.getByRole("menu", { name: "阅读内容菜单" });
  await expect(menu.getByRole("menuitem", { name: "添加书签" })).toBeVisible();
  await menu.getByRole("menuitem", { name: "添加书签" }).click();

  await page.getByRole("tab", { name: "书签" }).click();
  const bookmark = page.getByRole("button", { name: "打开书签：bookmark-slice.md · #important-section" });
  await expect(bookmark).toBeVisible();

  const contentArea = page.locator(".content-area");
  await contentArea.evaluate((element) => {
    element.scrollTop = 0;
  });
  await bookmark.click();
  await expect.poll(() => contentArea.evaluate((element) => element.scrollTop)).toBeGreaterThan(100);

  await page.getByRole("button", { name: "删除书签：bookmark-slice.md · #important-section" }).click();
  await expect(bookmark).toHaveCount(0);
});

test("keeps keyboard context menus contained and returns focus across tabs, reader, and editor", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "keyboard-context-first.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Keyboard context first\n\n第一份文档。\n"),
    },
    {
      name: "keyboard-context-second.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Keyboard context second\n\n第二份文档。\n"),
    },
  ]);

  const firstTab = page.getByRole("button", { name: "keyboard-context-first.md", exact: true });
  await expect(firstTab).toBeVisible();
  await firstTab.focus();
  await page.keyboard.press("Shift+F10");
  const tabMenu = page.getByRole("menu", { name: "标签页管理菜单" });
  await expect(tabMenu).toBeVisible();
  const tabItems = tabMenu.getByRole("menuitem");
  await expect(tabItems.first()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(tabItems.nth(1)).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(tabItems.first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(firstTab).toBeFocused();

  await switchToRenderedMode(page);
  const reader = page.locator(".reader-content");
  await reader.focus();
  await page.keyboard.press("Shift+F10");
  const readerMenu = page.getByRole("menu", { name: "阅读内容菜单" });
  await expect(readerMenu).toBeVisible();
  const readerItems = readerMenu.locator('button[role="menuitem"]:not(:disabled)');
  await expect(readerItems.first()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(readerItems.nth(1)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(reader).toBeFocused();

  await page.keyboard.press("Control+E");
  const editable = page.locator('.wysiwyg-editor [contenteditable="true"]');
  await expect(editable).toBeVisible({ timeout: 15_000 });
  await editable.focus();
  await page.keyboard.press("Shift+F10");
  const editorMenu = page.getByRole("menu", { name: "正文编辑菜单" });
  await expect(editorMenu).toBeVisible();
  const editorItems = editorMenu.locator('button[role="menuitem"]:not(:disabled)');
  await page.keyboard.press("Tab");
  await expect(editorItems.nth(1)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(editable).toBeFocused();
});

test("serializes equivalent markdown styles to canonical forms", async ({ page }) => {
  // Issue #157: the WYSIWYG serializer rewrites several equivalent styles to
  // one canonical form. This test pins the exact output so a Milkdown/remark
  // upgrade that changes the canonicalization fails loudly here instead of
  // surfacing as mysterious diff noise in user files. Update
  // docs/decisions/0004-serialization-normalization.md together with this
  // expectation.
  const corpus = [
    "标题一",
    "=====",
    "",
    "Setext 二级",
    "-----------",
    "",
    "- 一级列表",
    "  - 嵌套列表",
    "",
    "---",
    "",
    "|窄|表|",
    "|---|---|",
    "|A|B|",
    "",
    "普通 [[双链]] 与 [[别名|目标]]。",
    "",
    "> 引用一",
    ">> 嵌套引用",
    "",
    "见 [引用文字][ref]。",
    "",
    "[ref]: https://example.com",
  ].join("\n");

  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "serialization-normalization.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(corpus),
  });

  await expect(page.locator(".wysiwyg-editor")).toBeVisible();
  const editable = page.locator('.wysiwyg-editor [contenteditable="true"]');
  await expect(editable).toBeVisible({ timeout: 15_000 });

  // Net-zero edit so the editor serializes the document itself.
  await editable.click();
  await page.keyboard.type(" ");
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(300);

  await clickToolbarAction(page, "源文本");

  const expected = [
    "# 标题一",
    "",
    "## Setext 二级",
    "",
    "* 一级列表",
    "  * 嵌套列表",
    "",
    "***",
    "",
    "| 窄 | 表 |",
    "| - | - |",
    "| A | B |",
    "",
    "普通 \\[\\[双链]] 与 \\[\\[别名|目标]]。",
    "",
    "> 引用一",
    ">",
    "> > 嵌套引用",
    "",
    "见 [引用文字](https://example.com)。",
    "",
  ].join("\n");

  const editor = page.getByRole("textbox", { name: "Markdown 源文本" });
  await expect.poll(() => readEditorText(editor), { timeout: 10_000 }).toBe(expected);
});

test("downgrades a heading one level per Backspace at its start", async ({ page }) => {
  // Issue #156 investigation: Milkdown's heading keymap binds Backspace/Delete at
  // offset 0 of a heading to downgradeHeadingCommand. This is intentional and
  // matches Obsidian/Typora ("delete one `#` level at line start"), not the
  // intermittent corruption from #156 (which #159's debounce/teardown flush fixes
  // already cover). Pin the exact downgrade semantics so a Milkdown upgrade that
  // changes them fails here instead of surprising users.
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "heading-downgrade.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("## 二级标题\n\n正文段落。\n"),
  });

  await expect(page.locator(".wysiwyg-editor")).toBeVisible();
  const editable = page.locator('.wysiwyg-editor [contenteditable="true"]');
  await expect(editable).toBeVisible({ timeout: 15_000 });
  await expect(editable.locator("h2")).toBeVisible();

  await editable.locator("h2").click({ position: { x: 4, y: 4 } });
  await page.keyboard.press("Backspace");
  await expect(editable.locator("h2")).toHaveCount(0);
  await expect(editable.locator("h1")).toBeVisible();
  await expect(editable.locator("h1")).toContainText("二级标题");

  // A second Backspace at the H1 start turns it into a paragraph, again
  // matching the "delete the `# ` prefix" semantics.
  await page.keyboard.press("Backspace");
  await expect(editable.locator("h1")).toHaveCount(0);
  await expect(editable.locator("p").first()).toContainText("二级标题");
});

test("opens multiple browser-selected documents as tabs", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "first-note.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# First note"),
    },
    {
      name: "second-note.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Second note"),
    },
  ]);

  await switchToRenderedMode(page);
  await expect(page.getByRole("heading", { name: "Second note" })).toBeVisible();
  await expect(page.getByRole("button", { name: "first-note.md", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "second-note.md", exact: true })).toBeVisible();
});

test("returns to previously selected documents with the navigation history shortcut", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "history-first.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# History first"),
    },
    {
      name: "history-second.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# History second"),
    },
    {
      name: "history-third.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# History third"),
    },
  ]);

  await switchToRenderedMode(page);
  const tabs = page.getByRole("button", { name: /history-(?:first|second|third)\.md/ });
  await tabs.filter({ hasText: "history-first.md" }).click();
  await expect(page.getByRole("heading", { name: "History first" })).toBeVisible();
  await tabs.filter({ hasText: "history-second.md" }).click();
  await expect(page.getByRole("heading", { name: "History second" })).toBeVisible();
  await tabs.filter({ hasText: "history-third.md" }).click();
  await expect(page.getByRole("heading", { name: "History third" })).toBeVisible();

  await page.keyboard.press("Control+Alt+ArrowLeft");
  await expect(page.getByRole("heading", { name: "History second" })).toBeVisible();

  await page.keyboard.press("Control+Shift+P");
  const backCommand = page.getByRole("option", { name: /返回上一文档/ });
  await expect(backCommand).toBeEnabled();
  await backCommand.click();
  await expect(page.getByRole("heading", { name: "History first" })).toBeVisible();
});

test("supports tab gestures and reading zoom shortcuts", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "gesture-first.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Gesture first"),
    },
    {
      name: "gesture-second.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Gesture second"),
    },
  ]);

  await switchToRenderedMode(page);
  const tabItems = page.locator(".tab-item");
  await expect(tabItems).toHaveCount(2);
  await expect(tabItems.first()).toHaveAttribute("draggable", "true");
  const reader = page.locator(".reader-content");
  await expect(reader).toHaveCSS("font-size", "17px");

  await tabItems.first().dragTo(tabItems.nth(1));
  await expect(page.locator(".tab-label")).toHaveText(["gesture-second.md", "gesture-first.md"]);

  await page.keyboard.press("Control+Equal");
  await expect(page.locator(".reading-zoom-hud")).toHaveText("阅读缩放 110%");
  await expect(reader).toHaveCSS("font-size", "18.7px");
  await page.keyboard.press("Control+0");
  await expect(page.locator(".reading-zoom-hud")).toHaveText("阅读缩放 100%");
  await page.locator(".reader-content").dispatchEvent("wheel", { deltaY: -100, ctrlKey: true });
  await expect(page.locator(".reading-zoom-hud")).toHaveText("阅读缩放 105%");

  await tabItems.first().click({ button: "middle" });
  await expect(page.locator(".tab-item")).toHaveCount(1);
});

test("keeps same-named browser documents in separate tabs", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "duplicate-note.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# First duplicate"),
    },
    {
      name: "duplicate-note.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Second duplicate"),
    },
  ]);

  await switchToRenderedMode(page);
  const tabs = page.getByRole("button", { name: "duplicate-note.md", exact: true });
  await expect(tabs).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Second duplicate" })).toBeVisible();

  await tabs.nth(0).click();
  await switchToRenderedMode(page);
  await expect(page.getByRole("heading", { name: "First duplicate" })).toBeVisible();
});

test("rejects unsupported browser files instead of rendering them as markdown", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "unknown-binary.exe",
    mimeType: "application/octet-stream",
    buffer: Buffer.from([0, 1, 2, 3]),
  });

  await expect(page.getByRole("alert")).toHaveText(/已跳过 1 个不支持的文件：unknown-binary\.exe/);
  await expect(page.getByRole("heading", { name: "把文档打开，专心阅读。" })).toBeVisible();
});

test("shows browser drag feedback and reports a partial drop", async ({ page }) => {
  await page.goto("/");

  await page.evaluate(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["# Dragged note\n"], "dragged-note.md", { type: "text/markdown" }));
    transfer.items.add(new File(["binary"], "unsupported.bin", { type: "application/octet-stream" }));
    const shell = document.querySelector(".app-shell");
    if (!shell) throw new Error("app shell was not found");
    (window as typeof window & { __moyangDragTransfer?: DataTransfer }).__moyangDragTransfer = transfer;
    shell.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    shell.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });

  const overlay = page.getByTestId("file-drop-overlay");
  await expect(overlay).toHaveAttribute("data-drop-support", "mixed");
  await expect(overlay).toContainText("松开即可打开可识别文件");

  await page.evaluate(() => {
    const shell = document.querySelector(".app-shell");
    if (!shell) throw new Error("app shell was not found");
    const transfer = (window as typeof window & { __moyangDragTransfer?: DataTransfer }).__moyangDragTransfer;
    if (!transfer) throw new Error("drag transfer was not stored");
    shell.dispatchEvent(
      new DragEvent("dragleave", {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
        relatedTarget: document.body,
      }),
    );
  });
  await expect(overlay).toHaveCount(0);

  await page.evaluate(() => {
    const shell = document.querySelector(".app-shell");
    if (!shell) throw new Error("app shell was not found");
    const transfer = (window as typeof window & { __moyangDragTransfer?: DataTransfer }).__moyangDragTransfer;
    if (!transfer) throw new Error("drag transfer was not stored");
    shell.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    shell.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    shell.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    delete (window as typeof window & { __moyangDragTransfer?: DataTransfer }).__moyangDragTransfer;
  });

  await expect(page.getByRole("heading", { name: "Dragged note" })).toBeVisible({ timeout: 15_000 });
  await expect(overlay).toHaveCount(0);
  await expect(page.locator('[data-testid="notification-viewport"] [data-notification-level="info"]')).toContainText(
    "已跳过 1 个不支持的文件",
  );
});

test("protects unsaved browser edits before opening another document", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "unsaved-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Unsaved note\n\n原始内容"),
  });
  await clickToolbarAction(page, "源文本");
  const editor = page.getByRole("textbox", { name: "Markdown 源文本" });
  await editor.fill("# Unsaved note\n\n尚未保存");

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("未保存修改");
    await dialog.dismiss();
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: "replacement-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Replacement note"),
  });

  await expectEditorText(editor, "# Unsaved note\n\n尚未保存");
});

test("keeps unsaved edits when changing local resource preferences", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "preference-draft.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Preference draft\n\n原始内容"),
  });
  await clickToolbarAction(page, "源文本");
  const editor = page.getByRole("textbox", { name: "Markdown 源文本" });
  await editor.fill("# Preference draft\n\n尚未保存的修改");

  await openSettingsMenu(page);
  await page.getByRole("checkbox", { name: "允许远程图片" }).check();

  await expectEditorText(editor, "# Preference draft\n\n尚未保存的修改");
});

test("shows the latest source draft after switching back to reading", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "draft-preview-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Original title\n\n原始内容"),
  });
  await clickToolbarAction(page, "源文本");
  const editor = page.getByRole("textbox", { name: "Markdown 源文本" });
  await editor.fill("# Draft title\n\n最新草稿内容");
  await clickToolbarAction(page, "阅读");

  await expect(page.getByRole("heading", { name: "Draft title" })).toBeVisible();
  await expect(page.getByText("最新草稿内容")).toBeVisible();
});

test("opens editor-local find from source mode", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "editor-search-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Editor search\n\nneedle one\n\nneedle two"),
  });
  await clickToolbarAction(page, "源文本");
  const editor = page.getByRole("textbox", { name: "Markdown 源文本" });
  await editor.press("Control+f");

  const searchInput = page.locator(".cm-search input").first();
  await expect(searchInput).toBeVisible();
  await expect(page.locator(".findbar")).toHaveCount(0);
  await searchInput.fill("needle");
  await searchInput.press("Escape");
  await expect(searchInput).toBeHidden();
});

test("inserts a Markdown link from source mode", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "link-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("链接文字"),
  });
  await clickToolbarAction(page, "源文本");
  const editor = page.getByRole("textbox", { name: "Markdown 源文本" });
  await editor.press("Control+a");
  await editor.press("Control+k");

  const insertDialog = page.getByRole("dialog", { name: "插入内容" });
  await expect(insertDialog).toBeVisible();
  await insertDialog.getByLabel("地址").fill("https://example.com");
  await insertDialog.getByRole("button", { name: "插入到正文" }).click();

  await expectEditorText(editor, "[链接文字](https://example.com)");
});

test("uses the in-app insertion panel for WYSIWYG links and source images/tables", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "insert-panel-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("选择文字"),
  });

  const editable = page.locator('.wysiwyg-editor [contenteditable="true"]');
  await expect(editable).toBeVisible({ timeout: 15_000 });
  await page.locator(".wysiwyg-editor .editor p").selectText();
  await page.locator(".wysiwyg-editor .editor-format-toolbar").getByRole("button", { name: "插入" }).click();

  const wysiwygDialog = page.getByRole("dialog", { name: "插入内容" });
  await expect(wysiwygDialog).toBeVisible();
  const linkTab = wysiwygDialog.getByRole("tab", { name: "链接" });
  await linkTab.focus();
  await linkTab.press("ArrowRight");
  await expect(wysiwygDialog.getByRole("tab", { name: "双链" })).toHaveAttribute("aria-selected", "true");
  await expect(wysiwygDialog.getByRole("tab", { name: "双链" })).toBeFocused();
  await linkTab.click();
  await wysiwygDialog.getByLabel("地址").fill("https://example.com");
  await wysiwygDialog.getByRole("button", { name: "插入到正文" }).click();

  await clickToolbarAction(page, "源文本");
  const source = page.getByRole("textbox", { name: "Markdown 源文本" });
  await expectEditorText(source, "[选择文字](https://example.com)");

  await source.press("Control+End");
  const sourceToolbar = page.locator(".code-mirror-editor .editor-format-toolbar");
  await sourceToolbar.getByRole("button", { name: "插入" }).click();
  const sourceDialog = page.getByRole("dialog", { name: "插入内容" });
  await sourceDialog.getByRole("tab", { name: "图片" }).click();
  await expect(sourceDialog.getByRole("button", { name: "浏览图片" })).toBeVisible();
  await sourceDialog.getByLabel("图片路径或 URL").fill("images/cover.png");
  await sourceDialog.getByLabel("替代文字").fill("封面");
  await sourceDialog.getByRole("button", { name: "插入到正文" }).click();
  await expect.poll(async () => readEditorText(source)).toContain("![封面](images/cover.png)");

  await source.press("Control+End");
  await sourceToolbar.getByRole("button", { name: "插入" }).click();
  await page.getByRole("dialog", { name: "插入内容" }).getByRole("tab", { name: "表格" }).click();
  const tableDialog = page.getByRole("dialog", { name: "插入内容" });
  await tableDialog.getByLabel("行数").fill("2");
  await tableDialog.getByLabel("列数").fill("4");
  await tableDialog.getByRole("button", { name: "插入到正文" }).click();
  await expect.poll(async () => readEditorText(source)).toContain("列 4");
  await expect(page.getByRole("dialog", { name: "插入内容" })).toHaveCount(0);
});

test("returns focus to the editor after cancelling an insertion panel", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "insert-focus-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# 插入焦点\n\n继续编辑"),
  });

  const editable = page.locator('.wysiwyg-editor [contenteditable="true"]');
  await expect(editable).toBeVisible({ timeout: 15_000 });
  await editable.click();
  await page.locator(".wysiwyg-editor .editor-format-toolbar").getByRole("button", { name: "插入" }).click();

  const insertDialog = page.getByRole("dialog", { name: "插入内容" });
  await expect(insertDialog).toBeVisible();
  await insertDialog.press("Escape");

  await expect(insertDialog).toHaveCount(0);
  await expect(editable).toBeFocused();
});

test("keeps the insert panel near the caret without hijacking a long-document viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "long-insert-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      [
        "# 长文档插入定位",
        "",
        ...Array.from(
          { length: 80 },
          (_, index) => `第 ${index + 1} 段正文，用于验证插入面板在长文档中部不会把阅读位置拉回顶部。`,
        ),
      ].join("\n\n"),
    ),
  });

  const editable = page.locator('.wysiwyg-editor [contenteditable="true"]');
  await expect(editable).toBeVisible({ timeout: 15_000 });
  const contentArea = page.locator(".content-area");
  await expect
    .poll(() => contentArea.evaluate((element) => element.scrollHeight), { timeout: 5_000 })
    .toBeGreaterThan(1_500);

  const middleParagraph = page.locator(".wysiwyg-editor .editor p").nth(40);
  await middleParagraph.scrollIntoViewIfNeeded();
  await middleParagraph.click();
  const scrollTopBeforeOpen = await contentArea.evaluate((element) => element.scrollTop);
  expect(scrollTopBeforeOpen).toBeGreaterThan(100);

  await page.keyboard.press("Control+k");
  const insertDialog = page.getByRole("dialog", { name: "插入内容" });
  await expect(insertDialog).toBeVisible();
  await expect
    .poll(async () => {
      const box = await insertDialog.boundingBox();
      const viewport = page.viewportSize();
      if (!box || !viewport) return false;
      return box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height;
    })
    .toBe(true);
  expect(await contentArea.evaluate((element) => element.scrollTop)).toBe(scrollTopBeforeOpen);

  await contentArea.evaluate((element) => {
    element.scrollTop += 80;
    element.dispatchEvent(new Event("scroll"));
  });
  await expect(insertDialog).toHaveCount(0);
  await expect(editable).toBeFocused();
});

test("debounces in-document search and navigates highlighted matches", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "search-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Search note\n\nneedle one\n\nneedle two\n\nneedle three"),
  });
  await switchToRenderedMode(page);
  await expect(page.getByRole("heading", { name: "Search note" })).toBeVisible();

  await page.getByRole("button", { name: "搜索" }).click();
  await page.getByRole("searchbox", { name: "搜索文档" }).fill("needle");

  await expectSearchHighlightCount(page, 3);
  await expect(page.locator(".find-count")).toHaveText("1 / 3");

  await page.getByRole("button", { name: "下一个结果" }).click();
  await expect(page.locator(".find-count")).toHaveText("2 / 3");
  await expect(page.locator("article.reader-content")).toHaveAttribute("data-search-active-result", "2");

  await page.getByRole("button", { name: "上一个结果" }).click();
  await expect(page.locator(".find-count")).toHaveText("1 / 3");
  await expect(page.locator("article.reader-content")).toHaveAttribute("data-search-active-result", "1");
});

test("keeps search highlights readable when following the system dark theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "system-dark-search-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# System dark search\n\nneedle one\n\nneedle two"),
  });
  await switchToRenderedMode(page);

  await page.getByRole("button", { name: "搜索" }).click();
  await page.getByRole("searchbox", { name: "搜索文档" }).fill("needle");

  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  await expectSearchHighlightCount(page, 2);
  await expect(page.locator("article.reader-content")).toHaveAttribute("data-search-active-result", "1");
});

test("enters and exits focus reading mode", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "focus-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Focus note\n\n专注阅读测试"),
  });
  await switchToRenderedMode(page);
  await expect(page.getByRole("heading", { name: "Focus note" })).toBeVisible();

  await page.getByRole("button", { name: "专注", exact: true }).click();
  await expect(page.locator(".app-shell")).toHaveClass(/focus-mode/);
  await expect(page.getByRole("button", { name: /退出专注/ })).toBeVisible();
  await expect(page.locator(".sidebar")).toBeHidden();

  await page.keyboard.press("Escape");
  await expect(page.locator(".app-shell")).not.toHaveClass(/focus-mode/);
  await expect(page.getByRole("button", { name: "专注", exact: true })).toBeVisible();
});

test("collapses and restores the reading sidebar", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "sidebar-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Sidebar note\n\n侧栏切换测试"),
  });
  await switchToRenderedMode(page);
  await expect(page.getByRole("heading", { name: "Sidebar note" })).toBeVisible();

  const toggle = page.locator(".sidebar-toggle");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".app-shell")).toHaveClass(/sidebar-collapsed/);
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".sidebar-restore")).toBeVisible();

  await page.keyboard.press("Control+Shift+B");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".app-shell")).not.toHaveClass(/sidebar-collapsed/);
  await expect(page.locator(".sidebar")).toBeVisible();
});

test("shows a reading rail with progress and edge navigation", async ({ page }) => {
  await page.goto("/");

  const sections = Array.from(
    { length: 36 },
    (_, index) => `## Section ${index + 1}\n\n这一段用于验证阅读进度和当前章节提示。\n\n`,
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: "reading-rail-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(`# Reading rail\n\n阅读轨道测试。\n\n${sections.join("")}`),
  });
  await switchToRenderedMode(page);

  const rail = page.getByRole("complementary", { name: "阅读进度" });
  await expect(rail).toBeVisible();
  const progress = rail.getByRole("progressbar", { name: "文档阅读进度" });
  await expect(progress).toHaveAttribute("aria-valuenow", "0");
  await expect(rail.getByText("Reading rail")).toBeVisible();
  await expect(page.locator(".outline-list a.active")).toHaveText("Reading rail");

  await page.locator(".content-area").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event("scroll"));
  });
  await expect(progress).toHaveAttribute("aria-valuenow", "100");
  await expect(page.locator(".outline-list a.active")).toHaveText("Section 36");

  await rail.getByRole("button", { name: "顶部" }).click();
  await expect.poll(() => page.locator(".content-area").evaluate((element) => element.scrollTop)).toBe(0);
  await expect(progress).toHaveAttribute("aria-valuenow", "0");

  await page.getByRole("link", { name: "Section 10" }).click();
  await expect(page.locator(".outline-list a.active")).toHaveText("Section 10");
});

test("does not scan every heading on each reading scroll update", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const sections = Array.from(
    { length: 120 },
    (_, index) => `## Performance section ${index + 1}\n\n${"Long reading paragraph ".repeat(12)}\n\n`,
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: "reading-rail-performance.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(`# Performance\n\n${sections.join("")}`),
  });
  await switchToRenderedMode(page);
  await expect(page.locator(".reader-content h1")).toHaveText("Performance");

  await page.evaluate(() => {
    const metricsWindow = window as Window & {
      __readingRailMetrics?: { headingQueries: number; headingRects: number };
    };
    metricsWindow.__readingRailMetrics = { headingQueries: 0, headingRects: 0 };

    const originalQuerySelectorAll = Element.prototype.querySelectorAll;
    Element.prototype.querySelectorAll = function (selector: string) {
      if (selector === "h1, h2, h3, h4") metricsWindow.__readingRailMetrics!.headingQueries += 1;
      return originalQuerySelectorAll.call(this, selector);
    };

    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.matches("h1, h2, h3, h4") && this.closest(".reader-content")) {
        metricsWindow.__readingRailMetrics!.headingRects += 1;
      }
      return originalGetBoundingClientRect.call(this);
    };
  });

  const metrics = await page.locator(".content-area").evaluate(async (element) => {
    for (let index = 0; index < 20; index += 1) {
      element.scrollTop = (element.scrollHeight - element.clientHeight) * (index / 19);
      element.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    return (window as Window & { __readingRailMetrics?: { headingQueries: number; headingRects: number } })
      .__readingRailMetrics;
  });

  expect(metrics?.headingQueries ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);
  expect(metrics?.headingRects ?? Number.POSITIVE_INFINITY).toBeLessThan(500);
});

test("previews the print layout before exporting a document", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "print-preview-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Print preview\n\n## 章节\n\n打印版式预览测试"),
  });
  await switchToRenderedMode(page);
  await expect(page.getByRole("heading", { name: "Print preview" })).toBeVisible();

  await openMoreMenu(page);
  await page.locator(".topbar .export-menu summary").click();
  await page.getByRole("button", { name: "预览打印版式" }).click();
  await expect(page.locator(".topbar .export-menu")).not.toHaveAttribute("open");

  const dialog = page.getByRole("dialog", { name: "打印版式预览" });
  await expect(dialog).toBeVisible();
  const previewFrame = dialog.locator('iframe[title="print-preview-note.md 打印版式"]');
  await expect(previewFrame).toBeVisible();
  await expect(previewFrame).toHaveAttribute("srcdoc", /export-toc/);
  await expect(dialog.getByText("A4 · 纵向 · 标准页边距")).toBeVisible();
  await expect(dialog.getByRole("status", { name: "打印分页估算" })).toHaveText(/预计 1 页/);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("persists reading layout preferences", async ({ page }) => {
  await page.goto("/");

  await openSettingsMenu(page);
  const readingZoom = page.getByLabel("阅读缩放");
  await readingZoom.focus();
  await readingZoom.press("ArrowRight");
  await readingZoom.press("ArrowRight");
  await readingZoom.press("ArrowRight");
  await page.getByLabel("正文宽度").selectOption("narrow");
  await page.getByLabel("导出纸张").selectOption("letter");
  await page.getByLabel("导出方向").selectOption("landscape");
  await page.getByLabel("导出页边距").selectOption("compact");
  await page.reload();
  await openSettingsMenu(page);

  await expect(page.getByLabel("阅读缩放")).toHaveValue("115");
  await expect(page.getByLabel("正文宽度")).toHaveValue("narrow");
  await expect(page.getByLabel("导出纸张")).toHaveValue("letter");
  await expect(page.getByLabel("导出方向")).toHaveValue("landscape");
  await expect(page.getByLabel("导出页边距")).toHaveValue("compact");
});

test("stacks setting feedback without shifting the reading layout", async ({ page }) => {
  await page.goto("/");
  await openSettingsMenu(page);

  const contentArea = page.locator(".content-area");
  const before = await contentArea.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, height: rect.height, scrollTop: element.scrollTop };
  });

  await page.getByLabel("正文宽度").selectOption("narrow");
  await page.getByLabel("导出纸张").selectOption("letter");
  await page.getByLabel("导出方向").selectOption("landscape");
  await page.getByLabel("导出页边距").selectOption("compact");

  const messages = page.locator(".notification-viewport .app-notification");
  await expect(messages).toHaveCount(3);
  await expect(messages.nth(0)).toContainText("正文宽度已更新");
  await expect(messages.nth(1)).toContainText("导出纸张已更新");
  await expect(messages.nth(2)).toContainText("导出方向已更新");
  await expect(messages.nth(0)).toHaveAttribute("role", "status");

  const after = await contentArea.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, height: rect.height, scrollTop: element.scrollTop };
  });
  expect(after).toEqual(before);
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(viewport.bodyScrollWidth).toBeLessThanOrEqual(viewport.clientWidth);

  await messages
    .nth(0)
    .getByRole("button", { name: /关闭通知/ })
    .click();
  await expect(messages).toHaveCount(3);
  await expect(messages.nth(2)).toContainText("导出页边距已更新");
});

test("dismisses setting feedback with the keyboard in a narrow window", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await openSettingsMenu(page);

  const contentArea = page.locator(".content-area");
  const before = await contentArea.evaluate((element) => element.getBoundingClientRect().top);
  await page.getByLabel("正文宽度").selectOption("wide");

  const dismissButton = page.locator(".app-notification-dismiss").first();
  await dismissButton.focus();
  await expect(dismissButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".app-notification")).toHaveCount(0);

  const after = await contentArea.evaluate((element) => element.getBoundingClientRect().top);
  expect(after).toBe(before);
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(viewport.bodyScrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
});

test("opens and closes the getting started guide from the empty state", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "查看使用教程" }).click();
  const dialog = page.getByRole("dialog", { name: "快速上手 Moyang Reader" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("添加阅读库");
  await expect(dialog).toContainText("设置保存到本机");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("switches and remembers the core interface locale", async ({ page }) => {
  await page.goto("/");

  await openSettingsMenu(page);
  await page.getByLabel("界面语言").selectOption("en-US");

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("button", { name: "Folder", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Sidebar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Folder", exact: true })).toBeVisible();
  await expect(page.locator(".settings-menu")).not.toHaveAttribute("open");
  await expect(page.getByText("LOCAL FIRST")).not.toBeVisible();

  await page.reload();
  await openSettingsMenu(page, "Settings");
  await expect(page.getByLabel("Interface language")).toHaveValue("en-US");
});

test("keeps remote images off until the local privacy setting is enabled", async ({ page }) => {
  await page.goto("/");

  await openSettingsMenu(page);
  await expect(page.getByRole("checkbox", { name: "允许远程图片" })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "启动时检查更新" })).not.toBeChecked();

  await page.locator('input[type="file"]').setInputFiles({
    name: "privacy.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("![tracking](https://example.com/pixel.png)"),
  });
  await switchToRenderedMode(page);
  await openSettingsMenu(page);

  const image = page.locator(".reader-content img");
  await expect(image).toHaveCount(1);
  await expect(image).not.toHaveAttribute("src", /https:\/\//);

  await page.getByRole("checkbox", { name: "允许远程图片" }).check();
  await expect(image).toHaveAttribute("src", "https://example.com/pixel.png");

  await page.reload();
  await openSettingsMenu(page);
  await expect(page.getByRole("checkbox", { name: "允许远程图片" })).toBeChecked();
});

test("opens external links outside the reader window", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "external-link.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("[打开外部链接](https://example.com/reference)"),
  });
  await switchToRenderedMode(page);

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name: "打开外部链接" }).click();
  const popup = await popupPromise;

  await expect(popup).toHaveURL("https://example.com/reference");
  await expect(page).toHaveTitle("Moyang Reader");
});

test("keeps the reader inside a narrow viewport when long inline content wraps", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const extensions = Array.from({ length: 24 }, (_, index) => `\`.format-${index}\``).join("、");
  await page.locator('input[type="file"]').setInputFiles({
    name: "mobile-layout.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(`# Mobile layout\n\n运行安装程序后会注册 ${extensions}，并继续保持本地阅读。`),
  });
  await switchToRenderedMode(page);

  await expect(page.getByRole("heading", { name: "Mobile layout" })).toBeVisible();
  const metrics = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    contentScrollWidth: document.querySelector(".content-area")?.scrollWidth ?? 0,
    contentClientWidth: document.querySelector(".content-area")?.clientWidth ?? 0,
    articleScrollWidth: document.querySelector(".reader-content")?.scrollWidth ?? 0,
    articleClientWidth: document.querySelector(".reader-content")?.clientWidth ?? 0,
  }));

  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.contentScrollWidth).toBe(metrics.contentClientWidth);
  expect(metrics.articleScrollWidth).toBe(metrics.articleClientWidth);
});

test("keeps compact toolbar actions discoverable without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "compact-toolbar.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Compact toolbar\n\nKeep the reader usable in a compact window."),
  });
  await expect(page.getByRole("heading", { name: "Compact toolbar" })).toBeVisible();
  await page.locator('button[title="隐藏侧栏 (Ctrl+Shift+B)"]').click();

  const toolbar = page.locator(".toolbar");
  await expect(toolbar.locator(".toolbar-overflow-trigger")).toBeVisible();
  const metrics = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    toolbarClientWidth: document.querySelector(".toolbar")?.clientWidth ?? 0,
    toolbarScrollWidth: document.querySelector(".toolbar")?.scrollWidth ?? 0,
  }));
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.toolbarScrollWidth).toBe(metrics.toolbarClientWidth);

  await openMoreMenu(page);
  await expect(
    page.locator(".toolbar-overflow-panel").getByRole("button", { name: "快速打开", exact: true }),
  ).toBeVisible();
});

test("keeps toolbar icons consistent and readable at 900px", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 820 });
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "toolbar-icons.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Toolbar icons\n\nKeep high-frequency actions easy to scan."),
  });
  await expect(page.getByRole("heading", { name: "Toolbar icons" })).toBeVisible();

  const visibleIconNames = await page
    .locator(".topbar .toolbar .moyang-icon:visible")
    .evaluateAll((icons) => icons.map((icon) => icon.getAttribute("data-icon")));
  expect(visibleIconNames).toEqual(["folder-open", "panel-left", "panel-right", "search", "more-horizontal"]);

  const metrics = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    toolbarScrollWidth: document.querySelector(".toolbar")?.scrollWidth ?? 0,
    toolbarClientWidth: document.querySelector(".toolbar")?.clientWidth ?? 0,
  }));
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.toolbarScrollWidth).toBe(metrics.toolbarClientWidth);

  await openMoreMenu(page);
  for (const iconName of ["settings", "printer", "download"] as const) {
    await expect(page.locator(`.topbar .moyang-icon[data-icon="${iconName}"]`)).toBeVisible();
  }

  const renderState = await page.locator(".topbar .moyang-icon").evaluateAll((icons) =>
    icons.map((icon) => ({
      color: getComputedStyle(icon).color,
      stroke: icon.getAttribute("stroke"),
    })),
  );
  expect(renderState.every(({ color, stroke }) => color !== "rgba(0, 0, 0, 0)" && stroke === "currentColor")).toBe(
    true,
  );

  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await expect(page.locator(".topbar .moyang-icon").first()).toBeVisible();
  await page.emulateMedia({ forcedColors: "active" });
  await expect.poll(() => page.evaluate(() => window.matchMedia("(forced-colors: active)").matches)).toBe(true);
  const highContrastState = await page
    .locator(".topbar .moyang-icon")
    .evaluateAll((icons) => icons.map((icon) => icon.getAttribute("stroke")));
  expect(highContrastState.every((stroke) => stroke === "currentColor")).toBe(true);
  expect((await page.locator(".topbar").screenshot()).byteLength).toBeGreaterThan(0);
});

test("keeps core actions visible and secondary actions in More at Windows widths", async ({ page }) => {
  for (const width of [720, 960, 1180]) {
    await page.setViewportSize({ width, height: 820 });
    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles({
      name: `windows-width-${width}.md`,
      mimeType: "text/markdown",
      buffer: Buffer.from(`# Windows width ${width}\n\nKeep the reader usable in a compact window.`),
    });
    await expect(page.getByRole("heading", { name: `Windows width ${width}` })).toBeVisible();

    const toolbar = page.locator(".toolbar");
    await expect(toolbar.locator(".toolbar-overflow-trigger")).toBeVisible();
    await expect(toolbar.locator(":scope > .toolbar-optional")).toHaveCount(3);
    await expect(toolbar.locator(":scope > .toolbar-optional").first()).toBeHidden();

    const metrics = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      toolbarClientWidth: document.querySelector(".toolbar")?.clientWidth ?? 0,
      toolbarScrollWidth: document.querySelector(".toolbar")?.scrollWidth ?? 0,
    }));
    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.toolbarScrollWidth).toBe(metrics.toolbarClientWidth);

    await openMoreMenu(page);
    await expect(
      page.locator(".toolbar-overflow-panel").getByRole("button", { name: "快速打开", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(".toolbar-overflow-panel").getByRole("button", { name: "专注", exact: true }),
    ).toBeVisible();
  }
});

test("keeps topbar overlays mutually exclusive", async ({ page }) => {
  await page.goto("/");

  await openSettingsMenu(page);
  await expect(page.locator(".settings-menu")).toHaveAttribute("open", "");
  await expect(page.locator(".toolbar-overflow-panel")).toBeVisible();
  const menuGeometry = await page.locator(".toolbar-overflow-panel").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      right: rect.right,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });
  expect(menuGeometry.bottom).toBeLessThanOrEqual(menuGeometry.viewportHeight);
  expect(menuGeometry.right).toBeLessThanOrEqual(menuGeometry.viewportWidth);

  await page.getByRole("button", { name: "搜索", exact: true }).click();
  await expect(page.locator(".settings-menu")).not.toHaveAttribute("open");
  await expect(page.getByRole("searchbox", { name: "搜索文档" })).toBeVisible();

  await openSettingsMenu(page);
  await expect(page.getByRole("searchbox", { name: "搜索文档" })).toHaveCount(0);
  await expect(page.locator(".settings-menu")).toHaveAttribute("open", "");
});

test("dismisses topbar menus with an outside click or Escape", async ({ page }) => {
  await page.goto("/");

  await openSettingsMenu(page);
  const overflowMenu = page.locator(".toolbar-overflow");
  const settingsMenu = page.locator(".settings-menu");
  const exportMenu = page.locator(".export-menu");
  await expect(settingsMenu).toHaveAttribute("open", "");
  await page.locator(".empty-state").click();
  await expect(settingsMenu).not.toHaveAttribute("open");
  await expect(overflowMenu).not.toHaveAttribute("open");

  await openSettingsMenu(page);
  await page.keyboard.press("Escape");
  await expect(settingsMenu).not.toHaveAttribute("open");
  await expect(overflowMenu).not.toHaveAttribute("open");

  await page.locator('input[type="file"]').setInputFiles({
    name: "menu-dismiss.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Menu dismiss"),
  });
  await expect(page.getByRole("heading", { name: "Menu dismiss" })).toBeVisible();
  await switchToRenderedMode(page);
  await openMoreMenu(page);
  await page.locator(".topbar .export-menu summary").click();
  await expect(exportMenu).toHaveAttribute("open", "");
  await page.locator(".reader-content").click({ position: { x: 20, y: 120 } });
  await expect(exportMenu).not.toHaveAttribute("open");
  await expect(overflowMenu).not.toHaveAttribute("open");

  await openMoreMenu(page);
  await page.keyboard.press("Escape");
  await expect(overflowMenu).not.toHaveAttribute("open");
});
