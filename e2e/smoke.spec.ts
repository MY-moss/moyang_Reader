/**
 * Shell, settings, responsive layout, and top-bar journey coverage.
 *
 * Reader-specific journeys live in e2e/journeys/*.spec.ts so each user journey
 * can be run and diagnosed independently.
 */
import { expect, test } from "@playwright/test";
import { clickToolbarAction, openMoreMenu, openSettingsMenu, switchToRenderedMode } from "./helpers";

test("persists reading layout preferences", async ({ page }) => {
  await page.goto("/");

  await openSettingsMenu(page);
  const readingZoom = page.getByLabel("阅读缩放");
  await readingZoom.focus();
  await readingZoom.press("ArrowRight");
  await readingZoom.press("ArrowRight");
  await readingZoom.press("ArrowRight");
  await page.getByLabel("正文宽度", { exact: true }).selectOption("narrow");
  await page.getByLabel("导出纸张").selectOption("letter");
  await page.getByLabel("导出方向").selectOption("landscape");
  await page.getByLabel("导出页边距").selectOption("compact");
  await page.reload();
  await openSettingsMenu(page);

  await expect(page.getByLabel("阅读缩放")).toHaveValue("115");
  await expect(page.getByLabel("正文宽度", { exact: true })).toHaveValue("narrow");
  await expect(page.getByLabel("导出纸张")).toHaveValue("letter");
  await expect(page.getByLabel("导出方向")).toHaveValue("landscape");
  await expect(page.getByLabel("导出页边距")).toHaveValue("compact");
});

test("exports a local diagnostic summary without document content or paths", async ({ page }) => {
  await page.goto("/");
  await openSettingsMenu(page);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出诊断摘要", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("moyang-reader-diagnostics.json");

  const stream = await download.createReadStream();
  if (!stream) throw new Error("诊断摘要下载没有可读内容。");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const report = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
    app: { version: string; runtime: string };
    errors: unknown[];
    privacy: {
      documentContentIncluded: boolean;
      fullPathsIncluded: boolean;
      secretsIncluded: boolean;
      telemetrySent: boolean;
    };
  };

  expect(report.app.version).toBe("0.11.0");
  expect(report.app.runtime).toBe("browser-preview");
  expect(report.errors).toEqual([]);
  expect(report.privacy).toEqual({
    documentContentIncluded: false,
    fullPathsIncluded: false,
    secretsIncluded: false,
    telemetrySent: false,
  });
});

test("stacks setting feedback without shifting the reading layout", async ({ page }) => {
  await page.goto("/");
  await openSettingsMenu(page);

  const contentArea = page.locator(".content-area");
  const before = await contentArea.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, height: rect.height, scrollTop: element.scrollTop };
  });

  await page.getByLabel("正文宽度", { exact: true }).selectOption("narrow");
  await page.getByLabel("导出纸张").selectOption("letter");
  await page.getByLabel("导出方向").selectOption("landscape");
  await page.getByLabel("导出页边距").selectOption("compact");

  const messages = page.locator(".notification-viewport .app-notification");
  await expect(messages).toHaveCount(3);
  await expect(messages.nth(0)).toContainText("正文宽度已更新");
  await expect(messages.nth(1)).toContainText("导出纸张已更新");
  await expect(messages.nth(2)).toContainText("导出方向已更新");
  await expect(messages.nth(0)).toHaveAttribute("role", "status");

  const after = await contentArea.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, height: rect.height, scrollTop: element.scrollTop };
  });
  expect(after).toEqual(before);
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(viewport.bodyScrollWidth).toBeLessThanOrEqual(viewport.clientWidth);

  await messages
    .nth(0)
    .getByRole("button", { name: /关闭通知/ })
    .click();
  await expect(messages).toHaveCount(3);
  await expect(messages.nth(2)).toContainText("导出页边距已更新");
});

test("dismisses setting feedback with the keyboard in a narrow window", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await openSettingsMenu(page);

  const contentArea = page.locator(".content-area");
  const before = await contentArea.evaluate((element) => element.getBoundingClientRect().top);
  await page.getByLabel("正文宽度", { exact: true }).selectOption("wide");

  const dismissButton = page.locator(".app-notification-dismiss").first();
  await dismissButton.focus();
  await expect(dismissButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".app-notification")).toHaveCount(0);

  const after = await contentArea.evaluate((element) => element.getBoundingClientRect().top);
  expect(after).toBe(before);
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(viewport.bodyScrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
});

test("switches and remembers the core interface locale", async ({ page }) => {
  await page.goto("/");

  await openSettingsMenu(page);
  await page.getByLabel("界面语言").selectOption("en-US");

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("button", { name: "Folder", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Sidebar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Folder", exact: true })).toBeVisible();
  await expect(page.locator(".settings-menu")).not.toHaveAttribute("open");
  await expect(page.getByText("LOCAL FIRST")).not.toBeVisible();

  await page.reload();
  await openSettingsMenu(page, "Settings");
  await expect(page.getByLabel("Interface language")).toHaveValue("en-US");

  await page.locator('input[type="file"]').setInputFiles({
    name: "english-shell.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# English shell\n\nLocalized navigation and document status."),
  });
  await expect(page.getByRole("toolbar", { name: "Open documents" })).toBeVisible();
  await expect(page.getByRole("contentinfo", { name: "Document status" })).toContainText("characters");

  const visualToolbar = page.getByRole("toolbar", { name: "Editor toolbar" });
  await expect(visualToolbar.getByRole("button", { name: "Bold" })).toBeVisible();
  await visualToolbar.getByRole("button", { name: "Insert" }).click();
  const visualInsert = page.getByRole("dialog", { name: "Insert content" });
  await expect(visualInsert.getByRole("tablist", { name: "Insert type" })).toBeVisible();
  await visualInsert.press("Escape");
  await expect(visualInsert).toHaveCount(0);

  await clickToolbarAction(page, "Source");
  const sourceToolbar = page.getByRole("toolbar", { name: "Editor toolbar" });
  await expect(sourceToolbar.getByRole("button", { name: "Clear formatting" })).toBeVisible();
  const source = page.getByRole("textbox", { name: "Markdown source" });
  await source.click({ button: "right" });
  const editorMenu = page.getByRole("menu", { name: "Document editing menu" });
  await expect(editorMenu.getByRole("menuitem", { name: "Paste as plain text" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(source).toBeFocused();
});

test("keeps editor tools usable in compact, standard, and wide desktop windows", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 720, height: 600 });
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "editor-tools-layout.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Editor tools\n\nText for formatting."),
  });
  await expect(page.getByRole("toolbar", { name: "编辑工具栏" })).toBeVisible();

  for (const mode of ["visual", "source"] as const) {
    if (mode === "source") await clickToolbarAction(page, "源文本");
    for (const width of [720, 900, 1240]) {
      await page.setViewportSize({ width, height: 600 });
      const closeContext = page.locator(".context-sidebar .panel-close-button");
      if (await closeContext.isVisible()) await closeContext.click();
      for (const media of [
        { colorScheme: "light", forcedColors: "none" },
        { colorScheme: "dark", forcedColors: "none" },
        { colorScheme: "light", forcedColors: "active" },
      ] as const) {
        await page.emulateMedia(media);
        const toolbar = page.getByRole("toolbar", { name: "编辑工具栏" });
        const insert = toolbar.getByRole("button", { name: "插入" });
        const clear = toolbar.getByRole("button", { name: "清除格式" });
        await expect(insert).toBeVisible();
        await expect(clear).toBeVisible();
        const metrics = await page.evaluate(() => {
          const toolbar = document.querySelector<HTMLElement>(".editor-format-toolbar")!;
          const insert = toolbar.querySelector<HTMLElement>(".editor-toolbar-insert-button")!;
          const rect = toolbar.getBoundingClientRect();
          const insertRect = insert.getBoundingClientRect();
          return {
            bodyWidth: document.body.scrollWidth,
            viewportWidth: document.documentElement.clientWidth,
            toolbarLeft: rect.left,
            toolbarRight: rect.right,
            insertLeft: insertRect.left,
            insertRight: insertRect.right,
            insertHeight: insertRect.height,
          };
        });
        expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewportWidth);
        expect(metrics.toolbarLeft).toBeGreaterThanOrEqual(0);
        expect(metrics.toolbarRight).toBeLessThanOrEqual(metrics.viewportWidth + 1);
        expect(metrics.insertLeft).toBeGreaterThanOrEqual(metrics.toolbarLeft);
        expect(metrics.insertRight).toBeLessThanOrEqual(metrics.toolbarRight);
        expect(metrics.insertHeight).toBeGreaterThanOrEqual(32);
        await insert.click();
        const dialog = page.getByRole("dialog", { name: "插入内容" });
        await expect(dialog).toBeVisible();
        const dialogBox = await dialog.boundingBox();
        expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
        expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(width + 1);
        await dialog.press("Escape");
      }
    }
  }
});

test("keeps remote images off until the local privacy setting is enabled", async ({ page }) => {
  await page.goto("/");

  await openSettingsMenu(page);
  await expect(page.getByRole("checkbox", { name: "允许远程图片" })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "启动时检查更新" })).not.toBeChecked();

  await page.locator('input[type="file"]').setInputFiles({
    name: "privacy.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("![tracking](https://example.com/pixel.png)"),
  });
  await switchToRenderedMode(page);
  await openSettingsMenu(page);

  const image = page.locator(".reader-content img");
  await expect(image).toHaveCount(1);
  await expect(image).not.toHaveAttribute("src", /https:\/\//);

  await page.getByRole("checkbox", { name: "允许远程图片" }).check();
  await expect(image).toHaveAttribute("src", "https://example.com/pixel.png");

  await page.reload();
  await openSettingsMenu(page);
  await expect(page.getByRole("checkbox", { name: "允许远程图片" })).toBeChecked();
});

test("opens external links outside the reader window", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "external-link.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("[打开外部链接](https://example.com/reference)"),
  });
  await switchToRenderedMode(page);

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name: "打开外部链接" }).click();
  const popup = await popupPromise;

  await expect(popup).toHaveURL("https://example.com/reference");
  await expect(page).toHaveTitle("Moyang Reader");
});

test("keeps the reader inside a narrow viewport when long inline content wraps", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const extensions = Array.from({ length: 24 }, (_, index) => `\`.format-${index}\``).join("、");
  await page.locator('input[type="file"]').setInputFiles({
    name: "mobile-layout.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(`# Mobile layout\n\n运行安装程序后会注册 ${extensions}，并继续保持本地阅读。`),
  });
  await switchToRenderedMode(page);

  await expect(page.getByRole("heading", { name: "Mobile layout" })).toBeVisible();
  const metrics = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    contentScrollWidth: document.querySelector(".content-area")?.scrollWidth ?? 0,
    contentClientWidth: document.querySelector(".content-area")?.clientWidth ?? 0,
    articleScrollWidth: document.querySelector(".reader-content")?.scrollWidth ?? 0,
    articleClientWidth: document.querySelector(".reader-content")?.clientWidth ?? 0,
  }));

  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.contentScrollWidth).toBe(metrics.contentClientWidth);
  expect(metrics.articleScrollWidth).toBe(metrics.articleClientWidth);
});

test("keeps compact toolbar actions discoverable without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "compact-toolbar.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Compact toolbar\n\nKeep the reader usable in a compact window."),
  });
  await expect(page.getByRole("heading", { name: "Compact toolbar" })).toBeVisible();
  await page.locator('button[title="隐藏侧栏 (Ctrl+Shift+B)"]').click();

  const toolbar = page.locator(".toolbar");
  await expect(toolbar.locator(".toolbar-overflow-trigger")).toBeVisible();
  const metrics = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    toolbarClientWidth: document.querySelector(".toolbar")?.clientWidth ?? 0,
    toolbarScrollWidth: document.querySelector(".toolbar")?.scrollWidth ?? 0,
  }));
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.toolbarScrollWidth).toBe(metrics.toolbarClientWidth);

  await openMoreMenu(page);
  await expect(
    page.locator(".toolbar-overflow-panel").getByRole("button", { name: "快速打开", exact: true }),
  ).toBeVisible();
});

test("keeps update access in More without interrupting the current document", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "update-workflow.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Update workflow\n\nKeep reading while an update is checked."),
  });
  await expect(page.getByRole("heading", { name: "Update workflow" })).toBeVisible();

  await openMoreMenu(page);
  const updateButton = page.locator(".toolbar-overflow-panel").getByRole("button", { name: "更新", exact: true });
  await expect(updateButton).toBeVisible();
  await updateButton.click();

  await expect(page.locator(".toolbar-overflow")).not.toHaveAttribute("open");
  await expect(page.getByRole("alert")).toContainText("浏览器预览模式不支持应用更新。");
  await expect(page.getByRole("heading", { name: "Update workflow" })).toBeVisible();

  await openMoreMenu(page);
  await expect(
    page.locator(".toolbar-overflow-panel").getByRole("button", { name: "更新", exact: true }),
  ).toBeVisible();
});

test("keeps toolbar icons consistent and readable at 900px", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 820 });
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "toolbar-icons.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Toolbar icons\n\nKeep high-frequency actions easy to scan."),
  });
  await expect(page.getByRole("heading", { name: "Toolbar icons" })).toBeVisible();

  const visibleIconNames = await page
    .locator(".topbar .toolbar .moyang-icon:visible")
    .evaluateAll((icons) => icons.map((icon) => icon.getAttribute("data-icon")));
  expect(visibleIconNames).toEqual([
    "folder-open",
    "save",
    "panel-left",
    "panel-right",
    "book-open",
    "search",
    "more-horizontal",
  ]);

  const metrics = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    toolbarScrollWidth: document.querySelector(".toolbar")?.scrollWidth ?? 0,
    toolbarClientWidth: document.querySelector(".toolbar")?.clientWidth ?? 0,
  }));
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.toolbarScrollWidth).toBe(metrics.toolbarClientWidth);

  await openMoreMenu(page);
  for (const iconName of ["settings", "printer", "download"] as const) {
    await expect(page.locator(`.topbar .moyang-icon[data-icon="${iconName}"]`)).toBeVisible();
  }

  const renderState = await page.locator(".topbar .moyang-icon").evaluateAll((icons) =>
    icons.map((icon) => ({
      color: getComputedStyle(icon).color,
      stroke: icon.getAttribute("stroke"),
    })),
  );
  expect(renderState.every(({ color, stroke }) => color !== "rgba(0, 0, 0, 0)" && stroke === "currentColor")).toBe(
    true,
  );

  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await expect(page.locator(".topbar .moyang-icon").first()).toBeVisible();
  await page.emulateMedia({ forcedColors: "active" });
  await expect.poll(() => page.evaluate(() => window.matchMedia("(forced-colors: active)").matches)).toBe(true);
  const highContrastState = await page
    .locator(".topbar .moyang-icon")
    .evaluateAll((icons) => icons.map((icon) => icon.getAttribute("stroke")));
  expect(highContrastState.every((stroke) => stroke === "currentColor")).toBe(true);
  expect((await page.locator(".topbar").screenshot()).byteLength).toBeGreaterThan(0);
});

test("keeps core actions visible and secondary actions in More at Windows widths", async ({ page }) => {
  for (const width of [720, 960, 1180]) {
    await page.setViewportSize({ width, height: 820 });
    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles({
      name: `windows-width-${width}.md`,
      mimeType: "text/markdown",
      buffer: Buffer.from(`# Windows width ${width}\n\nKeep the reader usable in a compact window.`),
    });
    await expect(page.getByRole("heading", { name: `Windows width ${width}` })).toBeVisible();

    const toolbar = page.locator(".toolbar");
    await expect(toolbar.locator(".toolbar-overflow-trigger")).toBeVisible();
    await expect(toolbar.locator(":scope > .toolbar-group > .toolbar-optional")).toHaveCount(3);
    await expect(toolbar.locator(":scope > .toolbar-group > .toolbar-optional").first()).toBeHidden();

    const metrics = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      toolbarClientWidth: document.querySelector(".toolbar")?.clientWidth ?? 0,
      toolbarScrollWidth: document.querySelector(".toolbar")?.scrollWidth ?? 0,
    }));
    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.toolbarScrollWidth).toBe(metrics.toolbarClientWidth);

    await openMoreMenu(page);
    await expect(
      page.locator(".toolbar-overflow-panel").getByRole("button", { name: "快速打开", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(".toolbar-overflow-panel").getByRole("button", { name: "专注", exact: true }),
    ).toBeVisible();
  }
});

test("keeps topbar overlays mutually exclusive", async ({ page }) => {
  await page.goto("/");

  await openSettingsMenu(page);
  await expect(page.locator(".settings-menu")).toHaveAttribute("open", "");
  await expect(page.locator(".toolbar-overflow-panel")).toBeVisible();
  const menuGeometry = await page.locator(".toolbar-overflow-panel").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      right: rect.right,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });
  expect(menuGeometry.bottom).toBeLessThanOrEqual(menuGeometry.viewportHeight);
  expect(menuGeometry.right).toBeLessThanOrEqual(menuGeometry.viewportWidth);

  await page.getByRole("button", { name: "文内查找", exact: true }).click();
  await expect(page.locator(".settings-menu")).not.toHaveAttribute("open");
  await expect(page.getByRole("searchbox", { name: "文内查找" })).toBeVisible();

  await openSettingsMenu(page);
  await expect(page.getByRole("searchbox", { name: "文内查找" })).toHaveCount(0);
  await expect(page.locator(".settings-menu")).toHaveAttribute("open", "");
});

test("dismisses topbar menus with an outside click or Escape", async ({ page }) => {
  await page.goto("/");

  await openSettingsMenu(page);
  const overflowMenu = page.locator(".toolbar-overflow");
  const settingsMenu = page.locator(".settings-menu");
  const exportMenu = page.locator(".export-menu");
  await expect(settingsMenu).toHaveAttribute("open", "");
  await page.locator(".empty-state").click();
  await expect(settingsMenu).not.toHaveAttribute("open");
  await expect(overflowMenu).not.toHaveAttribute("open");

  await openSettingsMenu(page);
  await page.keyboard.press("Escape");
  await expect(settingsMenu).not.toHaveAttribute("open");
  await expect(overflowMenu).not.toHaveAttribute("open");

  await page.locator('input[type="file"]').setInputFiles({
    name: "menu-dismiss.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Menu dismiss"),
  });
  await expect(page.getByRole("heading", { name: "Menu dismiss" })).toBeVisible();
  await switchToRenderedMode(page);
  await openMoreMenu(page);
  await page.locator(".topbar .export-menu summary").click();
  await expect(exportMenu).toHaveAttribute("open", "");
  await page.locator(".reader-content").click({ position: { x: 20, y: 120 } });
  await expect(exportMenu).not.toHaveAttribute("open");
  await expect(overflowMenu).not.toHaveAttribute("open");

  await openMoreMenu(page);
  await page.keyboard.press("Escape");
  await expect(overflowMenu).not.toHaveAttribute("open");
});
