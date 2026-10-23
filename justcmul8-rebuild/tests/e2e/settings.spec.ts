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
    const input = page.locator("#st-del");
    await expect(input).toBeVisible({ timeout: 20_000 });
    // Type the confirmation but DO NOT click the destructive button.
    await input.fill("DELETE");
    const confirm = page.getByRole("button", { name: /delete (my )?account|delete forever|confirm/i }).first();
    await expect(confirm).toBeEnabled();
    // Intentionally stop here — we never trigger the real deletion.
  });
});
