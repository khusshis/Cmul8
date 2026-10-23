import { NextResponse } from "next/server";
import { MOCK_RAZORPAY, adminClient, hmacMatches, isSubscriptionId, razorpay, syncSubscription, type RzpSubscription } from "@/lib/billing/server";

// Razorpay retries failed deliveries for up to 24 h; anything older is a replay.
const MAX_EVENT_AGE_SECONDS = 24 * 60 * 60;

// Razorpay → us. Enable the subscription.* events in the Razorpay dashboard and point
// them here with RAZORPAY_WEBHOOK_SECRET.
export async function POST(req: Request) {
  const raw = await req.text();
  if (!hmacMatches(raw, req.headers.get("x-razorpay-signature"), process.env.RAZORPAY_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: { created_at?: unknown; payload?: { subscription?: { entity?: RzpSubscription } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const createdAt = Number(event?.created_at);
  if (Number.isFinite(createdAt) && Date.now() / 1000 - createdAt > MAX_EVENT_AGE_SECONDS) {
    return NextResponse.json({ ok: true, ignored: "stale" }); // 2xx so Razorpay stops retrying
  }

  const entity = event?.payload?.subscription?.entity;
  if (!isSubscriptionId(entity?.id)) return NextResponse.json({ ok: true }); // not a subscription event

  const admin = adminClient();

  // Replay protection: an event id is recorded only after it was processed, so a
  // function killed mid-way still lets Razorpay retry. Concurrent duplicates may both
  // run; that is harmless because syncSubscription is idempotent and state is re-fetched.
  // If the table is missing (supabase/security.sql not run yet) processing continues.
  const eventId = req.headers.get("x-razorpay-event-id")?.slice(0, 100);
  if (eventId) {
    const { data: seen, error } = await admin.from("webhook_events").select("id").eq("id", eventId).maybeSingle();
    if (seen) return NextResponse.json({ ok: true, duplicate: true });
    if (error) console.error("[billing/webhook] event dedupe unavailable:", error.message);
  }

  try {
    // The signed payload proves the event is real, but deliveries can arrive out of
    // order; Razorpay's API is the source of truth for the subscription's state now.
    const sub = MOCK_RAZORPAY ? entity : await razorpay(`/subscriptions/${entity.id}`);
    let userId = sub.notes?.user_id;
    if (!userId) {
      const { data } = await admin.from("subscriptions").select("user_id").eq("razorpay_subscription_id", sub.id).maybeSingle();
      userId = data?.user_id;
    }
    if (userId) await syncSubscription(admin, userId, sub);
    if (eventId) {
      const { error } = await admin.from("webhook_events").insert({ id: eventId, source: "razorpay" });
      if (error && error.code !== "23505") console.error("[billing/webhook] couldn't record event:", error.message);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[billing/webhook] processing failed", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
