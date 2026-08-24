import { expect, test } from "@playwright/test";

test("renders the local reader landing page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Moyang Reader");
  await expect(page.getByRole("heading", { name: "把文档打开，专心阅读。" })).toBeVisible();
  await expect(page.getByRole("button", { name: "打开文档" })).toBeVisible();
  await expect(page.getByRole("button", { name: "添加整个文件夹" })).toBeVisible();
  await expect(page.getByRole("button", { name: "文件夹", exact: true })).toHaveAttribute("title", /Ctrl\+Shift\+O/);
  await expect(page.getByText("MARKDOWN", { exact: true })).toBeVisible();
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

test("opens the quick-open palette from the keyboard", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "quick-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Quick note\n\n快速打开测试"),
  });
  await expect(page.getByRole("heading", { name: "Quick note" })).toBeVisible();

  await page.keyboard.press("Control+P");
  await expect(page.getByRole("dialog", { name: "快速打开" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "快速打开文档" })).toBeFocused();

  await page.getByRole("searchbox", { name: "快速打开文档" }).fill("quick-note");
  await expect(page.getByRole("option", { name: /quick-note\.md/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "快速打开" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Quick note" })).toBeVisible();
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

  await expect(page.getByRole("heading", { name: "Second note" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "first-note.md" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "second-note.md" })).toBeVisible();
});

test("enters and exits focus reading mode", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "focus-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Focus note\n\n专注阅读测试"),
  });
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

test("persists reading layout preferences", async ({ page }) => {
  await page.goto("/");

  await page.locator("summary", { hasText: "设置" }).click();
  await page.getByLabel("正文字号").selectOption("large");
  await page.getByLabel("正文宽度").selectOption("narrow");
  await page.getByLabel("导出纸张").selectOption("letter");
  await page.getByLabel("导出方向").selectOption("landscape");
  await page.getByLabel("导出页边距").selectOption("compact");
  await page.reload();
  await page.locator("summary", { hasText: "设置" }).click();

  await expect(page.getByLabel("正文字号")).toHaveValue("large");
  await expect(page.getByLabel("正文宽度")).toHaveValue("narrow");
  await expect(page.getByLabel("导出纸张")).toHaveValue("letter");
  await expect(page.getByLabel("导出方向")).toHaveValue("landscape");
  await expect(page.getByLabel("导出页边距")).toHaveValue("compact");
});

test("keeps remote images off until the local privacy setting is enabled", async ({ page }) => {
  await page.goto("/");

  await page.locator("summary", { hasText: "设置" }).click();
  await expect(page.getByRole("checkbox", { name: "允许远程图片" })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "启动时检查更新" })).not.toBeChecked();

  await page.locator('input[type="file"]').setInputFiles({
    name: "privacy.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("![tracking](https://example.com/pixel.png)"),
  });

  const image = page.locator(".reader-content img");
  await expect(image).toHaveCount(1);
  await expect(image).not.toHaveAttribute("src", /https:\/\//);

  await page.getByRole("checkbox", { name: "允许远程图片" }).check();
  await expect(image).toHaveAttribute("src", "https://example.com/pixel.png");

  await page.reload();
  await page.locator("summary", { hasText: "设置" }).click();
  await expect(page.getByRole("checkbox", { name: "允许远程图片" })).toBeChecked();
});

test("opens external links outside the reader window", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "external-link.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("[打开外部链接](https://example.com/reference)"),
  });

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name: "打开外部链接" }).click();
  const popup = await popupPromise;

  await expect(popup).toHaveURL("https://example.com/reference");
  await expect(page).toHaveTitle("Moyang Reader");
});
