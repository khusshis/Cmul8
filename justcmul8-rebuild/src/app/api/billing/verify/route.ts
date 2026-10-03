import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MOCK_RAZORPAY, adminClient, getBilling, hmacMatches, razorpay, syncSubscription } from "@/lib/billing/server";

// Called by Checkout's success handler. Verifies the signature, then trusts only
// what Razorpay's API says about the subscription.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { razorpay_payment_id: paymentId, razorpay_subscription_id: subId, razorpay_signature: signature } = body;
  if (typeof paymentId !== "string" || typeof subId !== "string" ||
      (!MOCK_RAZORPAY && !hmacMatches(`${paymentId}|${subId}`, signature, process.env.RAZORPAY_KEY_SECRET))) {
    return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
  }

  try {
    let sub = await razorpay(`/subscriptions/${subId}`);
    if (sub.notes?.user_id !== user.id) return NextResponse.json({ error: "Not your subscription" }, { status: 403 });
    if (sub.status === "created") {
      await new Promise((r) => setTimeout(r, 2000)); // Razorpay can lag a moment behind Checkout
      sub = await razorpay(`/subscriptions/${subId}`);
    }
    await syncSubscription(adminClient(), user.id, sub);
    return NextResponse.json(await getBilling(supabase));
  } catch (err) {
    console.error("[billing] verify failed", err);
    return NextResponse.json({ error: "Payment received, but we couldn't update your plan yet. Refresh in a minute." }, { status: 502 });
  }
}
