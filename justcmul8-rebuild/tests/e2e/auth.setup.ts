import { test as setup, expect } from "@playwright/test";
import { hasCreds, BASE_URL } from "../../playwright.config";
import { signInWithoutCaptcha } from "./session";

const authFile = "tests/e2e/.auth/user.json";

// Signs in once as user A and saves the session for the authenticated specs. When no
// credentials are configured it writes an empty state so unauthenticated specs still run.
// The login form is behind Turnstile, which blocks automated browsers, so the session is
// created through the admin API (see session.ts); the login form itself is covered in auth.spec.
setup("authenticate", async ({ page }) => {
  if (!hasCreds) {
    await page.context().storageState({ path: authFile });
    setup.info().annotations.push({ type: "skip", description: "No E2E_EMAIL/E2E_PASSWORD; saved empty session." });
    return;
  }
  await signInWithoutCaptcha(page.context(), process.env.E2E_EMAIL!, BASE_URL);
  await page.goto("/dashboard");
  // Either the dashboard, or onboarding if the account hasn't finished it.
  await page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 20_000 });
  await expect(page).not.toHaveURL(/\/login/);
  await page.context().storageState({ path: authFile });
});
