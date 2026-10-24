"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import {
  ArrowRight, Bot, Check, X, Cpu, CreditCard, Database, Globe, KeyRound, LifeBuoy, Lock, Network, ShieldCheck, Bug, UserCheck, type LucideIcon,
} from "lucide-react";
import { Backdrop, Reveal, SectionHeader, Stagger, StaggerItem, spring } from "@/components/landing/motionKit";
import PricingSection from "@/components/landing/PricingSection";

// Every control below is something the product really does (see next.config.ts headers, src/proxy.ts,
// supabase/security.sql, src/lib/billing, src/lib/ai). Each has a plain-English and an engineer's wording.
type Mode = "plain" | "tech";
type Line = { plain: string; tech: string };
type Feature = { id: string; icon: LucideIcon; tone: keyof typeof TONES; title: string; lead: Line; points: Line[] };

const TONES = {
  violet: { tile: "bg-sf-f3f1ff text-fg-5742ff", check: "text-fg-5742ff", glow: "rgba(87,66,255,.16)", ring: "group-hover:border-ln-c4b5fd" },
  blue: { tile: "bg-sf-eff6ff text-fg-2563eb", check: "text-fg-2563eb", glow: "rgba(37,99,235,.14)", ring: "group-hover:border-ln-bfdbfe" },
  emerald: { tile: "bg-sf-ecfdf5 text-fg-059669", check: "text-fg-059669", glow: "rgba(5,150,105,.14)", ring: "group-hover:border-ln-a7f3d0" },
  amber: { tile: "bg-sf-fffbeb text-fg-d97706", check: "text-fg-d97706", glow: "rgba(217,119,6,.14)", ring: "group-hover:border-ln-fde68a" },
  rose: { tile: "bg-sf-fff1f2 text-fg-e11d48", check: "text-fg-e11d48", glow: "rgba(225,29,72,.12)", ring: "group-hover:border-ln-fecdd3" },
  cyan: { tile: "bg-sf-ecfeff text-fg-0891b2", check: "text-fg-0891b2", glow: "rgba(8,145,178,.14)", ring: "group-hover:border-ln-a5f3fc" },
};

const LAYERS: { icon: LucideIcon; name: string; check: Line }[] = [
  { icon: Globe, name: "Your browser", check: { plain: "Strict rules on what the page may load or embed", tech: "CSP · X-Frame-Options DENY · nosniff · Permissions-Policy" } },
  { icon: Lock, name: "Network", check: { plain: "Every connection is encrypted, always", tech: "TLS everywhere · HSTS 2 years, includeSubDomains" } },
  { icon: Network, name: "API", check: { plain: "Each request is checked before it does anything", tech: "CSRF origin check · per-user rate limits · input validation" } },
  { icon: Database, name: "Database", check: { plain: "Your data is walled off from everyone else's", tech: "Postgres Row-Level Security on every table" } },
];

const FEATURES: Feature[] = [
  {
    id: "isolation", icon: Lock, tone: "violet", title: "Data isolation",
    lead: { plain: "Only you, and the people you invite, can see your projects.", tech: "Access is decided inside Postgres for every request, from the signed-in user." },
    points: [
      { plain: "Nobody else can open your work", tech: "RLS policies on all tables; no service key in the browser" },
      { plain: "Viewers can look, only editors can change", tech: "Owner / editor / viewer roles enforced in SQL" },
      { plain: "Share links can be switched off any time", tech: "Revocable capability URLs, served noindex" },
    ],
  },
  {
    id: "identity", icon: KeyRound, tone: "blue", title: "Sign-in & accounts",
    lead: { plain: "Sign in with email, Google or GitHub. Risky actions ask you to prove it's you.", tech: "Supabase Auth with OAuth 2.0 (Google, GitHub) and hashed passwords." },
    points: [
      { plain: "Passwords are never stored readable", tech: "bcrypt hashes; strength meter at sign-up" },
      { plain: "Deleting your account needs a fresh sign-in", tech: "10-minute re-auth window from JWT amr claims" },
      { plain: "Login links can't bounce you to fake sites", tech: "Allow-listed redirects (safeRedirect)" },
    ],
  },
  {
    id: "payments", icon: CreditCard, tone: "emerald", title: "Payments you can trust",
    lead: { plain: "Your card details never touch our servers, and you're never charged twice.", tech: "Razorpay Checkout handles card data; we store a subscription ID only." },
    points: [
      { plain: "Payments are confirmed with a secure signature", tech: "HMAC-SHA256 verification, constant-time compare" },
      { plain: "Repeated payment messages are ignored", tech: "Webhook replay dedupe (webhook_events)" },
      { plain: "Credits come back if something fails", tech: "Atomic spend in Postgres, auto-refund on error" },
    ],
  },
  {
    id: "ai", icon: Bot, tone: "amber", title: "AI guardrails",
    lead: { plain: "The assistant helps you build. It can't be tricked into touching anything else.", tech: "Prompt-injection hardening on the way in, strict validation on the way out." },
    points: [
      { plain: "Text in a project can't hijack the AI", tech: "Untrusted data fenced so it can't close its block" },
      { plain: "AI changes are checked before they land", tech: "Schema-validated graph ops with size caps" },
      { plain: "Our AI keys never reach your browser", tech: "Gemini called server-side; global rate limit" },
    ],
  },
  {
    id: "sandbox", icon: Cpu, tone: "cyan", title: "Sandboxed engine",
    lead: { plain: "Simulations run on your own device, sealed off from everything else.", tech: "SimPy compiled to WebAssembly (Pyodide), isolated in a Web Worker." },
    points: [
      { plain: "Your model never runs on our servers", tech: "Client-side execution; only results are saved" },
      { plain: "Generated code can't do anything unexpected", tech: "Injection-safe Python code generator" },
      { plain: "Exported reports are safe to open", tech: "HTML report output escaped against XSS" },
    ],
  },
  {
    id: "resilience", icon: LifeBuoy, tone: "rose", title: "Ready for scale",
    lead: { plain: "Built to keep working when something goes wrong, and to grow with you.", tech: "Graceful degradation at every external dependency." },
    points: [
      { plain: "A built-in engine takes over if Python can't load", tech: "Automatic fallback simulation engine" },
      { plain: "If one AI model is busy, another answers", tech: "Ordered Gemini model fallback with retries" },
      { plain: "Handles busy days without slowing down", tech: "Serverless on Vercel; shared Postgres rate limiter" },
    ],
  },
];

const PARTNERS = [
  { name: "Supabase", note: "SOC 2 Type II infrastructure" },
  { name: "Razorpay", note: "PCI DSS Level 1 payments" },
  { name: "Vercel", note: "Global edge network" },
];

/** Crossfades between the plain and technical wording. */
function Swap({ mode, line, className = "" }: { mode: Mode; line: Line; className?: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={mode}
        className={`block ${className}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18 }}
      >
        {line[mode]}
      </motion.span>
    </AnimatePresence>
  );
}

function ModeToggle({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <LayoutGroup id="security-mode">
      <div role="radiogroup" aria-label="How to explain our security" className="mx-auto mb-10 flex w-max rounded-full border border-ln-ecebf7 bg-surface p-1 shadow-[0_10px_30px_-18px_rgba(16,24,40,.3)]">
        {([["plain", "In plain English"], ["tech", "For engineers"]] as const).map(([m, label]) => (
          <button
            key={m}
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`relative rounded-full px-4 py-2 text-[13px] font-semibold transition-colors sm:px-5 ${mode === m ? "text-white" : "text-fg-64748b hover:text-fg-161622"}`}
          >
            {mode === m && <motion.span layoutId="security-mode-pill" className="absolute inset-0 rounded-full bg-gradient-to-b from-sf-6a57ff to-sf-5742ff shadow-[0_6px_16px_-6px_rgba(87,66,255,.7)]" transition={spring(20, 0.85)} />}
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>
    </LayoutGroup>
  );
}

/** Dark hero card: a request travelling through the four layers, checked at each one. */
function DefenseInDepth({ mode }: { mode: Mode }) {
  const LOOP = 5;
  return (
    <div className="relative h-full overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-sf-1e1b4b via-sf-191733 to-sf-110f1f p-6 text-white shadow-[0_30px_70px_-30px_rgba(87,66,255,.55)] md:p-8">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sf-5742ff/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,.07)_1px,transparent_1.5px)] [background-size:22px_22px] [mask-image:linear-gradient(160deg,#000,transparent_75%)]" />
      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/80 ring-1 ring-white/15">
          <ShieldCheck size={13} aria-hidden /> Defense in depth
        </span>
        <h3 className="mt-4 font-space text-[24px] font-bold leading-tight tracking-[-0.02em] md:text-[28px]">Four checkpoints. Every request.</h3>
        <Swap
          mode={mode}
          className="mt-2 max-w-md text-[13.5px] leading-relaxed text-white/70"
          line={{
            plain: "Before anything reaches your data it has to pass four independent locks. If one were ever bypassed, the next still holds.",
            tech: "Independent controls at the client, transport, application and data layers, so no single failure exposes tenant data.",
          }}
        />
      </div>

      <div className="relative mt-7 flex gap-4">
        {/* Rail with the travelling request */}
        <div aria-hidden className="relative w-6 shrink-0">
          <div className="absolute inset-y-3 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-white/5 via-white/25 to-white/5" />
          <motion.div
            className="absolute left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-sf-a78bfa shadow-[0_0_0_4px_rgba(167,139,250,.25),0_0_18px_rgba(167,139,250,.9)]"
            animate={{ top: ["4%", "92%", "92%"] }}
            transition={{ duration: LOOP, times: [0, 0.88, 1], ease: "easeInOut", repeat: Infinity }}
          />
        </div>
        <ol className="flex-1 space-y-2.5">
          {LAYERS.map((l, i) => {
            const peak = i * 0.22 + 0.1;
            return (
              <li key={l.name} className="flex items-start gap-3 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10 backdrop-blur-sm sm:items-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-fg-c4b5fd">
                  <l.icon size={17} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-bold">{i + 1}. {l.name}</div>
                  <Swap mode={mode} line={l.check} className="text-[12px] leading-snug text-white/65" />
                </div>
                <motion.span
                  aria-hidden
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sf-34d399/20 text-fg-6ee7b7"
                  animate={{ opacity: [0.35, 0.35, 1, 0.35, 0.35], scale: [1, 1, 1.2, 1, 1] }}
                  transition={{ duration: LOOP, times: [0, peak - 0.05, peak, peak + 0.12, 1], repeat: Infinity }}
                >
                  <Check size={13} strokeWidth={3} />
                </motion.span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

const ACCESS = [
  { who: { plain: "Owner", tech: "owner" }, view: true, edit: true },
  { who: { plain: "Editors you invite", tech: "editor" }, view: true, edit: true },
  { who: { plain: "Viewers you invite", tech: "viewer" }, view: true, edit: false },
  { who: { plain: "Everyone else", tech: "anon · other tenants" }, view: false, edit: false },
];

/** Who can do what on a project: the roles the database enforces. */
function AccessMatrix({ mode }: { mode: Mode }) {
  const mark = (ok: boolean) => (
    <span className={`mx-auto flex h-5 w-5 items-center justify-center rounded-full ${ok ? "bg-sf-ecfdf5 text-fg-059669" : "bg-sf-fff1f2 text-fg-e11d48"}`}>
      {ok ? <Check size={11} strokeWidth={3} aria-label="Allowed" /> : <X size={11} strokeWidth={3} aria-label="Blocked" />}
    </span>
  );
  return (
    <div className="relative mt-6 overflow-hidden rounded-2xl border border-ln-ecebf7">
      <div className="flex items-center justify-between bg-ink/[0.03] px-4 py-2.5">
        <Swap mode={mode} className="text-[12px] font-bold text-fg-161622" line={{ plain: "Who can access a project?", tech: "Policy matrix (RLS)" }} />
        <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-fg-94a3b8">View · Edit</span>
      </div>
      <table className="w-full text-[12.5px]">
        <tbody>
          {ACCESS.map((r) => (
            <tr key={r.who.plain} className="border-t border-ln-f1f0fa">
              <td className="px-4 py-2 text-fg-334155"><Swap mode={mode} line={r.who} className={mode === "tech" ? "font-mono text-[11.5px]" : ""} /></td>
              <td className="w-12 py-2">{mark(r.view)}</td>
              <td className="w-12 py-2 pr-2">{mark(r.edit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FeatureCard({ f, mode, extra }: { f: Feature; mode: Mode; extra?: React.ReactNode }) {
  const t = TONES[f.tone];
  return (
    <motion.article
      whileHover={{ y: -5 }}
      transition={spring(18, 0.8)}
      className={`group relative flex h-full flex-col overflow-hidden rounded-[28px] border border-ln-ecebf7 bg-surface p-6 shadow-[0_1px_2px_rgba(16,24,40,.04),0_20px_44px_-34px_rgba(16,24,40,.35)] transition-colors md:p-7 ${t.ring}`}
    >
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" style={{ background: t.glow }} />
      <div className="relative flex items-center gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${t.tile} transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105`}>
          <f.icon size={20} strokeWidth={2.1} aria-hidden />
        </span>
        <h3 className="font-space text-[18px] font-bold tracking-[-0.02em] text-fg-161622">{f.title}</h3>
      </div>
      <Swap mode={mode} line={f.lead} className="relative mt-4 min-h-[3.2em] text-[13.5px] leading-relaxed text-fg-64748b" />
      <ul className="relative mt-5 space-y-2.5 border-t border-ln-f1f0fa pt-5">
        {f.points.map((p) => (
          <li key={p.plain} className="flex items-start gap-2.5 text-[13px] leading-snug text-fg-334155">
            <span className={`mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-ink/[0.04] ${t.check}`}>
              <Check size={11} strokeWidth={3} aria-hidden />
            </span>
            <Swap mode={mode} line={p} />
          </li>
        ))}
      </ul>
      {extra && <div className="mt-auto">{extra}</div>}
    </motion.article>
  );
}

export default function SecurityPricingSection() {
  const [mode, setMode] = useState<Mode>("plain");
  const [first, ...rest] = FEATURES;
  return (
    <section id="security" className="relative overflow-hidden bg-surface px-4 py-20 md:py-32 dark:bg-sf-fcfcff">
      <Backdrop tone="a" />
      <div className="relative z-10 mx-auto max-w-7xl">
        <SectionHeader
          title="Built for Security."
          accent="Ready for Scale."
          sub="Security isn't a feature we bolted on. Every layer of JustCmul8 is designed so your models, results and payments stay private, correct and available."
        />
        <ModeToggle mode={mode} setMode={setMode} />

        <Stagger className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3" gap={0.07}>
          <StaggerItem className="md:col-span-2">
            <DefenseInDepth mode={mode} />
          </StaggerItem>
          <StaggerItem className="h-full">
            <FeatureCard f={first} mode={mode} extra={<AccessMatrix mode={mode} />} />
          </StaggerItem>
          {rest.map((f) => (
            <StaggerItem key={f.id} className="h-full">
              <FeatureCard f={f} mode={mode} />
            </StaggerItem>
          ))}
          {/* Privacy & ownership: what you control */}
          <StaggerItem className="md:col-span-2 lg:col-span-1 h-full">
            <motion.article
              whileHover={{ y: -5 }}
              transition={spring(18, 0.8)}
              className="relative flex h-full flex-col overflow-hidden rounded-[28px] border border-ln-e4defd bg-gradient-to-br from-sf-f6f4ff to-surface p-6 md:p-7"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sf-5742ff text-white shadow-[0_8px_20px_-8px_rgba(87,66,255,.7)]">
                  <UserCheck size={20} aria-hidden />
                </span>
                <h3 className="font-space text-[18px] font-bold tracking-[-0.02em] text-fg-161622">Your data, your rules</h3>
              </div>
              <Swap
                mode={mode}
                className="mt-4 text-[13.5px] leading-relaxed text-fg-64748b"
                line={{ plain: "We don't sell your data or follow you around the web. You can take it with you or delete it, any time.", tech: "No analytics or ad trackers. Minimal collection, full export, cascade delete on account removal." }}
              />
              <ul className="mt-5 space-y-2.5 border-t border-ln-e4defd pt-5">
                {[
                  { plain: "Export results as CSV, HTML or PDF", tech: "CSV / HTML / PDF exports, no lock-in" },
                  { plain: "One click deletes your account and everything in it", tech: "Projects, runs and chat history purged on delete" },
                  { plain: "Terms and privacy written in plain language", tech: "Documented processors and retention" },
                ].map((p) => (
                  <li key={p.plain} className="flex items-start gap-2.5 text-[13px] leading-snug text-fg-334155">
                    <span className="mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-sf-5742ff/10 text-fg-5742ff">
                      <Check size={11} strokeWidth={3} aria-hidden />
                    </span>
                    <Swap mode={mode} line={p} />
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex flex-wrap gap-2 pt-6">
                <Link href="/privacy" className="inline-flex items-center gap-1 rounded-full bg-surface px-3.5 py-2 text-[12.5px] font-semibold text-fg-5742ff ring-1 ring-ln-e4defd transition-colors hover:bg-sf-f3f1ff">
                  Privacy Policy <ArrowRight size={13} aria-hidden />
                </Link>
                <Link href="/terms" className="inline-flex items-center gap-1 rounded-full bg-surface px-3.5 py-2 text-[12.5px] font-semibold text-fg-5742ff ring-1 ring-ln-e4defd transition-colors hover:bg-sf-f3f1ff">
                  Terms <ArrowRight size={13} aria-hidden />
                </Link>
              </div>
            </motion.article>
          </StaggerItem>
        </Stagger>

        {/* Partners + responsible disclosure */}
        <Reveal delay={0.05}>
          <div className="mt-5 flex flex-col gap-5 rounded-[28px] border border-ln-ecebf7 bg-surface p-5 md:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-fg-94a3b8">Built on</span>
              {PARTNERS.map((p) => (
                <span key={p.name} className="inline-flex items-center gap-2 rounded-full bg-ink/[0.035] px-3.5 py-2 text-[12.5px] text-fg-64748b">
                  <ShieldCheck size={14} className="text-fg-059669" aria-hidden />
                  <b className="font-bold text-fg-161622">{p.name}</b> {p.note}
                </span>
              ))}
            </div>
            <a
              href="mailto:hello@justcmul8.com?subject=Security%20report"
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-ln-ecebf7 px-4 py-2.5 text-[13px] font-semibold text-fg-161622 transition-colors hover:border-ln-c4b5fd hover:text-fg-5742ff lg:self-auto"
            >
              <Bug size={15} aria-hidden /> Found a vulnerability? Tell us
            </a>
          </div>
        </Reveal>

        <PricingSection />
      </div>
    </section>
  );
}
