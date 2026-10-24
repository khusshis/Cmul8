// Single source of truth for plans, credits and costs (client-safe, no secrets).
// Credit allowances must match public.plan_credits() in supabase/billing.sql.

export type PlanId = "free" | "pro" | "enterprise";
export type Interval = "monthly" | "yearly";

export const PLAN_CREDITS: Record<PlanId, number> = { free: 100, pro: 500, enterprise: 2000 };

// Display prices in INR. Keep in sync with the Razorpay plans (RAZORPAY_PLAN_PRO_* in env),
// which decide what is actually charged: ₹2,990 every month, or ₹25,000 every year.
export const PRO_MONTHLY = 2990;
export const PRO_YEARLY_TOTAL = 25000;
/** Per-month price shown for each billing choice. */
export const PRO_PRICE: Record<Interval, number> = { monthly: PRO_MONTHLY, yearly: Math.round(PRO_YEARLY_TOTAL / 12) };
export const YEARLY_SAVING_PCT = Math.round((1 - PRO_YEARLY_TOTAL / (PRO_MONTHLY * 12)) * 100);
/** ₹2,990 style (Indian digit grouping). */
export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
export const TRIAL_DAYS = 14;

export const CREDIT_COSTS = {
  create_simulation: 40, // enforced by the projects insert trigger
  ai_generate: 40,
  ai_optimize: 20,
  ai_chat: 2,
} as const;
export type CreditAction = keyof typeof CREDIT_COSTS;

// Features that need a paid plan (trialing counts as paid).
export const PRO_FEATURES = ["invite collaborators", "link sharing", "CSV export"] as const;

export type Billing = {
  plan: PlanId;
  status: "active" | "trialing" | "past_due" | "cancelled";
  billing_interval: Interval | null;
  trial_ends_at: string | null;
  trial_used: boolean;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  credits: number;
  credits_reset_at: string;
  /** Null for a paid plan granted directly (complimentary): nothing is billed and nothing renews. */
  razorpay_subscription_id?: string | null;
};

/** A paid plan that isn't billed through Razorpay (granted by an admin). */
export const isComplimentary = (b: Billing) => b.plan !== "free" && !b.razorpay_subscription_id;

/** Short plan caption, e.g. "Pro · billed monthly", "Pro · 14-day free trial", "Pro · complimentary". */
export function planCaption(b: Billing) {
  const name = b.plan === "enterprise" ? "Enterprise" : "Pro";
  if (b.plan === "free") return "Free plan · free forever";
  if (isComplimentary(b)) return `${name} · complimentary`;
  if (b.status === "trialing") return `${name} · ${TRIAL_DAYS}-day free trial`;
  return b.billing_interval ? `${name} · billed ${b.billing_interval}` : name;
}

/** Turns a Postgres INSUFFICIENT_CREDITS error into a friendly sentence, else null. */
export function creditErrorMessage(message: string | undefined | null): string | null {
  if (!message?.includes("INSUFFICIENT_CREDITS")) return null;
  const need = message.match(/(\d+) credits needed/)?.[1];
  return `You're out of credits${need ? ` (this needs ${need})` : ""}. Upgrade to Pro for ${PLAN_CREDITS.pro} credits a month, or wait for your monthly refill.`;
}

/**
 * Razorpay subscription status → our plan. "authenticated" with a future start_at is
 * the trial (card mandate set, first charge later); "pending" is a failed renewal that
 * Razorpay is still retrying, so access continues until it halts.
 */
export function razorpayToPlan(rzpStatus: string, startAt: number | null, nowMs: number): { plan: PlanId; status: Billing["status"] } {
  if (rzpStatus === "authenticated") {
    return { plan: "pro", status: startAt && startAt * 1000 > nowMs ? "trialing" : "active" };
  }
  if (rzpStatus === "active") return { plan: "pro", status: "active" };
  if (rzpStatus === "pending") return { plan: "pro", status: "past_due" };
  return { plan: "free", status: "cancelled" }; // halted, cancelled, completed, expired, paused
}
