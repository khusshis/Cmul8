import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { makeSupabase } from "./supabaseMock";

process.env.RAZORPAY_MOCK = "1";
vi.stubEnv("NODE_ENV", "development");
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";

const supabaseRef: any = { current: makeSupabase() };
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => supabaseRef.current) }));

// Spy on the billing helpers the routes use, while keeping the real ones.
const billing = await vi.importActual<typeof import("@/lib/billing/server")>("@/lib/billing/server");
const getBilling = vi.fn();
const syncSubscription = vi.fn();
// webhook_events dedupe state. `seen` = the row a SELECT finds (null = not processed yet).
const webhook = { seen: null as null | { id: string }, inserts: [] as string[], insertError: null as any };
vi.mock("@/lib/billing/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/billing/server")>("@/lib/billing/server");
  return { ...actual, getBilling: (...a: any[]) => getBilling(...a), syncSubscription: (...a: any[]) => syncSubscription(...a), adminClient: () => {
      // Chain is thenable so both `await ...eq()` (subscribe) and `...eq().maybeSingle()` (webhook) work.
      const chain: any = {
        _table: "",
        from: (t: string) => { chain._table = t; return chain; },
        update: () => chain, delete: () => chain, select: () => chain, eq: () => chain,
        maybeSingle: async () => (chain._table === "webhook_events" ? { data: webhook.seen, error: null } : { data: null, error: null }),
        insert: async (row: any) => {
          if (chain._table === "webhook_events") { webhook.inserts.push(row.id); return { error: webhook.insertError }; }
          return { error: null };
        },
        then: (res: any, rej: any) => Promise.resolve({ error: null }).then(res, rej),
      };
      return chain;
    } };
});

const user = { id: "u1", email: "a@example.com" };
const reqJson = (url: string, body?: any) => new Request(url, { method: "POST", ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}) });

beforeEach(() => { supabaseRef.current = makeSupabase({ user }); getBilling.mockReset(); syncSubscription.mockReset(); webhook.seen = null; webhook.inserts = []; webhook.insertError = null; });
afterEach(() => vi.clearAllMocks());

describe("POST /api/billing/subscribe", () => {
  it("401 unauthenticated", async () => {
    supabaseRef.current = makeSupabase({ user: null });
    const { POST } = await import("@/app/api/billing/subscribe/route");
    expect((await POST(reqJson("http://x/s", { interval: "monthly" }))).status).toBe(401);
  });
  it("400 on an invalid interval", async () => {
    getBilling.mockResolvedValue({ plan: "free", trial_used: false });
    const { POST } = await import("@/app/api/billing/subscribe/route");
    expect((await POST(reqJson("http://x/s", { interval: "weekly" }))).status).toBe(400);
  });
  it("409 when already on a paid plan", async () => {
    getBilling.mockResolvedValue({ plan: "pro", status: "active" });
    const { POST } = await import("@/app/api/billing/subscribe/route");
    expect((await POST(reqJson("http://x/s", { interval: "monthly" }))).status).toBe(409);
  });
  it("creates a subscription for a free user", async () => {
    getBilling.mockResolvedValue({ plan: "free", trial_used: false });
    const { POST } = await import("@/app/api/billing/subscribe/route");
    const res = await POST(reqJson("http://x/s", { interval: "monthly" }));
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.subscriptionId).toMatch(/^sub_mock_/);
    expect(b.mock).toBe(true);
  });
});

describe("POST /api/billing/verify", () => {
  it("401 unauthenticated", async () => {
    supabaseRef.current = makeSupabase({ user: null });
    const { POST } = await import("@/app/api/billing/verify/route");
    expect((await POST(reqJson("http://x/v", { razorpay_payment_id: "p", razorpay_subscription_id: "s", razorpay_signature: "x" }))).status).toBe(401);
  });
  it("400 when fields are missing", async () => {
    const { POST } = await import("@/app/api/billing/verify/route");
    expect((await POST(reqJson("http://x/v", {}))).status).toBe(400);
  });
  it("mock mode: syncs and returns billing", async () => {
    // create a real mock subscription first so razorpay(GET) finds it
    const created = await billing.razorpay("/subscriptions", { plan_id: billing.planIdFor("monthly"), notes: { user_id: "u1" } });
    getBilling.mockResolvedValue({ plan: "pro", status: "active" });
    const { POST } = await import("@/app/api/billing/verify/route");
    const res = await POST(reqJson("http://x/v", { razorpay_payment_id: "pay_mock", razorpay_subscription_id: created.id, razorpay_signature: "mock" }));
    expect(res.status).toBe(200);
    expect(syncSubscription).toHaveBeenCalled();
  });
});

describe("POST /api/billing/webhook", () => {
  const secret = "whsec";
  beforeEach(() => { process.env.RAZORPAY_WEBHOOK_SECRET = secret; });
  const sign = (raw: string) => crypto.createHmac("sha256", secret).update(raw).digest("hex");

  it("400 on a bad signature (and no sync)", async () => {
    const { POST } = await import("@/app/api/billing/webhook/route");
    const raw = JSON.stringify({ payload: { subscription: { entity: { id: "sub_x" } } } });
    const res = await POST(new Request("http://x/w", { method: "POST", body: raw, headers: { "x-razorpay-signature": "deadbeef" } }));
    expect(res.status).toBe(400);
    expect(syncSubscription).not.toHaveBeenCalled();
  });

  it("accepts a correctly signed subscription event and syncs it", async () => {
    const { POST } = await import("@/app/api/billing/webhook/route");
    const raw = JSON.stringify({ payload: { subscription: { entity: { id: "sub_x", status: "active", notes: { user_id: "u1" } } } } });
    const res = await POST(new Request("http://x/w", { method: "POST", body: raw, headers: { "x-razorpay-signature": sign(raw) } }));
    expect(res.status).toBe(200);
    expect(syncSubscription).toHaveBeenCalledWith(expect.anything(), "u1", expect.objectContaining({ id: "sub_x" }));
  });

  // Replay: a correctly-signed but already-processed event is idempotent — syncSubscription
  // upserts the same row, so a duplicate POST must still return 200 and not error.
  it("is idempotent on replay of the same event", async () => {
    const { POST } = await import("@/app/api/billing/webhook/route");
    const raw = JSON.stringify({ payload: { subscription: { entity: { id: "sub_x", status: "active", notes: { user_id: "u1" } } } } });
    const mk = () => new Request("http://x/w", { method: "POST", body: raw, headers: { "x-razorpay-signature": sign(raw) } });
    expect((await POST(mk())).status).toBe(200);
    expect((await POST(mk())).status).toBe(200);
  });

  it("dedupes when the event id is already in webhook_events (SELECT finds a row), no re-sync", async () => {
    webhook.seen = { id: "evt_1" }; // already processed
    const { POST } = await import("@/app/api/billing/webhook/route");
    const raw = JSON.stringify({ payload: { subscription: { entity: { id: "sub_x", status: "active", notes: { user_id: "u1" } } } } });
    const res = await POST(new Request("http://x/w", { method: "POST", body: raw, headers: { "x-razorpay-signature": sign(raw), "x-razorpay-event-id": "evt_1" } }));
    expect(res.status).toBe(200);
    expect((await res.json()).duplicate).toBe(true);
    expect(syncSubscription).not.toHaveBeenCalled();
    expect(webhook.inserts).toEqual([]); // nothing inserted on a duplicate
  });

  it("records the event id only AFTER a successful sync", async () => {
    const { POST } = await import("@/app/api/billing/webhook/route");
    const raw = JSON.stringify({ payload: { subscription: { entity: { id: "sub_x", status: "active", notes: { user_id: "u1" } } } } });
    const res = await POST(new Request("http://x/w", { method: "POST", body: raw, headers: { "x-razorpay-signature": sign(raw), "x-razorpay-event-id": "evt_ok" } }));
    expect(res.status).toBe(200);
    expect(syncSubscription).toHaveBeenCalled();
    expect(webhook.inserts).toEqual(["evt_ok"]);
  });

  it("on processing failure leaves NO row, so Razorpay's retry can process it", async () => {
    syncSubscription.mockRejectedValueOnce(new Error("downstream down"));
    const { POST } = await import("@/app/api/billing/webhook/route");
    const raw = JSON.stringify({ payload: { subscription: { entity: { id: "sub_x", status: "active", notes: { user_id: "u1" } } } } });
    const res = await POST(new Request("http://x/w", { method: "POST", body: raw, headers: { "x-razorpay-signature": sign(raw), "x-razorpay-event-id": "evt_fail" } }));
    expect(res.status).toBe(500);
    expect(webhook.inserts).toEqual([]); // not recorded -> retry will reprocess
  });

  it("ignores an event older than 24h (2xx so Razorpay stops retrying)", async () => {
    const { POST } = await import("@/app/api/billing/webhook/route");
    const stale = Math.floor(Date.now() / 1000) - 25 * 3600;
    const raw = JSON.stringify({ created_at: stale, payload: { subscription: { entity: { id: "sub_x", status: "active", notes: { user_id: "u1" } } } } });
    const res = await POST(new Request("http://x/w", { method: "POST", body: raw, headers: { "x-razorpay-signature": sign(raw) } }));
    expect(res.status).toBe(200);
    expect((await res.json()).ignored).toBe("stale");
    expect(syncSubscription).not.toHaveBeenCalled();
  });

  it("400 on a signed-but-unparseable body", async () => {
    const { POST } = await import("@/app/api/billing/webhook/route");
    const raw = "not json";
    const res = await POST(new Request("http://x/w", { method: "POST", body: raw, headers: { "x-razorpay-signature": sign(raw) } }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/billing/cancel", () => {
  it("401 unauthenticated", async () => {
    supabaseRef.current = makeSupabase({ user: null });
    const { POST } = await import("@/app/api/billing/cancel/route");
    expect((await POST()).status).toBe(401);
  });
  it("400 when there is no active subscription", async () => {
    getBilling.mockResolvedValue({ plan: "free" });
    const { POST } = await import("@/app/api/billing/cancel/route");
    expect((await POST()).status).toBe(400);
  });
  it("succeeds and downgrades when Razorpay no longer knows the subscription", async () => {
    getBilling.mockResolvedValue({ plan: "pro", status: "active", razorpay_subscription_id: "sub_mock_gone" });
    const { POST } = await import("@/app/api/billing/cancel/route");
    expect((await POST()).status).toBe(200);
    expect(syncSubscription).toHaveBeenCalledWith(expect.anything(), "u1", expect.objectContaining({ status: "cancelled" }));
  });
});
