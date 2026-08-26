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

test("renders the local reader landing page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Moyang Reader");
  await expect(page.getByRole("heading", { name: "把文档打开，专心阅读。" })).toBeVisible();
  await expect(page.getByRole("button", { name: "打开文档" })).toBeVisible();
  await expect(page.getByRole("button", { name: "添加整个文件夹" })).toBeVisible();
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
      JSON.stringify([{ path: "C:/Notes/Library/today.md", name: "today.md" }]),
    );
  });
  await page.goto("/");

  await expect(page.locator('button[title="C:/Notes/Library"]')).toBeVisible();
  await expect(page.getByRole("button", { name: /today\.md/ })).toBeVisible();
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
      ]),
    );
  });
  await page.goto("/");

  await page.getByRole("button", { name: "草稿 1" }).click();
  const draftTrigger = page.getByRole("button", { name: "草稿 1" });
  await expect(page.getByRole("dialog", { name: "未保存草稿" })).toBeVisible();
  await expect(page.getByRole("button", { name: "关闭草稿恢复中心" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "未保存草稿" })).toHaveCount(0);
  await expect(draftTrigger).toBeFocused();

  await draftTrigger.click();
  await expect(page.getByRole("button", { name: "打开 recovery-note.md 草稿" })).toBeVisible();

  await page.getByRole("button", { name: "丢弃 recovery-note.md 草稿" }).click();
  const discardDialog = page.getByRole("dialog", { name: "丢弃草稿？" });
  await expect(discardDialog).toBeVisible();
  await expect(page.getByTestId("draft-discard-cancel")).toBeFocused();
  await page.getByTestId("draft-discard-cancel").click();
  await expect(discardDialog).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "未保存草稿" })).toBeVisible();

  await page.getByRole("button", { name: "丢弃 recovery-note.md 草稿" }).click();
  await page.getByTestId("draft-discard-confirm").click();
  await expect(page.getByRole("button", { name: "草稿 1" })).toHaveCount(0);
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

  const quickOpenTrigger = page.locator('button[title="快速打开文档 (Ctrl+P)"]');
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
  await expect(page.getByRole("tab")).toHaveCount(3);
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

  await page.keyboard.press("Escape");
  await expect(overlay).toHaveCount(0);
  await page.keyboard.press("Backspace");

  await page.keyboard.type("/h1");
  await expect(overlay.getByRole("option", { name: /标题 1/ })).toBeVisible();
  await page.keyboard.press("Enter");
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
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("链接地址");
    await dialog.accept("https://example.com");
  });
  await editor.press("Control+k");

  await expectEditorText(editor, "[链接文字](https://example.com)");
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

  await expect(page.locator("mark.moyang-search-hit")).toHaveCount(3);
  await expect(page.locator(".find-count")).toHaveText("1 / 3");

  await page.getByRole("button", { name: "下一个结果" }).click();
  await expect(page.locator(".find-count")).toHaveText("2 / 3");
  await expect(page.locator("mark.moyang-search-hit").nth(1)).toHaveClass(/active/);

  await page.getByRole("button", { name: "上一个结果" }).click();
  await expect(page.locator(".find-count")).toHaveText("1 / 3");
  await expect(page.locator("mark.moyang-search-hit").nth(0)).toHaveClass(/active/);
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
  await expect(page.locator("mark.moyang-search-hit").nth(0)).toHaveCSS("background-color", "rgb(187, 112, 64)");
  await expect(page.locator("mark.moyang-search-hit").nth(1)).toHaveCSS("background-color", "rgb(146, 114, 43)");
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
  await page.getByLabel("正文字号").selectOption("large");
  await page.getByLabel("正文宽度").selectOption("narrow");
  await page.getByLabel("导出纸张").selectOption("letter");
  await page.getByLabel("导出方向").selectOption("landscape");
  await page.getByLabel("导出页边距").selectOption("compact");
  await page.reload();
  await openSettingsMenu(page);

  await expect(page.getByLabel("正文字号")).toHaveValue("large");
  await expect(page.getByLabel("正文宽度")).toHaveValue("narrow");
  await expect(page.getByLabel("导出纸张")).toHaveValue("letter");
  await expect(page.getByLabel("导出方向")).toHaveValue("landscape");
  await expect(page.getByLabel("导出页边距")).toHaveValue("compact");
});

test("switches and remembers the core interface locale", async ({ page }) => {
  await page.goto("/");

  await openSettingsMenu(page);
  await page.getByLabel("界面语言").selectOption("en-US");

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("button", { name: "Folder", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Sidebar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Folder", exact: true })).toBeVisible();
  await expect(page.getByText("LOCAL FIRST")).toBeVisible();

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
