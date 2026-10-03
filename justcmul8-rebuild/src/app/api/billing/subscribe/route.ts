import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MOCK_RAZORPAY, adminClient, getBilling, planIdFor, razorpay, trialSeconds } from "@/lib/billing/server";

// Creates a Razorpay subscription for Checkout. First-time subscribers get a trial:
// the card is authorised now and the first charge happens when the trial ends.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { interval } = await req.json().catch(() => ({}));
  if (interval !== "monthly" && interval !== "yearly") {
    return NextResponse.json({ error: "Choose monthly or yearly billing" }, { status: 400 });
  }
  if (!MOCK_RAZORPAY && (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET || !planIdFor(interval))) {
    return NextResponse.json({ error: "Payments aren't set up yet. Please try again later." }, { status: 503 });
  }

  const billing = await getBilling(supabase);
  if (billing && billing.plan !== "free") {
    return NextResponse.json({ error: "You already have an active Pro plan." }, { status: 409 });
  }
  const trial = !billing?.trial_used;

  try {
    const sub = await razorpay("/subscriptions", {
      plan_id: planIdFor(interval),
      total_count: interval === "yearly" ? 10 : 120, // Razorpay requires an end; ~10 years
      quantity: 1,
      customer_notify: 1,
      notes: { user_id: user.id },
      ...(trial ? { start_at: Math.floor(Date.now() / 1000) + trialSeconds() } : {}),
    });
    await adminClient().from("subscriptions").update({ razorpay_subscription_id: sub.id }).eq("user_id", user.id);
    return NextResponse.json({ subscriptionId: sub.id, keyId: process.env.RAZORPAY_KEY_ID, trial, mock: MOCK_RAZORPAY });
  } catch (err) {
    console.error("[billing] subscribe failed", err);
    return NextResponse.json({ error: "Couldn't start checkout. Please try again." }, { status: 502 });
  }
}
