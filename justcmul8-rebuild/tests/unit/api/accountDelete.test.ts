import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const supabaseRef: any = { current: null };
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => supabaseRef.current) }));
// rateLimit: allow by default (tests that need a limit override it).
const rateLimit = vi.fn<(...a: any[]) => Promise<any>>(async () => null);
vi.mock("@/lib/supabase/rateLimit", () => ({ rateLimit: (...a: any[]) => rateLimit(...a) }));
const razorpay = vi.fn();
const deleteUser = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/billing/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/billing/server")>("@/lib/billing/server");
  return {
    ...actual,
    razorpay: (...a: any[]) => razorpay(...a),
    adminClient: () => ({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { plan: "free", razorpay_subscription_id: null } }) }) }) }),
      auth: { admin: { deleteUser } },
    }),
  };
});

function supabaseWith(lastSignInSecondsAgo: number) {
  const amrTs = Math.floor(Date.now() / 1000) - lastSignInSecondsAgo;
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "u1", email: "a@x.com", last_sign_in_at: new Date(amrTs * 1000).toISOString() } } })),
      getClaims: vi.fn(async () => ({ data: { claims: { amr: [{ method: "password", timestamp: amrTs }] } } })),
    },
  };
}

const { POST } = await import("@/app/api/account/delete/route");

beforeEach(() => { rateLimit.mockReset().mockResolvedValue(null); razorpay.mockReset(); deleteUser.mockReset().mockResolvedValue({ error: null }); });
afterEach(() => vi.clearAllMocks());

describe("POST /api/account/delete", () => {
  it("401 unauthenticated", async () => {
    supabaseRef.current = { auth: { getUser: async () => ({ data: { user: null } }) } };
    expect((await POST()).status).toBe(401);
  });

  it("403 REAUTH_REQUIRED when last sign-in was > 10 minutes ago", async () => {
    supabaseRef.current = supabaseWith(11 * 60);
    const res = await POST();
    expect(res.status).toBe(403);
    expect((await res.json()).errorCode).toBe("REAUTH_REQUIRED");
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("deletes the account when signed in recently", async () => {
    supabaseRef.current = supabaseWith(60);
    const res = await POST();
    expect(res.status).toBe(200);
    expect(deleteUser).toHaveBeenCalledWith("u1");
  });

  it("surfaces the rate-limit 429", async () => {
    const { NextResponse } = await import("next/server");
    rateLimit.mockResolvedValue(NextResponse.json({ error: "slow" }, { status: 429 }));
    supabaseRef.current = supabaseWith(60);
    expect((await POST()).status).toBe(429);
  });
});
