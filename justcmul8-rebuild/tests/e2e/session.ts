/**
 * Signs a test user in without the login form. Turnstile (captcha) blocks automated browsers on
 * /login, so the session comes from the Supabase admin API instead: a one-time magic-link token,
 * exchanged for a session, written as the cookies @supabase/ssr reads. TEST USERS ONLY; needs the
 * service-role key from .env.local and never runs in the app.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

function env(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of [".env.local", ".env.test.local"]) {
    try {
      for (const l of readFileSync(path.resolve(__dirname, "../..", f), "utf8").split(/\r?\n/)) {
        const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch { /* missing file: fall back to process.env */ }
  }
  return { ...out, ...(process.env as Record<string, string>) };
}

/**
 * True when the auth forms are behind Turnstile: locally when the site key is in .env.local, and
 * always against a deployed site. Cloudflare challenges automated browsers there, so specs that
 * submit those forms to Supabase skip themselves.
 */
export const captchaOn = !!env().NEXT_PUBLIC_TURNSTILE_SITE_KEY || !!process.env.E2E_BASE_URL;

export async function signInWithoutCaptcha(context: BrowserContext, email: string, baseURL: string): Promise<void> {
  const e = env();
  const url = e.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !e.SUPABASE_SERVICE_ROLE_KEY || !e.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error("Supabase URL / anon / service-role key missing for test sign-in");

  const admin = createClient(url, e.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(`generateLink: ${error.message}`);

  // Exchange the token, letting @supabase/ssr write its own cookie format (name, base64, chunking).
  const jar: { name: string; value: string }[] = [];
  const ssr = createServerClient(url, e.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => jar, setAll: (c) => c.forEach(({ name, value }) => { const i = jar.findIndex((x) => x.name === name); if (i >= 0) jar.splice(i, 1); if (value) jar.push({ name, value }); }) },
  });
  const { error: vErr } = await ssr.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (vErr) throw new Error(`verifyOtp: ${vErr.message}`);
  if (!jar.length) throw new Error("no session cookies were written");

  const { hostname, protocol } = new URL(baseURL);
  await context.addCookies(jar.map(({ name, value }) => ({ name, value, domain: hostname, path: "/", sameSite: "Lax" as const, secure: protocol === "https:", httpOnly: false })));
}
