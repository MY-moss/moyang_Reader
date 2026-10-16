import { expect, test, type Page } from "@playwright/test";

async function openPair(page: Page) {
  await page.goto("/");
  const upload = page.locator('input[type="file"]').first();
  for (const name of ["first.md", "second.md"]) {
    await upload.setInputFiles({
      name,
      mimeType: "text/markdown",
      buffer: Buffer.from(`# ${name}\n\nOriginal ${name}`),
    });
    await expect(page.locator('.wysiwyg-editor[aria-busy="false"]')).toBeVisible();
  }
  await page.getByRole("button", { name: "first.md", exact: true }).click();
  await expect(page.locator('.wysiwyg-editor[aria-busy="false"]')).toBeVisible();
}

async function typeAndActImmediately(page: Page, action: string) {
  // Keep insertion and navigation in the same browser task, before Milkdown's
  // debounced change event can publish the final text to the document session.
  await page.evaluate(async (selector) => {
    const editor = document.querySelector<HTMLElement>('.wysiwyg-editor [contenteditable="true"]')!;
    editor.focus();
    const selection = window.getSelection()!;
    selection.selectAllChildren(editor);
    selection.collapseToEnd();
    document.execCommand("insertText", false, " LAST-EDIT");
    await Promise.resolve();
    document.querySelector<HTMLElement>(selector)!.click();
  }, action);
}

test("routes pending WYSIWYG edits to their original tab when switching immediately", async ({ page }) => {
  await openPair(page);
  await typeAndActImmediately(page, '.tab-label[title$="second.md"]');
  const editor = page.getByRole("textbox", { name: "Markdown 所见即所得编辑器" });
  await expect(editor).toContainText("Original second.md");
  await expect(editor).not.toContainText("LAST-EDIT");
  await page.getByRole("button", { name: "first.md", exact: true }).click();
  await expect(editor).toContainText("Original first.md LAST-EDIT");
});

test("keeps each document intact when an immediate edit activates the other pane", async ({ page }) => {
  await openPair(page);
  await page.getByRole("button", { name: "双窗格", exact: true }).click();
  await page.getByRole("button", { name: "在此窗格工作", exact: true }).click();
  await expect(page.locator('.wysiwyg-editor[aria-busy="false"]')).toBeVisible();
  await page
    .getByRole("region", { name: "右侧文档窗格" })
    .getByRole("button", { name: "first.md", exact: true })
    .click();
  // Select the second document in the left pane, then return to the right.
  await page
    .getByRole("region", { name: "左侧文档窗格" })
    .getByRole("button", { name: "second.md", exact: true })
    .click();
  await expect(page.locator('.wysiwyg-editor[aria-busy="false"]')).toBeVisible();
  await page.getByRole("button", { name: "在此窗格工作", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Markdown 所见即所得编辑器" })).toContainText("Original first.md");
  await typeAndActImmediately(page, ".reader-pane:not(.is-active) .inactive-pane-tools button");
  const editor = page.getByRole("textbox", { name: "Markdown 所见即所得编辑器" });
  await expect(editor).toContainText("Original second.md");
  await expect(editor).not.toContainText("LAST-EDIT");
  await expect(page.getByRole("region", { name: "右侧文档窗格" }).locator(".reader-content")).toContainText(
    "LAST-EDIT",
  );
  await page.getByRole("button", { name: "在此窗格工作", exact: true }).click();
  await expect(editor).toContainText("Original first.md LAST-EDIT");
});

test("Ctrl+S includes the edit made before Milkdown publishes its change", async ({ page }) => {
  await openPair(page);
  const download = page.waitForEvent("download");
  await page.evaluate(async () => {
    const editor = document.querySelector<HTMLElement>('.wysiwyg-editor [contenteditable="true"]')!;
    editor.focus();
    const selection = window.getSelection()!;
    selection.selectAllChildren(editor);
    selection.collapseToEnd();
    document.execCommand("insertText", false, " SAVED-TAIL");
    await Promise.resolve();
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));
  });
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toContain("Original first.md SAVED-TAIL");
});

test("closing immediately after typing still prompts for the unsaved browser draft", async ({ page }) => {
  await openPair(page);
  let message = "";
  page.once("dialog", async (confirmation) => {
    message = confirmation.message();
    await confirmation.dismiss();
  });
  await typeAndActImmediately(page, '.tab-close[aria-label="关闭 first.md"]');
  await expect.poll(() => message).toContain("修改尚未下载");
  await expect(page.getByRole("textbox", { name: "Markdown 所见即所得编辑器" })).toContainText("LAST-EDIT");
});
