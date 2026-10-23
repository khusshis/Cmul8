import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

/**
 * Global setup + teardown: deletes the test accounts' e2e-* projects with the service role,
 * so one spec's edits (or a crashed run) can never leak into the next run.
 */
export default async function cleanup() {
  const read = (f: string) => {
    try {
      return Object.fromEntries(readFileSync(path.join(__dirname, "../..", f), "utf8").split(/\r?\n/)
        .filter((l) => /^[A-Z_0-9]+=/.test(l))
        .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
    } catch { return {}; }
  };
  const env: Record<string, string> = { ...read(".env.local"), ...read(".env.test.local") };
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.E2E_EMAIL) return;
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const ids = (data?.users ?? []).filter((u) => [env.E2E_EMAIL, env.E2E_EMAIL_2].includes(u.email ?? "")).map((u) => u.id);
  if (ids.length) await admin.from("projects").delete().in("user_id", ids).like("name", "e2e-%");
}
