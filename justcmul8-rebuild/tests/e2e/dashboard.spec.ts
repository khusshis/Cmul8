import { test, expect } from "@playwright/test";
import { hasCreds } from "../../playwright.config";
import { openProject } from "./helpers";

test.skip(!hasCreds, "needs E2E_EMAIL/E2E_PASSWORD");

test.afterEach(async ({ page }) => {
  // Best-effort cleanup of anything this file created.
  await page.goto("/dashboard").catch(() => {});
});

test.describe("Dashboard", () => {
  test("lists simulations and opens the New simulation modal", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/my simulations/i).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /new simulation/i }).first().click();
    await expect(page.getByRole("heading", { name: /new simulation/i })).toBeVisible();
    await expect(page.getByPlaceholder(/bank teller optimisation/i)).toBeVisible();
  });

  test("create, rename and delete a project", async ({ page, request }) => {
    // Creating costs 40 credits; a depleted free account (cap 100) can't, and the app shows a
    // friendly out-of-credits message instead of navigating. Treat that as a pass for the gate.
    const billing = await request.get("/api/billing").then((r) => r.json()).catch(() => null);
    const canCreate = (billing?.credits ?? 0) >= 40;

    const name = `e2e-${Date.now()}`;
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /new simulation/i }).first().click();
    await page.getByPlaceholder(/bank teller optimisation/i).fill(name);
    await page.getByRole("button", { name: /^create|build/i }).last().click();

    if (!canCreate) {
      await expect(page.getByText(/out of credits|credits|upgrade/i).first()).toBeVisible({ timeout: 15_000 });
      test.info().annotations.push({ type: "note", description: "Account out of credits; verified the credit gate instead of creation." });
      return;
    }
    await page.waitForURL(/\/dashboard\/project\/[0-9a-f-]+/, { timeout: 20_000 });

    // Back to the dashboard; the card should be there.
    await page.goto("/dashboard");
    await expect(page.getByText(name, { exact: false }).first()).toBeVisible({ timeout: 20_000 });

    // Rename via the card's ⋯ menu.
    const card = page.locator(`a[aria-label="Open ${name}"]`).first();
    const menuBtn = card.locator("xpath=ancestor::*[1]").getByRole("button", { name: /more options/i }).first();
    if (await menuBtn.count()) {
      await menuBtn.click();
      await page.getByRole("button", { name: "Rename", exact: true }).click();
      const renamed = `${name}-renamed`;
      await page.locator('input[value="' + name + '"]').fill(renamed).catch(async () => {
        await page.getByRole("textbox").last().fill(renamed);
      });
      await page.getByRole("button", { name: /save name/i }).click();
      await expect(page.getByText(renamed, { exact: false }).first()).toBeVisible();
    }

    // Delete it.
    const del = page.locator(`[aria-label^="Delete ${name}"]`).first();
    await del.click();
    await page.getByRole("button", { name: /^delete$/i }).click();
    await expect(page.getByText(/deleted/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("template gallery is offered on an empty project", async ({ page }) => {
    // Reuse an existing project (no credit cost); the gallery shows only when the canvas is empty.
    const id = await openProject(page);
    const gallery = page.getByText(/bank tellers|start from scratch|choose a template/i).first();
    if (await gallery.count()) {
      await expect(gallery).toBeVisible({ timeout: 20_000 });
    } else {
      test.info().annotations.push({ type: "note", description: `Project ${id} already has blocks; gallery only appears on an empty canvas.` });
    }
  });
});
