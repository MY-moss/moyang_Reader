import { expect, test, type Page } from "@playwright/test";

async function openMoreMenu(page: Page): Promise<void> {
  const menu = page.locator(".toolbar-overflow");
  if ((await menu.getAttribute("open")) === null) {
    await page.locator(".toolbar-overflow-trigger").click();
  }
}

async function clickToolbarAction(page: Page, name: string): Promise<void> {
  await openMoreMenu(page);
  await page.getByRole("button", { name, exact: true }).click();
}

async function switchToRenderedMode(page: Page): Promise<void> {
  await clickToolbarAction(page, "源文本");
  await clickToolbarAction(page, "阅读");
  const menu = page.locator(".toolbar-overflow");
  if ((await menu.getAttribute("open")) !== null) await page.locator(".toolbar-overflow-trigger").click();
}

async function readContentScrollBehaviors(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const calls = (window as Window & { __moyangScrollCalls?: Array<{ behavior?: string }> }).__moyangScrollCalls ?? [];
    return calls.map((call) => call.behavior ?? "auto");
  });
}

test("uses instant programmatic scrolling when reduced motion is enabled", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const target = window as Window & { __moyangScrollCalls?: Array<{ behavior?: string }> };
    target.__moyangScrollCalls = [];
    const nativeScrollTo = HTMLElement.prototype.scrollTo;
    HTMLElement.prototype.scrollTo = function (...args: [ScrollToOptions | number, number?]) {
      const [options] = args;
      if (this.classList.contains("content-area") && typeof options !== "number") {
        target.__moyangScrollCalls?.push(options);
      }
      return Reflect.apply(nativeScrollTo, this, args);
    };
  });
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "reduced-motion-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      [
        "# Reduced motion",
        "",
        ...Array.from({ length: 14 }, (_, index) => `首段内容 ${index + 1}。`),
        "",
        "## 第二章",
        "",
        ...Array.from({ length: 14 }, (_, index) => `第二章内容 ${index + 1}。`),
        "",
        "## 第三章",
        "",
        ...Array.from({ length: 14 }, (_, index) => `第三章内容 ${index + 1}。`),
      ].join("\n"),
    ),
  });
  await switchToRenderedMode(page);
  await expect(page.getByRole("heading", { name: "第三章" })).toBeVisible();

  const rail = page.getByRole("complementary", { name: "阅读进度" });
  await rail.getByRole("button", { name: "末尾" }).click();
  await expect.poll(() => readContentScrollBehaviors(page)).toContain("smooth");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await rail.getByRole("button", { name: "顶部" }).click();
  await expect.poll(() => readContentScrollBehaviors(page)).toContain("auto");

  await page.getByRole("link", { name: "第三章" }).click();
  await expect
    .poll(async () => {
      const behaviors = await readContentScrollBehaviors(page);
      return behaviors.at(-1);
    })
    .toBe("auto");
});
