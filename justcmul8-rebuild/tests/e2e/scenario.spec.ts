import { test, expect } from "@playwright/test";
import { hasCreds } from "../../playwright.config";
import { openProject, ensureBankTemplate } from "./helpers";

test.skip(!hasCreds, "needs E2E_EMAIL/E2E_PASSWORD");
test.describe.configure({ timeout: 300_000 });

test.describe("Scenario comparison (Reliability Lab)", () => {
  test("load A, duplicate into B and a third scenario C, compare, see verdict + significance", async ({ page }) => {
    await openProject(page);
    await ensureBankTemplate(page);
    await page.getByRole("button", { name: /more options/i }).click();
    await page.getByText(/stress test|monte carlo|risk simulator/i).first().click();
    await expect(page.getByText(/reliability lab/i).first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole("tab", { name: /compare scenarios/i }).click();
    await page.getByRole("button", { name: "Load full canvas" }).click();          // A (baseline)
    await page.getByRole("button", { name: "Duplicate baseline" }).click();        // B
    await page.getByRole("button", { name: "Duplicate baseline" }).click();        // C (third scenario)
    await page.getByText(/^10$/).first().click().catch(() => {});                  // fewer runs per scenario

    const run = page.getByRole("button", { name: /^compare 3 scenarios/i });
    await expect(run).toBeEnabled({ timeout: 10_000 });
    await run.click();
    await expect(page.getByText(/statistically significant|significan|p [<=] |no meaningful|best|winner/i).first()).toBeVisible({ timeout: 270_000 });
  });
});
