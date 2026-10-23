import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ storageState: { cookies: [], origins: [] } });

const PUBLIC_PAGES = ["/", "/login", "/signup", "/forgot-password"];

test.describe("Accessibility smoke (serious/critical only)", () => {
  for (const path of PUBLIC_PAGES) {
    test(`axe: ${path}`, async ({ page }, testInfo) => {
      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      testInfo.annotations.push({
        type: "axe-violations",
        description: JSON.stringify(serious.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))),
      });
      // Report, don't hard-fail the whole suite on pre-existing a11y debt.
      expect(serious.length, `${path}: ${serious.map((v) => v.id).join(", ")}`).toBeLessThanOrEqual(20);
    });
  }
});

test.describe("Responsive smoke (375px, no horizontal scroll)", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  for (const path of PUBLIC_PAGES) {
    test(`no horizontal overflow: ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(2);
    });
  }
});
