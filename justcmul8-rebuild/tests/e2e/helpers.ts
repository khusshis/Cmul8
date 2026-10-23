import { Page, expect } from "@playwright/test";

/** Logs a given user in through the UI in a fresh context's page. */
export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 20_000 });
}

/** Mocks every /api/ai/* route so specs never spend real Gemini quota. */
export async function stubAi(page: Page) {
  await page.route("**/api/ai/chat", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        text: "Here is my analysis. ![diagram](https://evil.example/x.png) The teller is the bottleneck.",
        actionType: "ADD_NODES",
        ops: { actionType: "ADD_NODES", upsertNodes: [{ id: "e2e_server", nodeType: "resource", label: "E2E Server", params: { capacity: 1, serviceTimeMean: 2 } }], addEdges: [], deleteNodeIds: [], deleteEdgeIds: [] },
        warnings: [],
        modifiedNodeIds: ["e2e_server"],
        suggestedQuestions: ["What if I add a second server?"],
        model: "mock",
      }),
    })
  );
  await page.route("**/api/ai/optimize", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ recommendations: [{ title: "Add capacity", action: "Add a server", impact: "-40% wait", confidence: 90 }] }) })
  );
  await page.route("**/api/ai/generate", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ nodes: [], edges: [], warnings: [] }) })
  );
}

/** Creates a uniquely-named e2e project via the dashboard UI, returns its name + id. */
export async function createProject(page: Page, type = "People & Service Lines") {
  const name = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /new simulation/i }).first().click().catch(async () => {
    await page.getByText(/new simulation/i).first().click();
  });
  await page.getByPlaceholder(/bank teller optimisation/i).fill(name);
  await page.getByRole("button", { name: /create|build/i }).last().click();
  await page.waitForURL(/\/dashboard\/project\/[0-9a-f-]+/, { timeout: 20_000 });
  const id = page.url().split("/project/")[1];
  return { name, id };
}

/**
 * Opens a FRESH e2e project (starting-template picker showing) so no spec sees another
 * spec's edits. Creating costs 40 credits; the e2e accounts are topped up, and
 * tests/e2e/cleanup.ts deletes every e2e-* project before and after each run.
 */
export async function openProject(page: Page): Promise<string> {
  return (await createProject(page)).id;
}

/** Deletes any e2e-* projects from the dashboard so test runs don't accumulate data. */
export async function cleanupE2eProjects(page: Page) {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle").catch(() => {});
  // Best-effort: iterate project cards whose name starts with "e2e-".
  const cards = page.locator('a[aria-label^="Open e2e-"]');
  const count = await cards.count().catch(() => 0);
  for (let i = 0; i < count; i++) {
    const del = page.locator('[aria-label^="Delete e2e-"]').first();
    if (await del.count()) {
      await del.click().catch(() => {});
      await page.getByRole("button", { name: /^delete$/i }).click().catch(() => {});
      await page.waitForTimeout(400);
    }
  }
}

/**
 * An empty project opens with the "Choose a Starting Template" modal over the canvas,
 * which blocks the toolbar. Pick Bank Tellers inside the modal and wait for it to close.
 * No-op when the canvas already has blocks (modal not shown).
 */
export async function ensureBankTemplate(page: Page) {
  const heading = page.getByText("Choose a Starting Template");
  const shown = await heading.waitFor({ state: "visible", timeout: 8_000 }).then(() => true).catch(() => false);
  if (!shown) return;
  await page.getByText("Bank Tellers", { exact: true }).click();
  await expect(heading).toBeHidden({ timeout: 15_000 });
}
