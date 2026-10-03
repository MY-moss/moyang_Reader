import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const themes = ["porcelain", "paper", "ink", "system-dark"] as const;
const media = ["motion", "reduced", "forced"] as const;

for (const theme of themes) {
  for (const preference of theme === "system-dark" ? (["motion"] as const) : media) {
    test(`keeps empty-state contrast throughout entry: ${theme} ${preference}`, async ({ page }) => {
      await page.setViewportSize({
        width: preference === "forced" ? 720 : preference === "reduced" ? 900 : 1240,
        height: 600,
      });
      await page.emulateMedia({
        colorScheme: theme === "ink" || theme === "system-dark" ? "dark" : "light",
        reducedMotion: preference === "reduced" ? "reduce" : "no-preference",
        forcedColors: preference === "forced" ? "active" : "none",
      });
      await page.goto("/");
      const empty = page.locator(".empty-state");
      await expect(empty).toBeVisible();
      await page.evaluate((selected) => {
        if (selected === "system-dark") document.documentElement.removeAttribute("data-theme");
        else document.documentElement.dataset.theme = selected;
      }, theme);

      for (const progress of [0.25, 0.5, 0.75, 0, 1]) {
        const snapshot = await empty.evaluate((element, fraction) => {
          const animations = element
            .getAnimations()
            .filter((animation) => animation instanceof CSSAnimation && animation.animationName === "empty-rise");
          for (const animation of animations) {
            animation.pause();
            animation.currentTime = Number(animation.effect!.getTiming().duration) * fraction;
          }
          const styles = getComputedStyle(element);
          return {
            opacity: styles.opacity,
            transform: styles.transform,
            animations: animations.length,
            colors: Array.from(element.querySelectorAll("p, button, .empty-capabilities span")).map((node) => {
              const computed = getComputedStyle(node);
              return { text: node.textContent, foreground: computed.color, background: computed.backgroundColor };
            }),
          };
        }, progress);
        // Audit this surface across themes; existing a11y.spec.ts keeps its
        // whole-page rules. The separate paper statusbar defect is tracked.
        const results = await new AxeBuilder({ page })
          .include(".empty-state")
          .withTags(["wcag2a", "wcag2aa"])
          .analyze();
        await test.info().attach(`entry-${progress}`, {
          body: JSON.stringify({ theme, preference, progress, snapshot, violations: results.violations }, null, 2),
          contentType: "application/json",
        });
        expect(
          results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical"),
        ).toEqual([]);
        expect(snapshot.opacity, "entry must not fade readable text or actionable controls").toBe("1");
        expect(snapshot.animations).toBe(preference === "reduced" ? 0 : 1);
        if (preference !== "reduced" && progress === 0) expect(snapshot.transform).not.toBe("none");
        if (progress === 0.25 && test.info().repeatEachIndex === 0) {
          await page.screenshot({ path: `.codex-cache/d29-visual/${theme}-${preference}.png` });
        }
      }
    });
  }
}
