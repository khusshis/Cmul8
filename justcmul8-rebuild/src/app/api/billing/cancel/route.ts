import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient, cancelSubscription, getBilling, isSubscriptionId, syncSubscription } from "@/lib/billing/server";
import { rateLimit } from "@/lib/supabase/rateLimit";

// Trial: cancel now (no charge, back to Free). Paid: keep Pro until the period ends.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await rateLimit(`billing:${user.id}`, 3600, 30);
  if (limited) return limited;

  const billing = await getBilling(supabase);
  const subId = (billing as { razorpay_subscription_id?: string } | null)?.razorpay_subscription_id;
  if (!billing || billing.plan === "free" || !isSubscriptionId(subId)) {
    return NextResponse.json({ error: "No active subscription to cancel" }, { status: 400 });
  }

  const trialing = billing.status === "trialing";
  try {
    const sub = await cancelSubscription(subId, !trialing);
    const admin = adminClient();
    if (trialing || sub.status === "cancelled") await syncSubscription(admin, user.id, sub);
    else await admin.from("subscriptions").update({ cancel_at_period_end: true }).eq("user_id", user.id);
    return NextResponse.json(await getBilling(supabase));
  } catch (err) {
    console.error("[billing] cancel failed", err);
    return NextResponse.json({ error: "Couldn't cancel right now. Please try again." }, { status: 502 });
  }
}
