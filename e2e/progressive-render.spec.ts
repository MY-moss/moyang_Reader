import { expect, test, type Page } from "@playwright/test";

async function openMoreMenu(page: Page): Promise<void> {
  const menu = page.locator(".toolbar-overflow");
  if ((await menu.getAttribute("open")) === null) {
    await page.locator(".toolbar-overflow-trigger").click();
  }
}

async function switchToRenderedMode(page: Page, documentName: string): Promise<void> {
  await expect(page.locator(".tab-item.active .tab-label")).toHaveText(documentName);
  await openMoreMenu(page);
  const sourceButton = page.getByRole("button", { name: "源文本", exact: true });
  if ((await sourceButton.count()) > 0) {
    await sourceButton.click();
    await openMoreMenu(page);
  }
  const readingButton = page.getByRole("button", { name: "阅读", exact: true });
  if ((await readingButton.count()) > 0) await readingButton.click();
  const menu = page.locator(".toolbar-overflow");
  if ((await menu.getAttribute("open")) !== null) await page.locator(".toolbar-overflow-trigger").click();
}

test("loads KaTeX styles only when a formula is rendered", async ({ page }) => {
  // Formula rendering/imports can finish after the file picker event. Keep that
  // timing deterministic so the test cannot switch the previous document's mode.
  await page.addInitScript(() => {
    const readText = File.prototype.text;
    File.prototype.text = async function () {
      if (this.name === "formula-note.md") await new Promise((resolve) => setTimeout(resolve, 300));
      return readText.call(this);
    };
  });
  const stylesheetRequests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "stylesheet") stylesheetRequests.push(request.url());
  });

  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "plain-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# 普通文档\n\n这里没有公式。"),
  });
  await switchToRenderedMode(page, "plain-note.md");
  await expect(page.locator(".reader-content")).toContainText("这里没有公式。");
  expect(stylesheetRequests.some((url) => /katex/i.test(url))).toBe(false);

  await page.locator('input[type="file"]').setInputFiles({
    name: "formula-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# 公式文档\n\n$$x^2 + y^2 = z^2$$"),
  });
  await switchToRenderedMode(page, "formula-note.md");
  await expect(page.locator(".reader-content .katex")).toBeVisible();
  await expect.poll(() => stylesheetRequests.some((url) => /katex/i.test(url))).toBe(true);
});

test("mounts large reader content incrementally and eventually exposes every heading", async ({ page }) => {
  await page.addInitScript(() => {
    const scheduledFrames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      const frame = ++nextFrame;
      scheduledFrames.set(frame, callback);
      return frame;
    };
    window.cancelAnimationFrame = (frame) => {
      scheduledFrames.delete(frame);
    };
    (window as unknown as { __moyangReaderFrames: { advance: () => void } }).__moyangReaderFrames = {
      advance: () => {
        // Callbacks scheduled by this batch belong to the next frame. Keep
        // cancellation semantics when an earlier callback cancels a later one.
        const frames = Array.from(scheduledFrames.keys());
        for (const frame of frames) {
          const callback = scheduledFrames.get(frame);
          scheduledFrames.delete(frame);
          callback?.(performance.now());
        }
      },
    };
  });
  await page.goto("/");
  // Keep the source below the large-document source-mode cutoff so this test
  // exercises progressive reading instead of the protected source-only path.
  const paragraph = "Progressive rendering performance test. ".repeat(50);
  const sections = Array.from({ length: 120 }, (_, index) => `## 第 ${index + 1} 节\n\n${paragraph}\n\n`).join("");
  await page.locator('input[type="file"]').setInputFiles({
    name: "large-progressive-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(`# 大文档\n\n${sections}`),
  });
  await switchToRenderedMode(page, "large-progressive-note.md");

  const reader = page.locator('[data-progressive-reader="true"]');
  await expect(reader).toHaveAttribute("data-progressive-reader-ready", "false");
  const snapshot = () =>
    reader.evaluate((element) => ({
      ready: element.getAttribute("data-progressive-reader-ready"),
      mounted: Number(element.getAttribute("data-progressive-reader-mounted")),
      total: Number(element.getAttribute("data-progressive-reader-total")),
      chunks: element.querySelectorAll(".progressive-reader-chunk").length,
      headings: element.querySelectorAll("h2").length,
    }));

  // Timed rAF delays cannot protect separate ready/mounted/total reads from
  // observing different renders. Hold frames and inspect one DOM snapshot.
  const initial = await snapshot();
  expect(initial.ready).toBe("false");
  expect(initial.mounted).toBe(1);
  expect(initial.mounted).toBeLessThan(initial.total);
  expect(initial.total).toBeGreaterThan(5);
  expect(initial.chunks).toBe(initial.mounted);
  expect(initial.headings).toBeGreaterThan(0);
  expect(initial.headings).toBeLessThan(120);

  let previousHeadings = initial.headings;
  for (let mounted = 2; mounted <= initial.total; mounted += 1) {
    await page.evaluate(() => {
      (window as unknown as { __moyangReaderFrames: { advance: () => void } }).__moyangReaderFrames.advance();
    });
    await expect(reader).toHaveAttribute("data-progressive-reader-mounted", String(mounted));
    const current = await snapshot();
    expect(current.mounted).toBe(mounted);
    expect(current.chunks).toBe(mounted);
    expect(current.total).toBe(initial.total);
    expect(current.ready).toBe(mounted === initial.total ? "true" : "false");
    expect(current.headings).toBeGreaterThan(previousHeadings);
    previousHeadings = current.headings;
  }

  await expect(reader).toHaveAttribute("data-progressive-reader-ready", "true", { timeout: 8_000 });
  await expect(page.locator(".reader-content h2")).toHaveCount(120);
});
