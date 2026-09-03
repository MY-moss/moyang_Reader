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
