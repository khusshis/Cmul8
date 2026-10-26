"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, ShieldCheck, Smartphone, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import Switch from "@/components/ui/Switch";
import type { ConsentRecord } from "@/lib/consent";

type Head = (p: { icon: React.ElementType; title: string; sub: string }) => React.ReactNode;
interface Styles { card: string; label: string; Head: Head }

const btn = "inline-flex h-11 items-center gap-2 rounded-full border border-ln-e7e5f6 bg-surface px-5 text-[14px] font-semibold text-fg-334155 transition-colors hover:border-ln-5742ff hover:text-fg-5742ff disabled:opacity-50";
const primary = "inline-flex h-11 items-center gap-2 rounded-full border border-ln-8d80ff bg-sf-5742ff px-5 text-[14px] font-semibold text-white transition-colors hover:bg-sf-4531e5 disabled:opacity-50";

/** TOTP two-factor sign-in (Supabase MFA). Once on, sign-in asks for a 6-digit code and the
 *  database refuses an unverified session (security.sql §9). */
export function TwoFactorCard({ card, label, Head }: Styles) {
  const supabase = useMemo(() => createClient(), []);
  const [factorId, setFactorId] = useState<string | null>(null); // verified factor, when on
  const [loading, setLoading] = useState(true);
  const [setup, setSetup] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(
    () => supabase.auth.mfa.listFactors().then(({ data }) => {
      setFactorId(data?.totp?.[0]?.id ?? null);
      setLoading(false);
    }),
    [supabase]
  );
  useEffect(() => { refresh(); }, [refresh]);

  async function start() {
    setBusy(true);
    // An abandoned earlier setup leaves an unverified factor that blocks a new one.
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const f of list?.all ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `JustCmul8 ${Date.now()}` });
    setBusy(false);
    if (error || !data) { toast.error(error?.message || "Couldn't start setup.", "Two-factor"); return; }
    setSetup({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    setCode("");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!setup || code.length !== 6) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: setup.id, code });
    setBusy(false);
    if (error) { toast.error("That code didn't match. Check your app's clock and try the newest code.", "Two-factor"); return; }
    setSetup(null);
    toast.success("Sign-in now asks for a code from your authenticator app.", "Two-factor is on");
    refresh();
  }

  async function cancel() {
    if (setup) await supabase.auth.mfa.unenroll({ factorId: setup.id });
    setSetup(null);
  }

  async function turnOff() {
    if (!factorId || !confirm("Turn off two-factor sign-in? Your account will be protected by your password only.")) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) { toast.error(error.message, "Two-factor"); return; }
    await supabase.auth.refreshSession();
    toast.success("Two-factor sign-in is off.", "Two-factor");
    refresh();
  }

  return (
    <div className={card}>
      <Head icon={Smartphone} title="Two-factor authentication" sub="Ask for a 6-digit code from an authenticator app (Google Authenticator, Authy, 1Password) when you sign in." />
      {loading ? (
        <Loader2 size={18} className="animate-spin text-fg-94a3b8" />
      ) : setup ? (
        <form onSubmit={verify} className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URI SVG from Supabase */}
          <img src={setup.qr} alt="QR code to scan with your authenticator app" className="h-40 w-40 rounded-2xl border border-ln-ecebf7 bg-white p-2" />
          <div>
            <p className="text-[13px] text-fg-475569">Scan the QR code with your authenticator app, then enter the 6-digit code it shows.</p>
            <p className="mt-2 text-[12px] text-fg-64748b">Can&apos;t scan? Enter this key instead: <code className="break-all font-mono text-[12px] text-fg-334155">{setup.secret}</code></p>
            <label className={`${label} mt-4 block`} htmlFor="mfa-code">6-digit code</label>
            <input
              id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="mt-2 h-11 w-40 rounded-full border border-ln-e7e5f6 bg-sf-fafaff px-4 font-mono text-[16px] tracking-[0.3em] text-fg-161622 outline-none focus:border-ln-c4b5fd"
            />
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button type="submit" disabled={busy || code.length !== 6} className={primary}>
                {busy && <Loader2 size={15} className="animate-spin" />} Turn on
              </button>
              <button type="button" onClick={cancel} disabled={busy} className={btn}>Cancel</button>
            </div>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold ${factorId ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-sf-f6f5fc text-fg-64748b"}`}>
            <ShieldCheck size={14} /> {factorId ? "On" : "Off"}
          </span>
          {factorId ? (
            <button onClick={turnOff} disabled={busy} className={btn}>Turn off</button>
          ) : (
            <button onClick={start} disabled={busy} className={primary}>
              {busy && <Loader2 size={15} className="animate-spin" />} Set up
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** DPDP rights in one place: download your data, AI-processing consent, consent record, grievance contact. */
export function PrivacyCard({ card, Head }: Styles) {
  const supabase = useMemo(() => createClient(), []);
  const [consent, setConsent] = useState<ConsentRecord | null | undefined>(undefined);
  const [aiAllowed, setAiAllowed] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setConsent((user?.user_metadata?.consent as ConsentRecord | undefined) ?? null);
      setAiAllowed(user?.user_metadata?.ai_opt_out !== true);
    });
  }, [supabase]);

  async function setAi(allowed: boolean) {
    setBusy(true);
    const res = await fetch("/api/account/ai-consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ allowed }) });
    setBusy(false);
    if (!res.ok) { toast.error("Couldn't save your choice. Please try again.", "AI processing"); return; }
    setAiAllowed(allowed);
    toast.success(allowed ? "The AI assistant is available again." : "Nothing will be sent to the AI assistant until you turn this back on.", "AI processing");
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className={card}>
      <Head icon={UserCheck} title="Your data & privacy" sub="Your rights under India's Digital Personal Data Protection Act." />
      <div className="divide-y divide-ln-f1f0fa">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-fg-161622">Download my data</p>
            <p className="text-[12.5px] text-fg-64748b">Your account, projects, runs, chats, billing and activity as one JSON file.</p>
          </div>
          <a href="/api/account/export" download className={btn}><Download size={14} /> Download</a>
        </div>
        <div className="flex items-center justify-between gap-4 py-4">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-fg-161622">Allow AI processing</p>
            <p className="text-[12.5px] text-fg-64748b">When on, the parts of a model you send to the assistant are processed by Google Gemini. Turning it off withdraws that consent.</p>
          </div>
          <span className={busy ? "pointer-events-none opacity-60" : ""}><Switch checked={aiAllowed} onChange={setAi} label="Allow AI processing" /></span>
        </div>
        <div className="py-4">
          <p className="text-[14px] font-semibold text-fg-161622">Consent record</p>
          <p className="text-[12.5px] text-fg-64748b">
            {consent === undefined ? "Loading…"
              : consent ? `You accepted the Terms and Privacy Policy (version ${consent.version}) on ${fmt(consent.acceptedAt)} and confirmed you are 18 or older.`
              : "No consent is recorded for this account (it was created before consent recording began on 26 Oct 2026)."}
          </p>
        </div>
        <div className="pt-4">
          <p className="text-[14px] font-semibold text-fg-161622">Questions or complaints</p>
          <p className="text-[12.5px] text-fg-64748b">
            Contact our Grievance Officer at <a href="mailto:hello@justcmul8.com" className="font-semibold text-fg-5742ff hover:underline">hello@justcmul8.com</a>. We reply within 30 days. You can also complain to the Data Protection Board of India.
          </p>
        </div>
      </div>
    </div>
  );
}
