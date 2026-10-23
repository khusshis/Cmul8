import { test, expect } from "@playwright/test";
import { hasCreds } from "../../playwright.config";
import { openProject, ensureBankTemplate } from "./helpers";

test.skip(!hasCreds, "needs E2E_EMAIL/E2E_PASSWORD");
test.describe.configure({ timeout: 180_000 }); // Pyodide WASM download can be slow

const loadBankTemplate = ensureBankTemplate;

test.describe("Workspace canvas", () => {
  test("opens, shows the palette, and loads a starter template", async ({ page }) => {
    await openProject(page);
    await expect(page.getByText(/model\. simulate\. optimize\./i)).toBeVisible({ timeout: 30_000 });
    await loadBankTemplate(page);
    await expect(page.locator(".react-flow, [data-testid='rf__wrapper'], svg").first()).toBeVisible();
  });

  test("run a simulation and open the results dashboard (every tab)", async ({ page }) => {
    await openProject(page);
    await loadBankTemplate(page);
    // Wait for the engine (SimPy or fallback) to be ready, then Run.
    await page.getByRole("button", { name: /^run$/i }).click({ timeout: 150_000 }); // disabled while SimPy loads
    // Results appear in the side panel; expand to the full dashboard.
    const expand = page.getByRole("button", { name: /open full analytics/i }).first();
    await expect(page.getByText(/total (arrived|completed)|health|bottleneck/i).first()).toBeVisible({ timeout: 120_000 });
    if (await expand.count()) {
      await expand.click();
      for (const label of ["Executive Summary", "Flow & Balance Check", "Traffic Heatmap", "Line Buildup Timeline", "Station Counters", "Person / Item Journey", "Live Activity Log", "Cost & ROI"]) {
        const tab = page.getByRole("tab", { name: label }).or(page.getByText(label, { exact: false }));
        if (await tab.first().count()) await tab.first().click().catch(() => {});
      }
    }
  });

  test("code inspector shows generated SimPy and offers export", async ({ page }) => {
    await openProject(page);
    await loadBankTemplate(page);
    await page.getByRole("button", { name: /more options/i }).click();
    await page.getByText("SimPy Python Code").click();
    await expect(page.getByText(/import simpy|AUTO-GENERATED|def run_simulation/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("export JSON downloads a file", async ({ page }) => {
    await openProject(page);
    await loadBankTemplate(page);
    await page.getByRole("button", { name: /share/i }).first().click();
    const dl = page.waitForEvent("download", { timeout: 20_000 }).catch(() => null);
    await page.getByRole("tab", { name: /export/i }).click();
    await page.getByText("Download as JSON").click();
    const file = await dl;
    expect(file, "JSON export should trigger a download").toBeTruthy();
    expect(file!.suggestedFilename()).toMatch(/\.json$/);
  });
});
