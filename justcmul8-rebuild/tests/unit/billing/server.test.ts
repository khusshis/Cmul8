import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";

// server.ts imports @/lib/supabase/server (next/headers) at module load; stub it so the
// pure helpers can be imported in a node test.
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

process.env.RAZORPAY_MOCK = "1";
vi.stubEnv("NODE_ENV", "development");
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";

const { hmacMatches, razorpay, planIdFor, syncSubscription, MOCK_RAZORPAY } = await import("@/lib/billing/server");

describe("hmacMatches (webhook / checkout signature)", () => {
  const secret = "whsec";
  const sign = (p: string) => crypto.createHmac("sha256", secret).update(p).digest("hex");
  it("accepts a correct signature", () => {
    expect(hmacMatches("payload", sign("payload"), secret)).toBe(true);
  });
  it("rejects a wrong or missing signature and a missing secret", () => {
    expect(hmacMatches("payload", sign("other"), secret)).toBe(false);
    expect(hmacMatches("payload", null, secret)).toBe(false);
    expect(hmacMatches("payload", sign("payload"), undefined)).toBe(false);
  });
  it("is length-safe against a short signature", () => {
    expect(hmacMatches("payload", "ab", secret)).toBe(false);
  });
});

describe("mock Razorpay REST", () => {
  it("MOCK_RAZORPAY is on in dev", () => expect(MOCK_RAZORPAY).toBe(true));
  it("creates then fetches a subscription", async () => {
    const created = await razorpay("/subscriptions", { plan_id: planIdFor("monthly"), notes: { user_id: "u1" } });
    expect(created.id).toMatch(/^sub_mock_/);
    const fetched = await razorpay(`/subscriptions/${created.id}`);
    expect(["active", "authenticated"]).toContain(fetched.status);
    expect(fetched.notes?.user_id).toBe("u1");
  });
  it("cancel immediately flips status to cancelled", async () => {
    const s = await razorpay("/subscriptions", { plan_id: planIdFor("yearly"), notes: {} });
    const c = await razorpay(`/subscriptions/${s.id}/cancel`, { cancel_at_cycle_end: 0 });
    expect(c.status).toBe("cancelled");
  });
});

describe("syncSubscription", () => {
  function fakeAdmin(existingRow: any = null) {
    const captured: any = {};
    const api = {
      from() { return api; },
      select() { return api; },
      eq() { return api; },
      maybeSingle: async () => ({ data: existingRow }),
      upsert: async (row: any) => { captured.row = row; return { error: null }; },
    };
    return { api, captured };
  }

  it("upgrades a free user to pro with pro credits", async () => {
    const { api, captured } = fakeAdmin({ plan: "free", credits: 20, razorpay_subscription_id: null });
    await syncSubscription(api as any, "u1", { id: "sub_1", plan_id: planIdFor("monthly"), status: "active", start_at: null, current_end: 1_800_000_000, notes: { user_id: "u1" } });
    expect(captured.row.plan).toBe("pro");
    expect(captured.row.status).toBe("active");
    expect(captured.row.credits).toBe(500);
  });

  it("marks a trial with trial_used + trial_ends_at", async () => {
    const { captured, api } = fakeAdmin({ plan: "free", credits: 100 });
    const future = Math.floor(Date.now() / 1000) + 10_000;
    await syncSubscription(api as any, "u1", { id: "sub_2", plan_id: planIdFor("monthly"), status: "authenticated", start_at: future, current_end: null, notes: {} });
    expect(captured.row.status).toBe("trialing");
    expect(captured.row.trial_used).toBe(true);
    expect(captured.row.trial_ends_at).toBeTruthy();
  });

  it("downgrade to free caps credits and clears cancel flag", async () => {
    const { captured, api } = fakeAdmin({ plan: "pro", credits: 480 });
    await syncSubscription(api as any, "u1", { id: "sub_3", plan_id: planIdFor("monthly"), status: "cancelled", start_at: null, current_end: null, notes: {} });
    expect(captured.row.plan).toBe("free");
    expect(captured.row.credits).toBe(100);
    expect(captured.row.cancel_at_period_end).toBe(false);
  });

  it("ignores events for a superseded subscription id", async () => {
    const { captured, api } = fakeAdmin({ plan: "pro", credits: 500, razorpay_subscription_id: "sub_current" });
    await syncSubscription(api as any, "u1", { id: "sub_OLD", plan_id: planIdFor("monthly"), status: "active", start_at: null, current_end: 1, notes: {} });
    expect(captured.row).toBeUndefined();
  });

  it("skips a not-yet-finished checkout (status created)", async () => {
    const { captured, api } = fakeAdmin();
    await syncSubscription(api as any, "u1", { id: "sub_4", plan_id: planIdFor("monthly"), status: "created", start_at: null, current_end: null, notes: {} });
    expect(captured.row).toBeUndefined();
  });
});
