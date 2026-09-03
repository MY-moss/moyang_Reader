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
