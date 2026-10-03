import { expect, test } from "@playwright/test";
import { clickToolbarAction } from "./helpers";

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

test("ignores a queued pre-open scroll but dismisses insertion after a real source viewport movement", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "queued-scroll.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(Array.from({ length: 100 }, (_, index) => `Paragraph ${index}.\n`).join("\n")),
  });
  await expect(page.locator(".wysiwyg-editor")).toHaveAttribute("aria-busy", "false");
  await clickToolbarAction(page, "源文本");
  await expect(page.locator(".code-mirror-editor")).toHaveAttribute("aria-busy", "false");
  await page.getByRole("toolbar", { name: "编辑工具栏" }).getByRole("button", { name: "插入" }).click();
  const dialog = page.getByRole("dialog", { name: "插入内容" });
  await expect(dialog).toBeVisible();
  const viewport = page.locator(".content-area");
  await viewport.dispatchEvent("scroll");
  await expect(dialog).toBeVisible();
  const movement = await viewport.evaluate((element) => {
    const before = element.scrollTop;
    const maximum = element.scrollHeight - element.clientHeight;
    element.scrollTop = before < maximum ? before + 1 : before - 1;
    return { before, after: element.scrollTop, maximum };
  });
  expect(movement.maximum).toBeGreaterThan(0);
  expect(movement.after).not.toBe(movement.before);
  await expect(dialog).toHaveCount(0);
});
