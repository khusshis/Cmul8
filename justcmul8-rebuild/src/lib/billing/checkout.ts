"use client";
import { TRIAL_DAYS, type Billing, type Interval } from "./plans";

type RazorpayCtor = new (options: Record<string, unknown>) => { open: () => void };
declare global { interface Window { Razorpay?: RazorpayCtor } }

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn't load the payment window. Check your connection and try again."));
    document.body.appendChild(s);
  });
}

async function verify(payment: Record<string, string>): Promise<Billing> {
  const v = await fetch("/api/billing/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payment),
  });
  const body = await v.json().catch(() => ({}));
  if (!v.ok) throw new Error(body.error || "Payment verification failed.");
  return body as Billing;
}

// Local dev only (server decides via RAZORPAY_MOCK): a confirm box stands in for the Razorpay popup.
async function mockCheckout(subscriptionId: string, trial: boolean, interval: Interval): Promise<Billing | null> {
  const ok = window.confirm(`[Mock Razorpay] Pro, billed ${interval}${trial ? `, ${TRIAL_DAYS}-day free trial` : ""}.

OK = payment succeeds, Cancel = close checkout.`);
  if (!ok) return null;
  return verify({ razorpay_payment_id: "pay_mock", razorpay_subscription_id: subscriptionId, razorpay_signature: "mock" });
}

/**
 * Opens Razorpay Checkout for Pro. Resolves with the updated billing row, or null if
 * the user closed the window. Failed card attempts are retried inside Razorpay's own
 * modal, so only a dismiss or a verified success settles this.
 */
export async function startProCheckout(interval: Interval, prefill: { email?: string; name?: string }): Promise<Billing | null> {
  const res = await fetch("/api/billing/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ interval }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Couldn't start checkout.");
  if (data.mock) return mockCheckout(data.subscriptionId, data.trial, interval);
  await loadCheckoutScript();

  return new Promise((resolve, reject) => {
    new window.Razorpay!({
      key: data.keyId,
      subscription_id: data.subscriptionId,
      name: "JustCmul8",
      description: data.trial ? `Pro · ${TRIAL_DAYS}-day free trial, then ${interval}` : `Pro · billed ${interval}`,
      prefill,
      theme: { color: "#5742FF" },
      handler: (payment: Record<string, string>) => verify(payment).then(resolve, reject),
      modal: { ondismiss: () => resolve(null) },
    }).open();
  });
}
