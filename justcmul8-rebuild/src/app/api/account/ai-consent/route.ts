import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/supabase/rateLimit";
import { audit } from "@/lib/audit";

// DPDP: give or withdraw consent for AI processing. withCredits() refuses AI requests while it is withdrawn.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await rateLimit(`ai-consent:${user.id}`, 60, 10);
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  if (typeof body?.allowed !== "boolean") return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { error } = await supabase.auth.updateUser({ data: { ai_opt_out: !body.allowed } });
  if (error) return NextResponse.json({ error: "Couldn't save your choice" }, { status: 500 });
  await audit(user.id, body.allowed ? "consent.ai_given" : "consent.ai_withdrawn");
  return NextResponse.json({ ok: true });
}
