// Single source of truth for plans, credits and costs (client-safe, no secrets).
// Credit allowances must match public.plan_credits() in supabase/billing.sql.

export type PlanId = "free" | "pro" | "enterprise";
export type Interval = "monthly" | "yearly";

export const PLAN_CREDITS: Record<PlanId, number> = { free: 100, pro: 500, enterprise: 2000 };

// Display prices. The amount actually charged comes from the Razorpay plan ids in env.
export const PRO_PRICE: Record<Interval, number> = { monthly: 29, yearly: 23 };
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
};

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
