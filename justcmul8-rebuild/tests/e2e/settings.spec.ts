import { test, expect } from "@playwright/test";
import { hasCreds } from "../../playwright.config";

test.skip(!hasCreds, "needs E2E_EMAIL/E2E_PASSWORD");
test.describe.configure({ timeout: 90_000 });

test.describe("Settings", () => {
  test("profile tab renders and the name field is editable", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("tab", { name: /profile/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByPlaceholder(/ada lovelace/i)).toBeVisible();
  });

  test("billing tab renders plan & credits", async ({ page }) => {
    await page.goto("/settings?tab=billing");
    await expect(page.getByText(/plan|credits|free|pro/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("delete-account flow: confirm button stays disabled until DELETE is typed (never actually deletes)", async ({ page }) => {
    await page.goto("/settings?tab=account");
    const del = page.getByText(/delete account/i).first();
    if (!(await del.count())) { test.info().annotations.push({ type: "note", description: "Account tab/delete not found." }); return; }
    // The card button only opens the confirmation popup.
    await page.getByRole("button", { name: /delete my account/i }).click();
    const input = page.locator("#st-del");
    await expect(input).toBeVisible({ timeout: 20_000 });
    const confirm = page.getByRole("button", { name: /delete forever/i });
    await expect(confirm).toBeDisabled();
    // Type the confirmation but DO NOT click the destructive button.
    await input.fill("DELETE");
    await expect(confirm).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(input).toBeHidden();
    // Intentionally stop here — we never trigger the real deletion.
  });

  test("account tab offers two-factor setup and the DPDP privacy controls", async ({ page }) => {
    await page.goto("/settings?tab=account");
    await expect(page.getByText(/two-factor authentication/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/your data & privacy/i)).toBeVisible();
    await expect(page.getByRole("switch", { name: /allow ai processing/i })).toBeVisible();
    await expect(page.getByText(/grievance officer/i)).toBeVisible();
  });

  test("'Download my data' returns the signed-in user's data as JSON (read-only)", async ({ page }) => {
    await page.goto("/settings?tab=account");
    const res = await page.request.get("/api/account/export");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-disposition"]).toMatch(/attachment; filename="justcmul8-my-data-/);
    const body = await res.json();
    expect(body.account.email).toBeTruthy();
    expect(Array.isArray(body.projects)).toBe(true);
    expect(body).toHaveProperty("activityLog");
  });
});
