/**
 * Open, edit, and save journey coverage.
 *
 * Independently runnable with: npx playwright test e2e/journeys/open-edit-save.spec.ts
 */
import { expect, test } from "@playwright/test";
import {
  readEditorText,
  expectEditorText,
  openMoreMenu,
  openSettingsMenu,
  clickToolbarAction,
  switchToRenderedMode,
  expectSearchHighlightCount,
} from "../helpers";

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

test("moves the active document tab with horizontal keyboard navigation", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "tab-one.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Tab one\n\n第一个标签页。"),
    },
    {
      name: "tab-two.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Tab two\n\n第二个标签页。"),
    },
  ]);

  const tabStrip = page.getByRole("toolbar", { name: "已打开文档" });
  const labels = tabStrip.locator(".tab-label");
  await expect(labels).toHaveCount(2);

  const activeIndex = await labels.evaluateAll((elements) =>
    elements.findIndex((element) => element.getAttribute("aria-pressed") === "true"),
  );
  expect(activeIndex).toBeGreaterThanOrEqual(0);
  const nextIndex = (activeIndex + 1) % 2;

  await labels.nth(activeIndex).focus();
  await expect(labels.nth(activeIndex)).toHaveAttribute("tabindex", "0");
  await expect(labels.nth(nextIndex)).toHaveAttribute("tabindex", "-1");

  await page.keyboard.press("ArrowRight");
  await expect(labels.nth(nextIndex)).toBeFocused();
  await expect(labels.nth(nextIndex)).toHaveAttribute("tabindex", "0");
  await expect(labels.nth(nextIndex)).toHaveAttribute("aria-pressed", "true");
  await expect(labels.nth(activeIndex)).toHaveAttribute("tabindex", "-1");

  await page.keyboard.press("ArrowLeft");
  await expect(labels.nth(activeIndex)).toBeFocused();
  await expect(labels.nth(activeIndex)).toHaveAttribute("aria-pressed", "true");
});

test("keeps the quick-open highlight visible and announced as it moves", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 520 });
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles(
    Array.from({ length: 20 }, (_, index) => ({
      name: `quick-open-${String(index + 1).padStart(2, "0")}.md`,
      mimeType: "text/markdown",
      buffer: Buffer.from(`# Quick open ${index + 1}`),
    })),
  );

  await page.keyboard.press("Control+P");
  const quickOpenDialog = page.getByRole("dialog", { name: "快速打开" });
  const quickOpenSearch = page.getByRole("searchbox", { name: "快速打开文档" });
  const quickOpenResults = quickOpenDialog.getByRole("listbox", { name: "快速打开结果" });

  await expect(quickOpenResults.getByRole("option")).toHaveCount(20);
  await expect(quickOpenSearch).toHaveAttribute("aria-controls", "quick-open-results");
  await expect(quickOpenSearch).toHaveAttribute("aria-activedescendant", "quick-open-option-0");

  await page.keyboard.press("ArrowDown");
  await expect(quickOpenSearch).toHaveAttribute("aria-activedescendant", "quick-open-option-1");
  await expect(quickOpenDialog.locator("#quick-open-option-1")).toHaveAttribute("aria-selected", "true");

  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press("ArrowDown");
  }

  const visibility = await quickOpenResults.evaluate((element) => {
    const active = element.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!active) return null;

    const containerRect = element.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const visibilityTolerance = 1;
    return {
      activeId: active.id,
      scrollTop: element.scrollTop,
      isVisible:
        activeRect.top >= containerRect.top - visibilityTolerance &&
        activeRect.bottom <= containerRect.bottom + visibilityTolerance,
    };
  });

  expect(visibility?.activeId).toBe(await quickOpenSearch.getAttribute("aria-activedescendant"));
  expect(visibility?.scrollTop).toBeGreaterThan(0);
  expect(visibility?.isVisible).toBe(true);
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

test("moves through the outline with one roving tab stop and follows the current heading", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "outline-keyboard.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      [
        "# Outline keyboard",
        "",
        "目录键盘导航测试。",
        "",
        ...Array.from({ length: 18 }, (_, index) => `开篇内容 ${index + 1}，用于验证当前章节高亮。`),
        "",
        "## 第一章",
        "",
        ...Array.from({ length: 18 }, (_, index) => `第一章内容 ${index + 1}。`),
        "",
        "### 第一节",
        "",
        ...Array.from({ length: 18 }, (_, index) => `第一节内容 ${index + 1}。`),
        "",
        "## 第二章",
        "",
        ...Array.from({ length: 18 }, (_, index) => `第二章内容 ${index + 1}。`),
        "",
        "## 第三章",
        "",
        ...Array.from({ length: 18 }, (_, index) => `第三章内容 ${index + 1}。`),
      ].join("\n"),
    ),
  });

  await switchToRenderedMode(page);
  const outline = page.getByRole("tree", { name: "文档目录" });
  const items = outline.getByRole("treeitem");
  await expect(items).toHaveCount(5);

  const currentIndex = await items.evaluateAll((elements) =>
    elements.findIndex((element) => element.querySelector('[aria-current="location"]')),
  );
  expect(currentIndex).toBe(0);
  await items.nth(currentIndex).focus();
  await expect(items.nth(currentIndex)).toHaveAttribute("tabindex", "0");

  await page.keyboard.press("ArrowDown");
  await expect(items.nth(1)).toBeFocused();
  await expect(items.nth(1)).toHaveAttribute("tabindex", "0");
  await expect(items.nth(0)).toHaveAttribute("tabindex", "-1");
  await expect.poll(() => items.nth(1).locator("a").getAttribute("aria-current"), { timeout: 5_000 }).toBe("location");

  await page.keyboard.press("End");
  await expect(items.last()).toBeFocused();
  await expect(items.last()).toHaveAttribute("tabindex", "0");

  await page.keyboard.press("Home");
  await expect(items.first()).toBeFocused();
  await expect(items.first()).toHaveAttribute("tabindex", "0");
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

test("closes only the innermost command panel before focus mode", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "nested-escape-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Nested Escape\n\n专注模式与命令面板的 Escape 互斥测试"),
  });
  await switchToRenderedMode(page);
  await expect(page.getByRole("heading", { name: "Nested Escape" })).toBeVisible();

  await page.getByRole("button", { name: "专注", exact: true }).click();
  await expect(page.locator(".app-shell")).toHaveClass(/focus-mode/);
  const focusExitButton = page.getByRole("button", { name: /退出专注/ });
  await expect(focusExitButton).toBeVisible();

  await page.keyboard.press("Control+Shift+P");
  const palette = page.getByRole("dialog", { name: "命令面板" });
  await expect(palette).toBeVisible();
  await expect(palette.getByRole("searchbox", { name: "搜索命令" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);
  await expect(page.locator(".app-shell")).toHaveClass(/focus-mode/);
  await expect(focusExitButton).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.locator(".app-shell")).not.toHaveClass(/focus-mode/);
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

