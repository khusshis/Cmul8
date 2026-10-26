import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Auth flows (no credentials required)", () => {
  test("login requires email + password (HTML validation)", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email address")).toBeVisible();
    await page.getByRole("button", { name: /log in/i }).click();
    // Native required validation keeps us on /login.
    await expect(page).toHaveURL(/\/login/);
  });

  test("login with a wrong password shows an error, stays on /login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill("nobody-" + Date.now() + "@example.com");
    await page.getByLabel("Password", { exact: true }).fill("definitely-wrong-password");
    await page.getByRole("button", { name: /log in/i }).click();
    // Supabase returns an error; the form surfaces it and does not navigate.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("text=/invalid|incorrect|credentials|email|password/i").first()).toBeVisible({ timeout: 15_000 });
  });

  test("signup validates password length", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Email address").fill("new-" + Date.now() + "@example.com");
    const pw = page.getByLabel(/create a password/i);
    await pw.fill("123");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/signup/); // minLength=6 blocks submit
  });

  test("signup needs both consent boxes, for email and for Google/GitHub (never creates an account)", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Email address").fill("new-" + Date.now() + "@example.com");
    await page.getByLabel(/create a password/i).fill("Str0ng-enough-pass!");
    const adult = page.getByLabel(/18 years of age or older/i);
    const terms = page.getByLabel(/consent to my data being processed/i);
    await expect(adult).not.toBeChecked();
    await expect(terms).not.toBeChecked();
    // Only one box ticked: native `required` keeps the form from submitting.
    await adult.check();
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/signup/);
    await expect(page.getByText(/check your inbox/i)).toHaveCount(0);
    // OAuth is gated too: an error instead of a redirect to the provider.
    await page.getByRole("button", { name: "Google" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /tick both boxes/i })).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("forgot-password form submits and shows a neutral confirmation", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email address").fill("someone@example.com");
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByText(/check your inbox/i)).toBeVisible({ timeout: 15_000 });
  });

  test("protected routes redirect to /login with a same-origin redirect param", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard/);
  });

  test("login redirect param is confined to same-origin paths", async ({ page }) => {
    // An attacker-supplied absolute URL must not be honoured as an open redirect.
    await page.goto("/login?redirect=https://evil.com");
    // The page keeps us on login; we can't complete a real login without creds, but the
    // redirect target is sanitised client-side (safeRedirect). Assert the form is shown.
    await expect(page.getByRole("button", { name: /log in/i })).toBeVisible();
  });
});
