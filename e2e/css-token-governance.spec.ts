import { expect, test } from "@playwright/test";

test("keeps chrome spacing tokenized and usable at compact Windows widths", async ({ page }) => {
  for (const width of [720, 900]) {
    await page.setViewportSize({ width, height: 820 });
    await page.goto("/");

    await expect(page.locator(".topbar")).toBeVisible();
    await expect(page.locator(".sidebar")).toBeVisible();
    await expect(page.locator(".workspace-panel")).toBeVisible();

    const metrics = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const read = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) throw new Error(`missing ${selector}`);
        const styles = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          columnGap: styles.columnGap,
          gap: styles.gap,
          padding: styles.padding,
          paddingBottom: styles.paddingBottom,
          rowGap: styles.rowGap,
          right: rect.right,
          left: rect.left,
        };
      };

      return {
        tokens: Object.fromEntries(
          [
            "--space-2",
            "--space-4",
            "--space-8",
            "--space-10",
            "--space-12",
            "--space-13",
            "--space-14",
            "--space-15",
            "--space-16",
          ].map((name) => [name, root.getPropertyValue(name).trim()]),
        ),
        topbar: read(".topbar"),
        toolbar: read(".toolbar"),
        sidebar: read(".sidebar"),
        workspacePanel: read(".workspace-panel"),
        workspaceHeading: read(".workspace-heading"),
        viewport: {
          clientWidth: document.documentElement.clientWidth,
          bodyScrollWidth: document.body.scrollWidth,
        },
      };
    });

    expect(metrics.tokens["--space-2"]).toBe("4px");
    expect(metrics.tokens["--space-4"]).toBe("6px");
    expect(metrics.tokens["--space-16"]).toBe("24px");
    expect(metrics.sidebar.padding).toBe("24px 16px");
    expect(metrics.workspacePanel.paddingBottom).toBe("24px");
    expect(metrics.workspaceHeading.gap).toBe("12px");
    expect(metrics.toolbar.columnGap).toBe("4px");
    expect(metrics.topbar.right).toBeLessThanOrEqual(metrics.viewport.clientWidth);
    expect(metrics.topbar.left).toBeGreaterThanOrEqual(0);
    expect(metrics.viewport.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewport.clientWidth);

    if (width <= 840) {
      expect(metrics.topbar.gap).toBe("10px 14px");
      expect(metrics.topbar.padding).toBe("12px 16px");
    } else {
      expect(metrics.topbar.gap).toBe("14px");
      expect(metrics.topbar.padding).toBe("12px 18px");
    }

    if (width <= 720) expect(metrics.toolbar.rowGap).toBe("6px");
  }
});

test("keeps chrome and workspace typography on the semantic type scale", async ({ page }) => {
  for (const width of [720, 900]) {
    await page.setViewportSize({ width, height: 820 });
    await page.goto("/");

    await expect(page.locator(".brand-name")).toBeVisible();
    await expect(page.locator(".workspace-heading h2")).toBeVisible();
    await expect(page.locator(".workspace-help")).toBeVisible();
    await expect(page.locator(".statusbar")).toBeVisible();

    const metrics = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const readFontSize = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) throw new Error(`missing ${selector}`);
        return getComputedStyle(element).fontSize;
      };

      return {
        tokens: Object.fromEntries(
          [
            "--type-kicker",
            "--type-caption",
            "--type-control",
            "--type-body",
            "--type-emphasis",
            "--type-icon",
            "--type-brand",
            "--type-section",
            "--type-heading",
          ].map((name) => [name, root.getPropertyValue(name).trim()]),
        ),
        fontSizes: {
          brand: readFontSize(".brand-name"),
          toolbar: readFontSize(".toolbar-button"),
          workspaceHeading: readFontSize(".workspace-heading h2"),
          workspaceHelp: readFontSize(".workspace-help"),
          statusbar: readFontSize(".statusbar"),
        },
        viewport: {
          clientWidth: document.documentElement.clientWidth,
          bodyScrollWidth: document.body.scrollWidth,
        },
      };
    });

    expect(metrics.tokens["--type-kicker"]).toBe("9px");
    expect(metrics.tokens["--type-caption"]).toBe("10px");
    expect(metrics.tokens["--type-control"]).toBe("11px");
    expect(metrics.tokens["--type-body"]).toBe("12px");
    expect(metrics.tokens["--type-emphasis"]).toBe("13px");
    expect(metrics.tokens["--type-icon"]).toBe("15px");
    expect(metrics.tokens["--type-brand"]).toBe("16px");
    expect(metrics.tokens["--type-section"]).toBe("17px");
    expect(metrics.tokens["--type-heading"]).toBe("19px");
    expect(metrics.fontSizes).toEqual({
      brand: "16px",
      toolbar: "11px",
      workspaceHeading: "19px",
      workspaceHelp: "11px",
      statusbar: "10px",
    });
    expect(metrics.viewport.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewport.clientWidth);
  }
});

test("keeps residual chrome motion tokenized and reduced-motion safe", async ({ page }) => {
  const readMotion = () =>
    page.evaluate(() => {
      const fixture = document.createElement("div");
      fixture.style.cssText = "position:fixed;inset:0 auto auto 0;width:440px;visibility:hidden;pointer-events:none;";

      const fileDropCard = document.createElement("div");
      fileDropCard.className = "file-drop-card";
      const quickOpenItem = document.createElement("button");
      quickOpenItem.className = "quick-open-item";
      fixture.append(fileDropCard, quickOpenItem);
      document.body.append(fixture);

      const root = getComputedStyle(document.documentElement);
      const read = (element: HTMLElement) => getComputedStyle(element).transitionDuration;
      const result = {
        tokens: {
          fileDrop: root.getPropertyValue("--motion-file-drop").trim(),
          quickOpenItem: root.getPropertyValue("--motion-quick-open-item").trim(),
          reduced: root.getPropertyValue("--motion-reduced").trim(),
        },
        transitions: {
          fileDrop: read(fileDropCard),
          quickOpenItem: read(quickOpenItem),
        },
        viewport: {
          clientWidth: document.documentElement.clientWidth,
          bodyScrollWidth: document.body.scrollWidth,
        },
      };

      fixture.remove();
      return result;
    });

  for (const width of [720, 900]) {
    await page.setViewportSize({ width, height: 820 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");

    const normal = await readMotion();
    expect(normal.tokens).toEqual({ fileDrop: ".14s", quickOpenItem: ".13s", reduced: ".01ms" });
    expect(normal.transitions).toEqual({
      fileDrop: "0.14s, 0.14s",
      quickOpenItem: "0.13s, 0.13s, 0.13s",
    });
    expect(normal.viewport.bodyScrollWidth).toBeLessThanOrEqual(normal.viewport.clientWidth);

    await page.emulateMedia({ reducedMotion: "reduce" });
    const reduced = await readMotion();
    expect(reduced.transitions).toEqual({
      fileDrop: "1e-05s",
      quickOpenItem: "1e-05s",
    });
  }
});

test("keeps the page backdrop aligned with explicit and system dark themes", async ({ page }) => {
  const readBackdrop = () =>
    page.evaluate(() => {
      const rootStyles = getComputedStyle(document.documentElement);
      const bodyStyles = getComputedStyle(document.body);
      return {
        pageBackgroundToken: rootStyles.getPropertyValue("--page-background").trim(),
        backgroundImage: bodyStyles.backgroundImage,
        backgroundColor: bodyStyles.backgroundColor,
        viewport: {
          clientWidth: document.documentElement.clientWidth,
          bodyScrollWidth: document.body.scrollWidth,
        },
      };
    });

  for (const width of [720, 900]) {
    await page.setViewportSize({ width, height: 820 });
    await page.emulateMedia({ colorScheme: "light", forcedColors: "none" });
    await page.goto("/");

    await page.evaluate(() => {
      document.documentElement.dataset.theme = "light";
    });
    const light = await readBackdrop();

    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });
    const explicitDark = await readBackdrop();

    await page.emulateMedia({ colorScheme: "dark", forcedColors: "none" });
    await page.evaluate(() => {
      document.documentElement.removeAttribute("data-theme");
    });
    const systemDark = await readBackdrop();

    expect(explicitDark).toEqual(systemDark);
    expect(light.backgroundImage).toContain("rgb(242, 239, 231)");
    expect(light.backgroundImage).toContain("rgb(232, 229, 220)");
    expect(explicitDark.backgroundImage).not.toContain("rgb(242, 239, 231)");
    expect(explicitDark.backgroundImage).not.toContain("rgb(232, 229, 220)");
    expect(explicitDark.backgroundImage).not.toEqual(light.backgroundImage);
    expect(explicitDark.viewport.bodyScrollWidth).toBeLessThanOrEqual(explicitDark.viewport.clientWidth);
    expect(light.viewport.bodyScrollWidth).toBeLessThanOrEqual(light.viewport.clientWidth);

    await page.emulateMedia({ colorScheme: "light", forcedColors: "active" });
    await page.goto("/");
    const forcedColors = await readBackdrop();
    expect(forcedColors.pageBackgroundToken).toBe("Canvas");
    expect(forcedColors.backgroundImage).toBe("none");
  }
});

test("keeps annotation highlights legible across theme modes", async ({ page }) => {
  const mountAnnotationFixture = () =>
    page.evaluate(() => {
      document.querySelector<HTMLElement>('[data-e2e="annotation-theme-fixture"]')?.remove();

      const fixture = document.createElement("aside");
      fixture.dataset.e2e = "annotation-theme-fixture";
      fixture.className = "context-sidebar";
      fixture.style.cssText = "position:fixed;left:0;top:0;width:320px;visibility:hidden;pointer-events:none;";

      const quote = document.createElement("blockquote");
      quote.className = "annotation-quote";
      quote.textContent = "批注引用";

      const item = document.createElement("div");
      item.className = "annotation-item current";
      const mark = document.createElement("span");
      mark.className = "annotation-mark";
      mark.textContent = "✦";
      item.append(mark);

      const highlighted = document.createElement("mark");
      highlighted.className = "moyang-annotation-hit";
      highlighted.textContent = "正文高亮";

      fixture.append(item, quote);
      document.body.append(fixture, highlighted);
    });

  const readAnnotationStyles = () =>
    page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const quote = document.querySelector<HTMLElement>('[data-e2e="annotation-theme-fixture"] .annotation-quote');
      const mark = document.querySelector<HTMLElement>('[data-e2e="annotation-theme-fixture"] .annotation-mark');
      const highlighted = document.querySelector<HTMLElement>(".moyang-annotation-hit");
      if (!quote || !mark || !highlighted) throw new Error("annotation theme fixture is missing");

      const quoteStyles = getComputedStyle(quote);
      const markStyles = getComputedStyle(mark);
      const highlightedStyles = getComputedStyle(highlighted);
      return {
        tokens: {
          border: root.getPropertyValue("--annotation-border").trim(),
          surface: root.getPropertyValue("--annotation-surface").trim(),
        },
        quoteBorder: quoteStyles.borderLeftColor,
        quoteBackground: quoteStyles.backgroundColor,
        markColor: markStyles.color,
        highlightBackground: highlightedStyles.backgroundColor,
        viewport: {
          clientWidth: document.documentElement.clientWidth,
          bodyScrollWidth: document.body.scrollWidth,
        },
      };
    });

  await page.setViewportSize({ width: 720, height: 820 });
  await page.emulateMedia({ colorScheme: "light", forcedColors: "none" });
  await page.goto("/");
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "light";
  });
  await mountAnnotationFixture();
  const light = await readAnnotationStyles();

  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  const explicitDark = await readAnnotationStyles();

  await page.emulateMedia({ colorScheme: "dark", forcedColors: "none" });
  await page.evaluate(() => {
    document.documentElement.removeAttribute("data-theme");
  });
  const systemDark = await readAnnotationStyles();

  expect(light.tokens).toEqual({ border: "#ad7d2d", surface: "#e7c768" });
  expect(light.quoteBorder).toBe("rgb(173, 125, 45)");
  expect(light.markColor).toBe("rgb(173, 125, 45)");
  expect(explicitDark.tokens).toEqual({ border: "#f0d79a", surface: "#e7c768" });
  expect(explicitDark.quoteBorder).toBe("rgb(240, 215, 154)");
  expect(explicitDark.markColor).toBe("rgb(240, 215, 154)");
  expect(systemDark).toEqual(explicitDark);
  expect(light.highlightBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(explicitDark.quoteBackground).not.toBe(light.quoteBackground);
  expect(light.viewport.bodyScrollWidth).toBeLessThanOrEqual(light.viewport.clientWidth);
  expect(explicitDark.viewport.bodyScrollWidth).toBeLessThanOrEqual(explicitDark.viewport.clientWidth);

  await page.emulateMedia({ colorScheme: "light", forcedColors: "active" });
  await page.goto("/");
  await mountAnnotationFixture();
  const forcedColors = await readAnnotationStyles();
  expect(forcedColors.tokens).toEqual({ border: "Highlight", surface: "Highlight" });
  expect(forcedColors.quoteBorder).not.toBe(light.quoteBorder);
  expect(forcedColors.markColor).not.toBe(light.markColor);
  expect(forcedColors.viewport.bodyScrollWidth).toBeLessThanOrEqual(forcedColors.viewport.clientWidth);
});

test("keeps document preview canvases legible across theme modes", async ({ page }) => {
  const mountPreviewFixture = () =>
    page.evaluate(() => {
      document.querySelector<HTMLElement>('[data-e2e="preview-theme-fixture"]')?.remove();

      const fixture = document.createElement("div");
      fixture.dataset.e2e = "preview-theme-fixture";
      fixture.style.cssText =
        "position:fixed;left:0;top:0;width:320px;height:240px;visibility:hidden;pointer-events:none;";

      const pdfPreview = document.createElement("section");
      pdfPreview.className = "pdf-preview";
      pdfPreview.style.cssText = "width:320px;height:120px;margin:0;";

      const imagePreview = document.createElement("section");
      imagePreview.className = "image-preview";
      imagePreview.style.cssText = "width:320px;height:120px;margin:0;";

      const imageCanvas = document.createElement("div");
      imageCanvas.className = "image-canvas";
      imagePreview.append(imageCanvas);
      fixture.append(pdfPreview, imagePreview);
      document.body.append(fixture);
    });

  const readPreviewStyles = () =>
    page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const pdfPreview = document.querySelector<HTMLElement>('[data-e2e="preview-theme-fixture"] .pdf-preview');
      const imagePreview = document.querySelector<HTMLElement>('[data-e2e="preview-theme-fixture"] .image-preview');
      const imageCanvas = document.querySelector<HTMLElement>('[data-e2e="preview-theme-fixture"] .image-canvas');
      if (!pdfPreview || !imagePreview || !imageCanvas) throw new Error("preview theme fixture is missing");

      return {
        tokens: {
          surface: root.getPropertyValue("--preview-surface").trim(),
          checkerLight: root.getPropertyValue("--preview-checker-light").trim(),
          checkerDark: root.getPropertyValue("--preview-checker-dark").trim(),
        },
        pdfBackground: getComputedStyle(pdfPreview).backgroundColor,
        imageBackground: getComputedStyle(imagePreview).backgroundColor,
        canvasBackground: getComputedStyle(imageCanvas).backgroundImage,
        viewport: {
          clientWidth: document.documentElement.clientWidth,
          bodyScrollWidth: document.body.scrollWidth,
        },
      };
    });

  await page.setViewportSize({ width: 720, height: 820 });
  await page.emulateMedia({ colorScheme: "light", forcedColors: "none" });
  await page.goto("/");
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "light";
  });
  await mountPreviewFixture();
  const light = await readPreviewStyles();

  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  const explicitDark = await readPreviewStyles();

  await page.emulateMedia({ colorScheme: "dark", forcedColors: "none" });
  await page.evaluate(() => {
    document.documentElement.removeAttribute("data-theme");
  });
  const systemDark = await readPreviewStyles();

  expect(light.tokens).toEqual({
    surface: "#e7e3db",
    checkerLight: "#ebe8e1",
    checkerDark: "#e2ded6",
  });
  expect(light.pdfBackground).toBe("rgb(231, 227, 219)");
  expect(light.imageBackground).toBe(light.pdfBackground);
  expect(light.canvasBackground).toContain("rgb(235, 232, 225)");
  expect(light.canvasBackground).toContain("rgb(226, 222, 214)");

  expect(explicitDark.tokens).toEqual({
    surface: "#222826",
    checkerLight: "#323a37",
    checkerDark: "#252c2a",
  });
  expect(explicitDark.pdfBackground).toBe("rgb(34, 40, 38)");
  expect(explicitDark.imageBackground).toBe(explicitDark.pdfBackground);
  expect(explicitDark.canvasBackground).not.toContain("rgb(235, 232, 225)");
  expect(explicitDark.canvasBackground).not.toContain("rgb(226, 222, 214)");
  expect(systemDark).toEqual(explicitDark);
  expect(light.viewport.bodyScrollWidth).toBeLessThanOrEqual(light.viewport.clientWidth);
  expect(explicitDark.viewport.bodyScrollWidth).toBeLessThanOrEqual(explicitDark.viewport.clientWidth);

  await page.emulateMedia({ colorScheme: "light", forcedColors: "active" });
  await page.goto("/");
  await mountPreviewFixture();
  const forcedColors = await readPreviewStyles();
  expect(forcedColors.tokens).toEqual({
    surface: "Canvas",
    checkerLight: "Canvas",
    checkerDark: "Canvas",
  });
  expect(forcedColors.canvasBackground).toBe("none");
  expect(forcedColors.pdfBackground).not.toBe(light.pdfBackground);
  expect(forcedColors.imageBackground).not.toBe(light.imageBackground);
  expect(forcedColors.viewport.bodyScrollWidth).toBeLessThanOrEqual(forcedColors.viewport.clientWidth);
});
