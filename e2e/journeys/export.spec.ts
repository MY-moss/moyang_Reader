/**
 * Export journey coverage.
 *
 * Independently runnable with: npx playwright test e2e/journeys/export.spec.ts
 */
import { expect, test } from "@playwright/test";
import { openMoreMenu, switchToRenderedMode } from "../helpers";

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

