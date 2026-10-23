import { test, expect, type Page } from "@playwright/test";
import { hasCreds, hasSecondUser } from "../../playwright.config";
import { createProject, loginAs, ensureBankTemplate } from "./helpers";

test.skip(!hasCreds || !hasSecondUser, "needs E2E_EMAIL(_2)/E2E_PASSWORD(_2) for two real users");
test.describe.configure({ timeout: 240_000 });

const B_EMAIL = () => process.env.E2E_EMAIL_2!;
const nodes = (p: Page) => p.locator(".react-flow__node");
const addFromPalette = (p: Page) => p.locator('[draggable="true"]').first().click();

async function openShare(p: Page) {
  await p.getByRole("button", { name: /share/i }).first().click();
  await expect(p.getByText("Share & Export")).toBeVisible();
}
async function closeShare(p: Page) {
  await p.keyboard.press("Escape");
  await expect(p.getByText("Share & Export")).toBeHidden();
}

// The owner (e2e-a) must be on Pro/trial: inviting is a paid feature.
test.describe("Realtime collaboration (two users)", () => {
  test("invite → presence → live edits both ways → persisted → viewer is read-only → revoke", async ({ browser }) => {
    const aCtx = await browser.newContext({ storageState: "tests/e2e/.auth/user.json" });
    const a = await aCtx.newPage();
    const { id, name } = await createProject(a);
    await ensureBankTemplate(a);
    await expect(nodes(a).first()).toBeVisible({ timeout: 20_000 });

    // 1. Invite B as editor.
    await openShare(a);
    await a.getByLabel("Email address to invite").fill(B_EMAIL());
    await a.getByLabel("Role for new person").selectOption("editor");
    await a.getByRole("button", { name: /invite/i }).click();
    await expect(a.getByText(/invite emailed|access granted/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(a.getByLabel(`Remove ${B_EMAIL()}`)).toBeVisible();
    await closeShare(a);

    // 2. B opens the project and stays on it (no "no access" bounce).
    const bCtx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const b = await bCtx.newPage();
    await loginAs(b, B_EMAIL(), process.env.E2E_PASSWORD_2!);
    await b.goto(`/dashboard/project/${id}`);
    await expect(nodes(b).first()).toBeVisible({ timeout: 30_000 });
    await expect(b).toHaveURL(new RegExp(`/project/${id}`));
    const base = await nodes(a).count();
    await expect(nodes(b)).toHaveCount(base, { timeout: 15_000 });

    // 3. Presence: each side shows the other's avatar.
    await expect(a.locator("div.rounded-full[title]").first()).toBeVisible({ timeout: 20_000 });
    await expect(b.locator("div.rounded-full[title]").first()).toBeVisible({ timeout: 20_000 });

    // 4. Live edits propagate both ways.
    await addFromPalette(b);
    await expect(nodes(b)).toHaveCount(base + 1);
    await expect(nodes(a)).toHaveCount(base + 1, { timeout: 15_000 });
    await addFromPalette(a);
    await expect(nodes(b)).toHaveCount(base + 2, { timeout: 15_000 });

    // 5. Edits were saved, not just broadcast.
    await a.waitForTimeout(3000); // autosave debounce
    await a.reload();
    await expect(nodes(a)).toHaveCount(base + 2, { timeout: 30_000 });

    // 6. Downgrade B to viewer: B sees "View only" and can no longer change the graph.
    await openShare(a);
    await a.getByLabel(`Role for ${B_EMAIL()}`).selectOption("viewer");
    await closeShare(a);
    await expect(b.getByText(/view only/i).first()).toBeVisible({ timeout: 20_000 });
    await b.locator('[draggable="true"]').first().click({ timeout: 3000 }).catch(() => {}); // palette may be hidden for viewers
    await b.waitForTimeout(3000);
    await expect(nodes(b)).toHaveCount(base + 2);
    await expect(nodes(a)).toHaveCount(base + 2);

    // 7. Revoke: B loses access on the next load.
    await openShare(a);
    await a.getByLabel(`Remove ${B_EMAIL()}`).click();
    await expect(a.getByLabel(`Remove ${B_EMAIL()}`)).toHaveCount(0, { timeout: 15_000 });
    await closeShare(a);
    await b.reload();
    await expect(b).toHaveURL(/\/dashboard\/?(\?.*)?$/, { timeout: 30_000 });

    await bCtx.close();
    // Clean up the project this test created.
    await a.goto("/dashboard");
    await a.getByLabel(`Delete ${name}`).click();
    await a.getByRole("button", { name: /^delete$/i }).click();
    await aCtx.close();
  });
});
