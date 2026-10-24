import { describe, expect, it } from "vitest";
import { razorpayToPlan, creditErrorMessage, PLAN_CREDITS, CREDIT_COSTS, PRO_PRICE, planCaption, isComplimentary, type Billing } from "@/lib/billing/plans";

const now = 1_700_000_000_000;
const future = now / 1000 + 14 * 86400;

describe("razorpayToPlan", () => {
  it("authenticated with a future start is a trial, otherwise active", () => {
    expect(razorpayToPlan("authenticated", future, now)).toEqual({ plan: "pro", status: "trialing" });
    expect(razorpayToPlan("authenticated", null, now)).toEqual({ plan: "pro", status: "active" });
    expect(razorpayToPlan("authenticated", now / 1000 - 60, now)).toEqual({ plan: "pro", status: "active" });
  });
  it("active -> pro/active, pending -> pro/past_due", () => {
    expect(razorpayToPlan("active", null, now)).toEqual({ plan: "pro", status: "active" });
    expect(razorpayToPlan("pending", null, now)).toEqual({ plan: "pro", status: "past_due" });
  });
  it("every terminal status drops to free/cancelled", () => {
    for (const s of ["halted", "cancelled", "completed", "expired", "paused"]) {
      expect(razorpayToPlan(s, future, now), s).toEqual({ plan: "free", status: "cancelled" });
    }
  });
});

describe("creditErrorMessage", () => {
  it("only maps INSUFFICIENT_CREDITS and extracts the amount", () => {
    expect(creditErrorMessage("INSUFFICIENT_CREDITS: 40 credits needed")).toMatch(/this needs 40/);
    expect(creditErrorMessage("duplicate key value")).toBeNull();
    expect(creditErrorMessage(undefined)).toBeNull();
    expect(creditErrorMessage(null)).toBeNull();
  });
  it("still returns a message when no amount is parseable", () => {
    expect(creditErrorMessage("INSUFFICIENT_CREDITS")).toMatch(/out of credits/i);
  });
});

describe("plan constants (must match supabase billing.sql)", () => {
  it("credit allowances", () => {
    expect(PLAN_CREDITS).toEqual({ free: 100, pro: 500, enterprise: 2000 });
  });
  it("action costs are positive integers", () => {
    for (const [k, v] of Object.entries(CREDIT_COSTS)) {
      expect(Number.isInteger(v) && v > 0, k).toBe(true);
    }
  });
  it("yearly is cheaper per month than monthly", () => {
    expect(PRO_PRICE.yearly).toBeLessThan(PRO_PRICE.monthly);
  });
});

describe("planCaption", () => {
  const base: Billing = { plan: "pro", status: "active", billing_interval: "monthly", trial_ends_at: null, trial_used: true, current_period_end: null, cancel_at_period_end: false, credits: 500, credits_reset_at: "", razorpay_subscription_id: "sub_1" };
  it("names how the plan is paid for", () => {
    expect(planCaption(base)).toBe("Pro · billed monthly");
    expect(planCaption({ ...base, status: "trialing" })).toBe("Pro · 14-day free trial");
    expect(planCaption({ ...base, plan: "free" })).toBe("Free plan · free forever");
  });
  it("a paid plan with no Razorpay subscription is complimentary, never 'billed null'", () => {
    const comp = { ...base, billing_interval: null, razorpay_subscription_id: null };
    expect(isComplimentary(comp)).toBe(true);
    expect(planCaption(comp)).toBe("Pro · complimentary");
    expect(isComplimentary({ ...comp, plan: "free" })).toBe(false);
  });
});
