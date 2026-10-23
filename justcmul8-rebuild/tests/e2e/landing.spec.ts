import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } }); // landing is public

test.describe("Landing page", () => {
  test("hero, all sections and footer render", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/JustCmul8/i);
    for (const id of ["features", "pricing", "security"]) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    await expect(page.getByRole("navigation", { name: /main navigation/i })).toBeVisible();
  });

  test("nav links to sign up / log in work", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /^get started$/i }).first().click();
    await expect(page).toHaveURL(/\/signup/);
    await page.goto("/");
    await page.getByRole("link", { name: /^log in$/i }).first().click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("pricing monthly/yearly toggle changes the price", async ({ page }) => {
    await page.goto("/#pricing");
    const pricing = page.locator("#pricing");
    await expect(pricing).toBeVisible();
    const monthly = pricing.getByRole("tab", { name: /monthly/i });
    const yearly = pricing.getByRole("tab", { name: /yearly/i });
    await expect(monthly).toBeVisible();
    await yearly.click();
    await expect(yearly).toHaveAttribute("aria-selected", "true");
    await monthly.click();
    await expect(monthly).toHaveAttribute("aria-selected", "true");
  });

  test("FAQ items expand", async ({ page }) => {
    await page.goto("/");
    const faqButton = page.getByRole("button", { expanded: false }).last();
    if (await faqButton.count()) {
      await faqButton.click();
      await expect(page.getByRole("button", { expanded: true }).first()).toBeVisible();
    }
  });
});
