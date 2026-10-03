import { NextResponse } from "next/server";
import { adminClient, hmacMatches, syncSubscription, type RzpSubscription } from "@/lib/billing/server";

// Razorpay → us. Enable the subscription.* events in the Razorpay dashboard and point
// them here with RAZORPAY_WEBHOOK_SECRET.
export async function POST(req: Request) {
  const raw = await req.text();
  if (!hmacMatches(raw, req.headers.get("x-razorpay-signature"), process.env.RAZORPAY_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const sub: RzpSubscription | undefined = JSON.parse(raw)?.payload?.subscription?.entity;
  if (!sub?.id) return NextResponse.json({ ok: true }); // not a subscription event

  const admin = adminClient();
  let userId = sub.notes?.user_id;
  if (!userId) {
    const { data } = await admin.from("subscriptions").select("user_id").eq("razorpay_subscription_id", sub.id).maybeSingle();
    userId = data?.user_id;
  }
  if (userId) await syncSubscription(admin, userId, sub);
  return NextResponse.json({ ok: true });
}
