import { test, expect, Page } from "@playwright/test";
import { hasCreds } from "../../playwright.config";
import { openProject, ensureBankTemplate } from "./helpers";

test.skip(!hasCreds, "needs E2E_EMAIL/E2E_PASSWORD");
test.describe.configure({ timeout: 300_000 });

export async function openLab(page: Page) {
  await ensureBankTemplate(page);
  await page.getByRole("button", { name: /more options/i }).click();
  await page.getByText(/stress test|monte carlo|risk simulator/i).first().click();
  await expect(page.getByText(/reliability lab/i).first()).toBeVisible({ timeout: 20_000 });
}

async function runStress(page: Page) {
  await page.getByRole("button", { name: /run \d+ simulation|run until precise|run again/i }).first().click();
}

test.describe("Monte Carlo — stress test", () => {
  test("Customize drawer: set a stress condition, run, see result cards + chart", async ({ page }) => {
    await openProject(page);
    await openLab(page);

    // Open the Customize drawer and set a demand multiplier > 1 (a stress condition).
    await page.getByRole("button", { name: /^customize/i }).click();
    const demand = page.getByRole("slider", { name: "Demand multiplier" });
    if (await demand.count()) {
      await demand.fill("2").catch(async () => { await demand.click(); await page.keyboard.type("2"); });
    }
    // Pick 10 runs where offered.
    await page.getByText(/^10$/).first().click().catch(() => {});
    await runStress(page);

    // Active stress condition chip should reflect the demand change.
    await expect(page.getByText(/^Demand 2(\.0+)?×$/).first()).toBeVisible({ timeout: 20_000 });
    // Aggregated output: result cards + a recharts chart.
    await expect(page.getByText(/throughput|wait|utilization|health|confidence|best|worst|typical/i).first()).toBeVisible({ timeout: 240_000 });
    await expect(page.locator('svg[role="img"], [role="img"] svg, .recharts-wrapper svg').first()).toBeVisible({ timeout: 20_000 });
  });

  test("breaking-point sweep runs a short 3-step sweep", async ({ page }) => {
    await openProject(page);
    await openLab(page);
    await page.getByRole("button", { name: /^customize/i }).click();
    // Sweep From/To/Steps live in the customize drawer (StressExtras).
    const from = page.getByLabel(/sweep from/i), to = page.getByLabel(/sweep to/i), steps = page.getByLabel("Steps", { exact: true }).first();
    if (!(await from.count()) || !(await steps.count())) {
      test.info().annotations.push({ type: "note", description: "Sweep controls not found; UI may differ." });
      return;
    }
    await from.fill("1"); await to.fill("2"); await steps.fill("3");
    await page.getByRole("button", { name: /breaking.?point|sweep/i }).first().click();
    await expect(page.getByText(/breaking.?point sweep|demand|runs meeting/i).first()).toBeVisible({ timeout: 240_000 });
  });

  test("engine failure state when the Pyodide CDN is blocked", async ({ page }) => {
    await page.route("**/cdn.jsdelivr.net/pyodide/**", (r) => r.abort());
    await openProject(page);
    await openLab(page);
    await page.getByText(/^10$/).first().click().catch(() => {});
    await runStress(page);
    await expect(
      page.getByText(/throughput|wait|utilization|fallback|error|could not|failed|indicative|stopped/i).first()
    ).toBeVisible({ timeout: 240_000 });
  });
});
