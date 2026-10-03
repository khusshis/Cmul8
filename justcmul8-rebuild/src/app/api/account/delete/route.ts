import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { razorpay } from "@/lib/billing/server";

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Stop billing before the row (and its subscription id) disappears with the user.
  const { data: sub } = await admin.from("subscriptions").select("plan, razorpay_subscription_id").eq("user_id", user.id).maybeSingle();
  if (sub?.razorpay_subscription_id && sub.plan !== "free") {
    try {
      await razorpay(`/subscriptions/${sub.razorpay_subscription_id}/cancel`, { cancel_at_cycle_end: 0 });
    } catch {
      return NextResponse.json({ error: "Couldn't cancel your subscription; account not deleted. Please try again." }, { status: 502 });
    }
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
