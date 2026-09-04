/**
 * Workspace journey coverage.
 *
 * Independently runnable with: npx playwright test e2e/journeys/workspace.spec.ts
 */
import { expect, test } from "@playwright/test";
import { expectEditorText, clickToolbarAction, switchToRenderedMode } from "../helpers";

test("renders the local reader landing page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Moyang Reader");
  await expect(page.getByRole("heading", { name: "把文档打开，专心阅读。" })).toBeVisible();
  await expect(page.getByRole("button", { name: "打开文档" })).toBeVisible();
  await expect(page.getByRole("button", { name: "添加整个文件夹" })).toBeVisible();
  await expect(page.locator(".brand-logo")).toBeVisible();
  const emptyLogo = page.locator(".empty-logo");
  await expect(emptyLogo).toBeVisible();
  await expect(emptyLogo).toHaveAttribute("src", /moyang-reader-logo/);
  await expect
    .poll(() => emptyLogo.evaluate((element) => (element as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
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

