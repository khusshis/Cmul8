import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { CREDIT_COSTS, PLAN_CREDITS, TRIAL_DAYS, creditErrorMessage, razorpayToPlan, type Billing, type CreditAction, type Interval } from "./plans";

export const adminClient = () =>
  createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** Fake Razorpay for local testing. Never on in a production build (`next start`, deploys). */
export const MOCK_RAZORPAY = process.env.RAZORPAY_MOCK === "1" && process.env.NODE_ENV !== "production";

export const planIdFor = (interval: Interval) =>
  MOCK_RAZORPAY ? `plan_mock_${interval}`
  : interval === "yearly" ? process.env.RAZORPAY_PLAN_PRO_YEARLY! : process.env.RAZORPAY_PLAN_PRO_MONTHLY!;

/** Trial length in seconds; RAZORPAY_MOCK_TRIAL_SECONDS shortens it in mock mode to test trial → paid. */
export const trialSeconds = () =>
  (MOCK_RAZORPAY && Number(process.env.RAZORPAY_MOCK_TRIAL_SECONDS)) || TRIAL_DAYS * 86400;

// ─── Razorpay REST (no SDK needed for four calls) ─────────────────────────────
export type RzpSubscription = {
  id: string;
  plan_id: string;
  status: "created" | "authenticated" | "active" | "pending" | "halted" | "cancelled" | "completed" | "expired" | "paused";
  start_at: number | null;
  current_end: number | null;
  notes?: Record<string, string> | null;
};

export async function razorpay<T = RzpSubscription>(path: string, body?: Record<string, unknown>): Promise<T> {
  if (MOCK_RAZORPAY) return mockRazorpay(path, body) as T;
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.description || `Razorpay error ${res.status}`);
  return data as T;
}

// ─── Mock: the same three subscription calls, kept in memory (survives dev hot reloads) ─
type MockSub = RzpSubscription & { cancelled?: boolean };
const mockSubs: Map<string, MockSub> = ((globalThis as { __mockRzp?: Map<string, MockSub> }).__mockRzp ??= new Map());

function mockRazorpay(path: string, body?: Record<string, unknown>): RzpSubscription {
  const now = Math.floor(Date.now() / 1000);
  if (path === "/subscriptions" && body) {
    const sub: MockSub = {
      id: `sub_mock_${crypto.randomBytes(6).toString("hex")}`,
      plan_id: String(body.plan_id),
      status: "created",
      start_at: (body.start_at as number) ?? null,
      current_end: null,
      notes: body.notes as Record<string, string>,
    };
    mockSubs.set(sub.id, sub);
    return sub;
  }
  const [, , id, action] = path.split("/"); // /subscriptions/:id[/cancel]
  const sub = mockSubs.get(id);
  if (!sub) throw new Error("Mock Razorpay: unknown subscription (dev server restarted?)");
  if (action === "cancel") {
    if (!body?.cancel_at_cycle_end) sub.cancelled = true;
    return { ...sub, status: sub.cancelled ? "cancelled" : sub.status };
  }
  // Checkout "approved" → before start_at it's a trial, after it a paid monthly/yearly period.
  if (sub.cancelled) return { ...sub, status: "cancelled" };
  if (sub.start_at && now < sub.start_at) return { ...sub, status: "authenticated" };
  const start = sub.start_at ?? now;
  const period = sub.plan_id.endsWith("yearly") ? 365 * 86400 : 30 * 86400;
  const current_end = start + period * (Math.floor((now - start) / period) + 1);
  return { ...sub, status: "active", current_end };
}

export function hmacMatches(payload: string, signature: string | null | undefined, secret: string | undefined) {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const toIso = (unix: number | null | undefined) => (unix ? new Date(unix * 1000).toISOString() : null);

/**
 * Mirrors a Razorpay subscription onto our subscriptions row. Called from the
 * checkout verify route, the webhook, and the status route (lazy resync), so the
 * plan stays right even when webhooks can't reach the server (e.g. localhost).
 */
export async function syncSubscription(admin: SupabaseClient, userId: string, sub: RzpSubscription) {
  if (sub.status === "created") return; // checkout not finished yet

  const { data: row } = await admin
    .from("subscriptions")
    .select("plan, credits, razorpay_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();
  // Ignore events for an older subscription (e.g. an abandoned checkout).
  if (row?.razorpay_subscription_id && row.razorpay_subscription_id !== sub.id) return;

  const { plan, status } = razorpayToPlan(sub.status, sub.start_at, Date.now());
  const trialing = status === "trialing";
  const wasFree = !row || row.plan === "free";

  const update: Record<string, unknown> = {
    user_id: userId,
    plan,
    status,
    razorpay_subscription_id: sub.id,
    billing_interval: sub.plan_id === planIdFor("yearly") ? "yearly" : "monthly",
    current_period_end: toIso(sub.current_end) ?? (trialing ? toIso(sub.start_at) : null),
    updated_at: new Date().toISOString(),
  };
  if (trialing) Object.assign(update, { trial_ends_at: toIso(sub.start_at), trial_used: true });
  if (plan === "pro" && wasFree) {
    Object.assign(update, { credits: PLAN_CREDITS.pro, credits_reset_at: new Date(Date.now() + 30 * 864e5).toISOString() });
  }
  if (plan === "free") {
    Object.assign(update, { cancel_at_period_end: false, credits: Math.min(row?.credits ?? 0, PLAN_CREDITS.free) });
  }

  const { error } = await admin.from("subscriptions").upsert(update);
  if (error) throw new Error(`Subscription sync failed: ${error.message}`);
}

/** The caller's billing row, refreshed (monthly refill, lapsed cancellations). */
export async function getBilling(supabase: SupabaseClient): Promise<Billing | null> {
  const { data } = await supabase.rpc("my_billing").maybeSingle();
  return (data as Billing) ?? null;
}

/** 402 response for free users hitting a paid feature, or null when allowed. */
export async function requirePaid(supabase: SupabaseClient, feature: string) {
  const billing = await getBilling(supabase);
  if (billing && billing.plan !== "free") return null;
  const msg = `${feature} is a Pro feature. Start your ${TRIAL_DAYS}-day free trial from Settings → Plan & credits.`;
  return NextResponse.json({ error: msg, errorCode: "PRO_REQUIRED" }, { status: 402 });
}

/**
 * Charges credits before running an AI handler and refunds them if it fails, so
 * concurrent requests can't overspend and users never pay for an error.
 */
export async function withCredits(action: CreditAction, req: Request, handler: (req: Request) => Promise<Response>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return handler(req); // the handler returns its own 401

  const cost = CREDIT_COSTS[action];
  const { error } = await supabase.rpc("spend_credits", { amount: cost, reason: action });
  if (error) {
    const friendly = creditErrorMessage(error.message);
    const msg = friendly ?? "We couldn't check your credits. Please try again.";
    // Both shapes: the chat panel reads `text`, other callers read `error`.
    return NextResponse.json({ ok: false, errorCode: "NO_CREDITS", text: msg, error: msg }, { status: friendly ? 402 : 500 });
  }

  const refund = () =>
    adminClient().rpc("refund_credits", { uid: user.id, amount: cost, reason: `refund_${action}` }).then(({ error: e }) => {
      if (e) console.error("[billing] refund failed", user.id, action, e.message);
    });

  try {
    const res = await handler(req);
    if (!res.ok) await refund();
    return res;
  } catch (err) {
    await refund();
    throw err;
  }
}
