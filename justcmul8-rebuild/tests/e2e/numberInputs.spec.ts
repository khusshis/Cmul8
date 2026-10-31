import { test, expect } from "@playwright/test";
import { hasCreds } from "../../playwright.config";
import { openProject, ensureBankTemplate } from "./helpers";

test.skip(!hasCreds, "needs E2E_EMAIL/E2E_PASSWORD");

// Number boxes bound straight to the saved value couldn't be cleared and retyped:
// capacity "2" snapped back with "Capacity must be a whole number", and the run-length box refilled "1".
test("number boxes can be cleared and retyped", async ({ page }) => {
  await openProject(page);
  await ensureBankTemplate(page);

  const duration = page.getByTitle("Simulation Duration");
  await duration.click();
  await duration.press("Control+a");
  await duration.press("Backspace");
  await expect(duration).toHaveValue("");
  await duration.pressSequentially("30");
  await expect(duration).toHaveValue("30");
  await duration.blur();
  await expect(duration).toHaveValue("30");

  await page.locator(".react-flow__node", { hasText: "Teller 1" }).first().click();
  const staff = page.locator("label", { hasText: "Number of Staff" }).locator("..").locator("input");
  await expect(staff).toHaveValue("1");
  await staff.click();
  await staff.press("Control+a");
  await staff.press("Backspace");
  await expect(staff).toHaveValue("");
  await staff.pressSequentially("5");
  await expect(staff).toHaveValue("5");
  await staff.blur();
  await expect(staff).toHaveValue("5");
  await expect(page.getByText("Invalid value")).toHaveCount(0);

  // Leaving it empty snaps back to the saved value instead of saving 0.
  await staff.click();
  await staff.press("Control+a");
  await staff.press("Backspace");
  await staff.blur();
  await expect(staff).toHaveValue("5");
});
