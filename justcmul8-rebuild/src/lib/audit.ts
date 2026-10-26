// SERVER ONLY. Appends a security-relevant action to public.audit_log (supabase/security.sql §8).
// Never blocks or fails the action it records: a missing table or failed insert is only logged.
import { adminClient } from "@/lib/supabase/admin";

const YEAR_MS = 365 * 86_400_000;

export async function audit(userId: string | null, action: string, details: Record<string, unknown> = {}) {
  try {
    const db = adminClient();
    const { error } = await db.from("audit_log").insert({ user_id: userId, action, details });
    if (error) console.error("[audit]", action, error.message);
    // ponytail: ~1 call in 100 sweeps entries older than a year (DPDP log retention); move to a cron job if the table grows large.
    if (Math.random() < 0.01) await db.from("audit_log").delete().lt("created_at", new Date(Date.now() - YEAR_MS).toISOString());
  } catch (err) {
    console.error("[audit]", action, err);
  }
}
