import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/supabase/rateLimit";
import { audit } from "@/lib/audit";

// DPDP right of access: everything we hold about the signed-in user, as one JSON download.
// Reads go through the user's own session, so RLS limits them to the user's rows.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await rateLimit(`export:${user.id}`, 3600, 5);
  if (limited) return limited;

  const own = (table: string, column = "user_id") => supabase.from(table).select("*").eq(column, user.id);
  const [profile, projects, runs, chats, subscription, credits, invitesSent, auditLog] = await Promise.all([
    own("profiles", "id").maybeSingle(),
    own("projects"),
    own("simulation_runs"),
    own("chat_history"),
    own("subscriptions").maybeSingle(),
    own("credit_ledger"),
    supabase.from("project_members").select("project_id, email, role, source, created_at").eq("invited_by", user.id),
    own("audit_log"),
  ]);

  const body = {
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
      signInMethods: user.app_metadata?.providers ?? [],
      consent: user.user_metadata?.consent ?? null,
      aiProcessing: user.user_metadata?.ai_opt_out === true ? "withdrawn" : "allowed",
    },
    profile: profile.data,
    projects: projects.data ?? [],
    simulationRuns: runs.data ?? [],
    chatHistory: chats.data ?? [],
    subscription: subscription.data,
    creditLedger: credits.data ?? [],
    invitationsSent: invitesSent.data ?? [],
    activityLog: auditLog.data ?? [],
  };
  await audit(user.id, "account.export");

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="justcmul8-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
