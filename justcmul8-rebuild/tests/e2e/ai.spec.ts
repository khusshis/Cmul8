import { test, expect } from "@playwright/test";
import { hasCreds } from "../../playwright.config";
import { openProject, stubAi, ensureBankTemplate } from "./helpers";

test.skip(!hasCreds, "needs E2E_EMAIL/E2E_PASSWORD");
test.describe.configure({ timeout: 120_000 });

test.describe("AI assistant (mocked /api/ai/*)", () => {
  test("sends a message, applies ops, and does NOT render images from AI markdown", async ({ page }) => {
    await stubAi(page);
    await openProject(page);
    await ensureBankTemplate(page);
    // Open the AI panel.
    await page.getByRole("button", { name: /ai|assistant|sparkle/i }).first().click().catch(() => {});
    const input = page.getByPlaceholder(/ask ai|describe a workflow/i);
    await expect(input).toBeVisible({ timeout: 20_000 });
    await input.fill("Add a server and explain the bottleneck");
    await input.press("Enter");

    // The mocked reply text renders...
    await expect(page.getByText(/teller is the bottleneck/i)).toBeVisible({ timeout: 20_000 });
    // ...but the embedded image must be stripped/blocked, never fetched or rendered.
    const img = page.locator('img[src*="evil.example"]');
    await expect(img).toHaveCount(0);
    // The op should have added the E2E Server block to the canvas.
    await expect(page.getByText(/E2E Server/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
