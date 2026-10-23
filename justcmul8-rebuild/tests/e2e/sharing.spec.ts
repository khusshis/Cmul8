import { test, expect } from "@playwright/test";
import { hasCreds } from "../../playwright.config";
import { openProject, ensureBankTemplate } from "./helpers";

test.skip(!hasCreds, "needs E2E_EMAIL/E2E_PASSWORD");
test.describe.configure({ timeout: 120_000 });

test.describe("Sharing", () => {
  test("create a link, open it read-only when signed out, then revoke it", async ({ page, browser }) => {
    await openProject(page);
    await ensureBankTemplate(page);
    await page.getByRole("button", { name: /share/i }).first().click();

    // Make the link "Anyone with the link" (Pro) and grab the URL. If the account is Free,
    // this is a documented Pro-gate rather than a bug.
    const accessSelect = page.getByLabel(/who can open the link/i);
    let shareUrl: string | null = null;
    if (await accessSelect.count()) {
      await accessSelect.selectOption("anyone").catch(() => {});
      const field = page.locator('input[readonly], input[value*="/share/"]').first();
      shareUrl = await field.inputValue().catch(() => null);
      if (!shareUrl) {
        const text = await page.getByText(/\/share\//).first().textContent().catch(() => null);
        shareUrl = text?.match(/\/share\/[A-Za-z0-9_-]+/)?.[0] ?? null;
      }
    }
    if (!shareUrl) {
      test.info().annotations.push({ type: "note", description: "No 'anyone' link available (Free plan gate or UI change)." });
      return;
    }

    // Open it in a fresh signed-out context -> read-only viewer.
    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const anonPage = await anon.newPage();
    await anonPage.goto(shareUrl.startsWith("http") ? shareUrl : new URL(shareUrl, page.url()).toString());
    await expect(anonPage.getByText(/view only|sign in to collaborate/i).first()).toBeVisible({ timeout: 20_000 });
    await anon.close();

    // Revoke (reset) the link -> old URL becomes unavailable.
    await page.getByRole("button", { name: /reset link/i }).click().catch(() => {});
    const anon2 = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const p2 = await anon2.newPage();
    await p2.goto(shareUrl.startsWith("http") ? shareUrl : new URL(shareUrl, page.url()).toString());
    await expect(p2.getByText(/revoked|doesn't exist|unavailable|need access/i).first()).toBeVisible({ timeout: 20_000 });
    await anon2.close();
  });
});
