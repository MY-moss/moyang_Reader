import { expect, test } from "@playwright/test";

test("renders the local reader landing page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Moyang Reader");
  await expect(page.getByRole("heading", { name: "把文档打开，专心阅读。" })).toBeVisible();
  await expect(page.getByRole("button", { name: "打开文档" })).toBeVisible();
  await expect(page.getByText("MARKDOWN", { exact: true })).toBeVisible();
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
