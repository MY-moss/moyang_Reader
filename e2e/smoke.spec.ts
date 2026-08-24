import { expect, test } from "@playwright/test";

test("renders the local reader landing page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Moyang Reader");
  await expect(page.getByRole("heading", { name: "把文档打开，专心阅读。" })).toBeVisible();
  await expect(page.getByRole("button", { name: "打开文档" })).toBeVisible();
  await expect(page.getByRole("button", { name: "添加整个文件夹" })).toBeVisible();
  await expect(page.getByRole("button", { name: "文件夹", exact: true })).toHaveAttribute(
    "title",
    /Ctrl\+Shift\+O/,
  );
  await expect(page.getByText("MARKDOWN", { exact: true })).toBeVisible();
});

test("keeps the folder shortcut available from the landing page", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("Control+Shift+O");
  await expect(page.getByRole("heading", { name: "把文档打开，专心阅读。" })).toBeVisible();
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
