import { test as setup, expect } from "@playwright/test";
import { hasCreds } from "../../playwright.config";

const authFile = "tests/e2e/.auth/user.json";

// Logs in once as user A and saves the session for the authenticated specs. When no
// credentials are configured it writes an empty state so unauthenticated specs still run.
setup("authenticate", async ({ page }) => {
  if (!hasCreds) {
    await page.context().storageState({ path: authFile });
    setup.info().annotations.push({ type: "skip", description: "No E2E_EMAIL/E2E_PASSWORD; saved empty session." });
    return;
  }
  await page.goto("/login");
  await page.getByLabel("Email address").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: /log in/i }).click();
  // Either straight to dashboard, or onboarding if the account hasn't finished it.
  await page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 20_000 });
  await expect(page).not.toHaveURL(/\/login/);
  await page.context().storageState({ path: authFile });
});
