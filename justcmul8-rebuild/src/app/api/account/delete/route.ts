import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { adminClient, cancelSubscription, isSubscriptionId } from "@/lib/billing/server";
import { rateLimit } from "@/lib/supabase/rateLimit";
import { audit } from "@/lib/audit";

// Deleting an account is irreversible, so a stolen or forgotten-open session is
// not enough: the user must have signed in within this window.
const REAUTH_WINDOW_SECONDS = 10 * 60;

/** Unix seconds of this session's most recent sign-in (JWT `amr`), falling back to the account's last sign-in. */
async function lastSignInAt(supabase: Awaited<ReturnType<typeof createServerClient>>, fallbackIso?: string | null) {
  const { data } = await supabase.auth.getClaims();
  const stamps = (data?.claims?.amr ?? [])
    .map((e) => (typeof e === "object" && e ? Number(e.timestamp) : NaN))
    .filter(Number.isFinite);
  if (stamps.length) return Math.max(...stamps);
  return fallbackIso ? Date.parse(fallbackIso) / 1000 : 0;
}

export async function POST() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimit(`account-delete:${user.id}`, 3600, 5);
  if (limited) return limited;

  if (Date.now() / 1000 - (await lastSignInAt(supabase, user.last_sign_in_at)) > REAUTH_WINDOW_SECONDS) {
    return NextResponse.json(
      { error: "For your security, please sign out and sign back in, then delete your account within 10 minutes.", errorCode: "REAUTH_REQUIRED" },
      { status: 403 }
    );
  }

  const admin = adminClient();

  // Stop billing before the row (and its subscription id) disappears with the user.
  const { data: sub } = await admin.from("subscriptions").select("plan, razorpay_subscription_id").eq("user_id", user.id).maybeSingle();
  if (sub && isSubscriptionId(sub.razorpay_subscription_id) && sub.plan !== "free") {
    try {
      await cancelSubscription(sub.razorpay_subscription_id, false);
    } catch (err) {
      console.error("[account/delete] subscription cancel failed", user.id, err);
      return NextResponse.json({ error: "Couldn't cancel your subscription; account not deleted. Please try again." }, { status: 502 });
    }
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[account/delete] deleteUser failed", user.id, error.message);
    return NextResponse.json({ error: "Couldn't delete your account. Please try again." }, { status: 500 });
  }
  await audit(user.id, "account.delete");

  return NextResponse.json({ ok: true });
}
