import { expect, test } from "@playwright/test";

test("renders the local reader landing page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Moyang Reader");
  await expect(page.getByRole("heading", { name: "把文档打开，专心阅读。" })).toBeVisible();
  await expect(page.getByRole("button", { name: "打开文档" })).toBeVisible();
  await expect(page.getByText("MARKDOWN", { exact: true })).toBeVisible();
});
