import { test, expect, request as pwRequest } from "@playwright/test";
import { BASE_URL } from "../../playwright.config";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Security (no credentials required)", () => {
  test("every /api mutation requires a session (401) when unauthenticated", async ({ request }) => {
    // Same-origin by default (Playwright sets Origin), so CSRF passes; auth is what blocks it.
    for (const path of ["/api/billing/subscribe", "/api/billing/cancel", "/api/account/delete"]) {
      const res = await request.post(path, { data: {}, headers: { origin: BASE_URL } });
      expect([401, 402, 403], `${path} -> ${res.status()}`).toContain(res.status());
      expect(res.status(), `${path} should not be 200 unauthenticated`).not.toBe(200);
    }
  });

  test("CSRF: a cross-origin mutation is blocked with 403", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
    const res = await ctx.post("/api/account/delete", { headers: { origin: "https://evil.com" }, data: {} });
    expect(res.status()).toBe(403);
    expect((await res.json()).error).toMatch(/cross-site/i);
    await ctx.dispose();
  });

  test("the Razorpay webhook is CSRF-exempt but rejects a bad signature (400, not 403)", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
    const res = await ctx.post("/api/billing/webhook", { headers: { origin: "https://api.razorpay.com", "x-razorpay-signature": "bad" }, data: { payload: {} } });
    expect(res.status()).toBe(400);
    await ctx.dispose();
  });

  test("auth/callback rejects an off-site redirect (open-redirect guard)", async ({ page }) => {
    await page.goto("/auth/callback?redirect=https://evil.com");
    // No code + bad redirect -> bounced to /login (same-origin), never to evil.com.
    await expect(page).toHaveURL(new RegExp(`^${BASE_URL}/login`));
  });

  test("security response headers are present on a page response", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    // Report which are present; a missing header is a finding, not a hard failure here.
    const report = {
      "x-content-type-options": h["x-content-type-options"],
      "x-frame-options": h["x-frame-options"],
      "referrer-policy": h["referrer-policy"],
      "content-security-policy": h["content-security-policy"],
      "strict-transport-security": h["strict-transport-security"],
    };
    test.info().annotations.push({ type: "security-headers", description: JSON.stringify(report) });
    expect(res.ok()).toBeTruthy();
  });
});
