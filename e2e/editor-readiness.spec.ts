import { expect, test } from "@playwright/test";

for (const replaceDocument of [false, true]) {
  test(`scopes an insertion requested during editor loading to ${replaceDocument ? "the original document only" : "the same document"}`, async ({
    page,
  }) => {
    let release!: () => void;
    let intercepted!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const blocked = new Promise<void>((resolve) => {
      intercepted = resolve;
    });
    await page.route("**/MarkdownWysiwygEditor-*.js", async (route) => {
      intercepted();
      await gate;
      await route.continue();
    });
    try {
      await page.goto("/");
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: "pending-insert.md",
        mimeType: "text/markdown",
        buffer: Buffer.from("# Original draft"),
      });
      await blocked;
      await expect(page.locator(".document-title")).toHaveText("pending-insert.md");
      await expect(page.locator(".wysiwyg-loading-state")).toBeVisible();
      await page.keyboard.press("Control+k");
      if (replaceDocument) {
        await fileInput.setInputFiles({
          name: "other-draft.md",
          mimeType: "text/markdown",
          buffer: Buffer.from("# Other draft"),
        });
        await expect(page.locator(".document-title")).toHaveText("other-draft.md");
      }
      release();
      await expect(page.locator(".wysiwyg-editor")).toHaveAttribute("aria-busy", "false");
      const dialog = page.getByRole("dialog", { name: "插入内容" });
      if (replaceDocument) {
        await expect(dialog).toHaveCount(0);
        await page.getByRole("toolbar", { name: "编辑工具栏" }).getByRole("button", { name: "插入" }).click();
      }
      await expect(dialog).toBeVisible();
      await dialog.press("Escape");
      await expect(dialog).toHaveCount(0);
      if (replaceDocument) {
        await fileInput.setInputFiles({
          name: "pending-insert.md",
          mimeType: "text/markdown",
          buffer: Buffer.from("# Original draft"),
        });
        await expect(page.locator(".document-title")).toHaveText("pending-insert.md");
        await expect(page.locator(".wysiwyg-editor")).toHaveAttribute("aria-busy", "false");
        await expect(dialog).toHaveCount(0);
      }
    } finally {
      release();
    }
  });
}
