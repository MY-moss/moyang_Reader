import { expect, type Page } from "@playwright/test";

// Wait for the default editor; read-only formats retain their own viewer.
export async function openForEditing(page: Page, upload: () => Promise<void>) {
  await upload();
  await expect(
    page
      .locator(".reader-content, .source-editor, .wysiwyg-editor, .error-state, .pdf-preview, .image-preview")
      .first(),
  ).toBeVisible();
  const edit = page.getByRole("button", { name: "直接进入编辑模式", exact: true });
  if (await edit.isVisible()) await edit.click();
}
