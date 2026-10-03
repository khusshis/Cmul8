import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient, getBilling, razorpay, syncSubscription } from "@/lib/billing/server";

// Current plan + credits. Re-syncs from Razorpay when the period/trial has ended or a
// payment is pending, so renewals and failed charges show up even without webhooks.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let billing = await getBilling(supabase);
  const subId = (billing as { razorpay_subscription_id?: string } | null)?.razorpay_subscription_id;
  const stale =
    subId && billing && billing.plan !== "free" &&
    (billing.status === "past_due" || (billing.current_period_end && new Date(billing.current_period_end) < new Date()));
  if (stale) {
    try {
      await syncSubscription(adminClient(), user.id, await razorpay(`/subscriptions/${subId}`));
      billing = await getBilling(supabase);
    } catch (err) {
      console.error("[billing] resync failed", err);
    }
  }
  return NextResponse.json(billing);
}
