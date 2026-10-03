"use client";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "framer-motion";
import {
  AlertTriangle, ArrowRight, Bug, Building2, CalendarDays, Check, ChevronDown, CreditCard, HelpCircle, KeyRound, Loader2, Lock, Mail,
  MessageCircle, Settings, ShieldCheck, Sparkles, User, Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/layout/Navbar";
import { toast } from "@/components/ui/Toast";
import { Backdrop, SplitWords, spring } from "@/components/landing/motionKit";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import type { SimTypeId } from "@/lib/simulation/types";
import { CREDIT_COSTS, PLAN_CREDITS, PRO_FEATURES, PRO_PRICE, TRIAL_DAYS, type Billing, type Interval } from "@/lib/billing/plans";
import { startProCheckout } from "@/lib/billing/checkout";
import {
  CreditsScene, FlowField, LineInput, PillChoice, ProfileScene, ROLES, Stage, TEAM_SIZES, Ticker, WorldScene, sceneFor, usePointer,
} from "@/components/onboarding/OnboardingStage";

const TABS = [
  { id: "profile", icon: User, label: "Profile", eyebrow: "Profile settings", title: "Shape how", accent: "people see you.", sub: "Your name, role and team appear on shared projects and in comments. Watch your block update live." },
  { id: "account", icon: Settings, label: "Account", eyebrow: "Account settings", title: "Tune your", accent: "workspace.", sub: "Pick the domain new simulations start in, keep your password fresh, and manage your data." },
  { id: "billing", icon: CreditCard, label: "Billing", eyebrow: "Billing & subscription", title: "Plan &", accent: "credits.", sub: "See your balance, where your credits went, and change or cancel your plan any time." },
  { id: "help", icon: HelpCircle, label: "Help", eyebrow: "Help & support", title: "How can we", accent: "help?", sub: "Quick answers to common questions, or reach a real person on our team." },
] as const;
type TabId = (typeof TABS)[number]["id"];
const isTab = (t: string | null): t is TabId => TABS.some((x) => x.id === t);

const label = "text-[11px] font-bold uppercase tracking-[0.14em] text-[#94a3b8]";
const card = "relative rounded-[26px] border border-[#ecebf7] bg-white/85 p-5 sm:p-6 shadow-[0_1px_2px_rgba(16,24,40,.04),0_24px_50px_-36px_rgba(87,66,255,.35)] backdrop-blur";
const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

/** Gradient pill button with the landing page's sheen. */
function PrimaryButton({ busy, done, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean; done?: boolean }) {
  return (
    <motion.button
      {...(props as React.ComponentProps<typeof motion.button>)}
      whileHover={props.disabled ? undefined : { scale: 1.03 }}
      whileTap={props.disabled ? undefined : { scale: 0.97 }}
      className="group relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-b from-[#6a57ff] to-[#5742FF] border border-[#8d80ff] px-7 text-[14.5px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(87,66,255,.8),inset_0_1px_0_rgba(255,255,255,.35)] disabled:opacity-45"
    >
      {!props.disabled && <span aria-hidden className="lp-sheen pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/25 to-transparent" />}
      {busy && <Loader2 size={16} className="animate-spin" />}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={done ? "done" : "idle"} className="relative flex items-center gap-2" initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={spring(18, 0.8)}>
          {done ? <><Check size={16} strokeWidth={3} /> Saved</> : children}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

function CardHead({ icon: Icon, title, sub, danger }: { icon: React.ElementType; title: string; sub: string; danger?: boolean }) {
  return (
    <div className="mb-5 flex items-start gap-3.5">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 hover:rotate-[-8deg] ${danger ? "bg-red-50 text-red-500" : "bg-[#f5f3ff] text-[#5742FF]"}`}>
        <Icon size={18} strokeWidth={2.3} />
      </span>
      <div>
        <h2 className={`font-space text-[18px] font-bold tracking-[-0.02em] ${danger ? "text-red-600" : "text-[#161622]"}`}>{title}</h2>
        <p className="text-[13px] text-[#64748b]">{sub}</p>
      </div>
    </div>
  );
}

/** Children rise in one after another. */
function Rise({ i, children, className = "" }: { i: number; children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring(13, 0.85, 0.15 + i * 0.07), opacity: { duration: 0.35, delay: 0.15 + i * 0.07 } }}>
      {children}
    </motion.div>
  );
}

/* ─────────────────────────── Billing ─────────────────────────── */

function BillingPanel({ billing, ledger, email, name, onChange }: {
  billing: Billing | null; ledger: { id: number; delta: number; reason: string; created_at: string }[]; email: string; name: string; onChange: () => void;
}) {
  const [interval, setBillingInterval] = useState<Interval>("monthly");
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function upgrade() {
    setBusy(true);
    try {
      const b = await startProCheckout(interval, { email, name });
      if (b) { toast.success(b.status === "trialing" ? `Your ${TRIAL_DAYS}-day Pro trial has started.` : "You're on Pro now.", "Welcome to Pro"); onChange(); }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed", "Upgrade failed");
    }
    setBusy(false);
  }

  async function cancel() {
    setBusy(true);
    const res = await fetch("/api/billing/cancel", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (res.ok) { toast.success(billing?.status === "trialing" ? "Trial cancelled. You won't be charged." : "Your plan will end at the close of this billing period."); onChange(); }
    else toast.error(body.error || "Couldn't cancel");
    setBusy(false); setConfirmCancel(false);
  }

  if (!billing) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#5742FF]" /></div>;

  const pro = billing.plan !== "free";
  const allowance = PLAN_CREDITS[billing.plan];
  const pct = Math.min(100, (billing.credits / allowance) * 100);
  const statusLine =
    !pro ? "Free plan" :
    billing.status === "trialing" ? `Trial · first charge on ${fmtDate(billing.trial_ends_at)}` :
    billing.status === "past_due" ? "Payment failed, Razorpay is retrying. Update your card from the Razorpay email." :
    billing.cancel_at_period_end ? `Ends on ${fmtDate(billing.current_period_end)}` :
    `Billed ${billing.billing_interval} · renews ${fmtDate(billing.current_period_end)}`;

  return (
    <div className="space-y-4">
      {/* Plan hero */}
      <Rise i={0}>
        <div className={`relative overflow-hidden rounded-[26px] p-6 ${pro ? "bg-gradient-to-br from-[#7a67ff] via-[#5742FF] to-[#4a36e6] text-white shadow-[0_30px_60px_-24px_rgba(87,66,255,.75)]" : card}`}>
          {pro && <>
            <span aria-hidden className="lp-sheen pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            <span aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.12) 1px, transparent 1.5px)", backgroundSize: "18px 18px", maskImage: "linear-gradient(180deg,#000,transparent 70%)", WebkitMaskImage: "linear-gradient(180deg,#000,transparent 70%)" }} />
          </>}
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className={`text-[11px] font-bold uppercase tracking-[0.14em] ${pro ? "text-white/70" : "text-[#94a3b8]"}`}>Current plan</p>
              <p className="mt-1 flex items-center gap-2 font-space text-[30px] font-bold leading-none tracking-[-0.03em]">
                {pro ? (billing.plan === "enterprise" ? "Enterprise" : "Pro") : "Free"}
                {billing.status === "trialing" && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold tracking-normal text-[#5742FF]">TRIAL</span>}
              </p>
              <p className={`mt-2 max-w-[340px] text-[13px] ${pro ? "text-white/80" : "text-[#64748b]"}`}>{statusLine}</p>
            </div>
            <div className="text-right">
              <p className="font-space text-[38px] font-bold leading-none tracking-[-0.04em] tabular-nums">
                <motion.span initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring(14, 0.7, 0.3)}>{billing.credits}</motion.span>
                <span className={`text-[14px] font-semibold ${pro ? "text-white/60" : "text-[#94a3b8]"}`}> / {allowance}</span>
              </p>
              <p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${pro ? "text-white/70" : "text-[#94a3b8]"}`}>credits left</p>
            </div>
          </div>
          <div className={`relative mt-5 h-2.5 overflow-hidden rounded-full ${pro ? "bg-white/20" : "bg-[#f1f0fa]"}`}>
            <motion.div className={`h-full rounded-full ${pro ? "bg-white" : "bg-gradient-to-r from-[#8b5cf6] to-[#5742FF]"}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.35 }} />
          </div>
          <p className={`relative mt-2 text-[12px] font-medium ${pro ? "text-white/70" : "text-[#94a3b8]"}`}>Refills to {allowance} on {fmtDate(billing.credits_reset_at)}</p>
        </div>
      </Rise>

      {/* Upgrade / manage */}
      <Rise i={1}>
        <div className={card}>
          {!pro ? (
            <>
              <CardHead icon={Zap} title="Upgrade to Pro" sub={`${PLAN_CREDITS.pro} credits a month, plus ${PRO_FEATURES.join(", ")}.`} />
              <div className="flex flex-wrap items-center justify-between gap-4">
                <LayoutGroup id="settings-bill">
                  <div className="inline-flex rounded-full bg-black/[0.04] p-1 text-[13px] font-bold shadow-[inset_0_1px_2px_rgba(16,24,40,.06)]">
                    {(["monthly", "yearly"] as const).map((b) => (
                      <button key={b} type="button" onClick={() => setBillingInterval(b)} className="relative rounded-full px-4 py-2">
                        {interval === b && <motion.span layoutId="settings-bill-pill" className="absolute inset-0 rounded-full bg-white shadow-[0_2px_8px_-2px_rgba(16,24,40,.18)]" transition={spring(20, 0.85)} />}
                        <span className={`relative ${interval === b ? "text-[#161622]" : "text-[#64748b]"}`}>
                          ${PRO_PRICE[b]}/mo {b === "yearly" && <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">−20%</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                </LayoutGroup>
                <PrimaryButton onClick={upgrade} disabled={busy} busy={busy}>
                  {billing.trial_used ? "Upgrade to Pro" : `Start ${TRIAL_DAYS}-day free trial`} <ArrowRight size={16} />
                </PrimaryButton>
              </div>
            </>
          ) : (
            <>
              <CardHead icon={ShieldCheck} title="Manage subscription" sub="Payments are handled securely by Razorpay." />
              <AnimatePresence mode="wait" initial={false}>
                {billing.cancel_at_period_end ? (
                  <motion.p key="sched" className="text-[13.5px] text-[#64748b]" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    Cancellation scheduled. You keep Pro until <b className="text-[#161622]">{fmtDate(billing.current_period_end)}</b>.
                  </motion.p>
                ) : !confirmCancel ? (
                  <motion.button key="ask" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} onClick={() => setConfirmCancel(true)} className="h-11 rounded-full border border-[#e7e5f6] bg-white px-5 text-[14px] font-semibold text-[#334155] transition-colors hover:border-red-300 hover:text-red-600">
                    {billing.status === "trialing" ? "Cancel trial" : "Cancel subscription"}
                  </motion.button>
                ) : (
                  <motion.div key="confirm" className="rounded-2xl border border-red-100 bg-red-50/60 p-4" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={spring(16, 0.8)}>
                    <p className="text-[13.5px] text-[#475569]">{billing.status === "trialing" ? "You'll go back to Free right away and won't be charged." : "You'll keep Pro until the end of this period, then move to Free."}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={cancel} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-full bg-red-500 border border-red-400 px-5 text-[13.5px] font-semibold text-white hover:bg-red-600 disabled:opacity-50">
                        {busy && <Loader2 size={15} className="animate-spin" />} Yes, cancel
                      </button>
                      <button onClick={() => setConfirmCancel(false)} className="h-10 rounded-full px-5 text-[13.5px] font-semibold text-[#475569] hover:bg-black/[0.04]">Keep Pro</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </Rise>

      {/* Activity */}
      <Rise i={2}>
        <div className={card}>
          <CardHead icon={Sparkles} title="Credit activity" sub={`New simulation ${CREDIT_COSTS.create_simulation} · AI optimize ${CREDIT_COSTS.ai_optimize} · AI chat ${CREDIT_COSTS.ai_chat}. Running simulations is free.`} />
          {ledger.length === 0 ? (
            <p className="rounded-2xl bg-[#fafaff] px-4 py-6 text-center text-[13px] text-[#94a3b8]">No credit activity yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {ledger.map((l, i) => (
                <motion.li
                  key={l.id}
                  className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-[#fafaff]"
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: 0.4 + i * 0.05 }}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${l.delta < 0 ? "bg-[#5742FF]" : "bg-emerald-500"}`} />
                    <span className="truncate text-[13.5px] font-semibold capitalize text-[#334155]">{l.reason.replace(/_/g, " ")}</span>
                    <span className="shrink-0 text-[12px] text-[#94a3b8]">{fmtDate(l.created_at)}</span>
                  </span>
                  <span className={`font-mono text-[13px] font-bold tabular-nums ${l.delta < 0 ? "text-[#161622]" : "text-emerald-600"}`}>{l.delta > 0 ? "+" : ""}{l.delta}</span>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </Rise>
    </div>
  );
}

/* ─────────────────────────── Help ─────────────────────────── */

const FAQ = [
  { q: "How do credits work?", a: `Creating a simulation costs ${CREDIT_COSTS.create_simulation} credits, AI optimization ${CREDIT_COSTS.ai_optimize}, and each AI chat message ${CREDIT_COSTS.ai_chat}. Running and re-running simulations is always free. Free gets ${PLAN_CREDITS.free} credits a month, Pro gets ${PLAN_CREDITS.pro}.` },
  { q: "Can I cancel any time?", a: "Yes. Cancelling a trial moves you back to Free immediately with no charge. Cancelling a paid plan keeps Pro until the end of the current billing period." },
  { q: "How do I share a project?", a: `Open a project and use Share. Pro unlocks ${PRO_FEATURES.join(", ")}.` },
  { q: "What happens when I delete my account?", a: "All your projects, simulation history and chat history are permanently removed. This can't be undone." },
];

function HelpPanel() {
  const [open, setOpen] = useState<number | null>(0);
  const contacts = [
    { icon: Mail, title: "Email support", sub: "We reply within a day", href: "mailto:hello@justcmul8.com" },
    { icon: Bug, title: "Report a bug", sub: "Tell us what broke", href: "mailto:hello@justcmul8.com?subject=Bug%20report" },
    { icon: Building2, title: "Talk to sales", sub: "Teams, SSO, invoicing", href: "mailto:hello@justcmul8.com?subject=Enterprise%20plan" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {contacts.map((c, i) => (
          <Rise key={c.title} i={i}>
            <motion.a
              href={c.href}
              whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }} transition={spring(16, 0.75)}
              className={`${card} group flex h-full flex-col gap-3 !p-4`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5f3ff] text-[#5742FF] transition-all duration-300 group-hover:rotate-[-8deg] group-hover:bg-[#5742FF] group-hover:text-white">
                <c.icon size={18} strokeWidth={2.3} />
              </span>
              <span>
                <span className="flex items-center gap-1 text-[14px] font-bold text-[#161622]">{c.title} <ArrowRight size={13} className="opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" /></span>
                <span className="text-[12px] text-[#64748b]">{c.sub}</span>
              </span>
            </motion.a>
          </Rise>
        ))}
      </div>

      <Rise i={3}>
        <div className={card}>
          <CardHead icon={MessageCircle} title="Common questions" sub="The things people ask us most." />
          <div className="space-y-2">
            {FAQ.map((f, i) => {
              const on = open === i;
              return (
                <div key={f.q} className={`rounded-2xl border transition-colors ${on ? "border-[#d9d3fb] bg-[#fafaff]" : "border-[#f1f0fa]"}`}>
                  <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : i)} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-[14px] font-bold text-[#161622]">
                    {f.q}
                    <motion.span animate={{ rotate: on ? 180 : 0 }} transition={spring(18, 0.8)} className={on ? "text-[#5742FF]" : "text-[#94a3b8]"}><ChevronDown size={16} /></motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {on && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                        <p className="px-4 pb-4 text-[13.5px] leading-relaxed text-[#64748b]">{f.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </Rise>
    </div>
  );
}

/** Help preview: your message travels to the team and a reply comes back. */
function SupportScene() {
  const out = "M150 200 C 260 120, 380 120, 490 200";
  const back = "M490 200 C 380 280, 260 280, 150 200";
  return (
    <div className="absolute inset-0 flex items-center justify-center px-4 pb-16 pt-4 sm:pl-16">
      <div className="relative w-full max-w-[640px]" style={{ aspectRatio: "640 / 400" }}>
        <svg viewBox="0 0 640 400" className="absolute inset-0 h-full w-full overflow-visible">
          {[out, back].map((d, i) => (
            <g key={i}>
              <motion.path d={d} fill="none" stroke={i ? "#10b981" : "#5742FF"} strokeOpacity={0.35} strokeWidth={2.5} strokeDasharray="6 6" className="lp-dash" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.3 + i * 0.4 }} />
              {[0, 1, 2].map((k) => (
                <circle key={k} r={6} fill="#fff" stroke={i ? "#10b981" : "#5742FF"} strokeWidth={2.5}>
                  <animateMotion dur="3.6s" begin={`${i * 1.8 + k * 1.2}s`} repeatCount="indefinite" path={d} />
                </circle>
              ))}
            </g>
          ))}
        </svg>
        {[
          { x: 150, icon: User, t: "You", s: "Ask anything", c: "#5742FF" },
          { x: 490, icon: MessageCircle, t: "Our team", s: "Replies within a day", c: "#10b981" },
        ].map((n, i) => (
          <motion.div
            key={n.t}
            className="absolute flex w-[150px] -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-[20px] border border-[#e6e2fb] bg-white p-3.5 text-center shadow-[0_30px_60px_-24px_rgba(87,66,255,.45)]"
            style={{ left: `${(n.x / 640) * 100}%`, top: "50%" }}
            initial={{ opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={spring(12, 0.7, 0.15 + i * 0.15)}
          >
            <span className="lp-float flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ background: n.c, animationDelay: `${i * 0.8}s` }}><n.icon size={20} /></span>
            <p className="mt-2 font-space text-[14px] font-bold text-[#161622]">{n.t}</p>
            <p className="text-[11px] font-semibold text-[#94a3b8]">{n.s}</p>
          </motion.div>
        ))}
        <motion.div className="absolute left-1/2 top-[18%] -translate-x-1/2 rounded-full border border-[#ecebf7] bg-white px-3 py-1 text-[11px] font-bold text-[#5742FF] shadow-sm" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
          hello@justcmul8.com
        </motion.div>
        <motion.div className="absolute bottom-[14%] left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-600" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}>
          <Check size={12} strokeWidth={3} /> Real humans, no bots
        </motion.div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Page ─────────────────────────── */

function passwordScore(p: string) {
  return [p.length >= 8, p.length >= 12, /[a-z]/.test(p) && /[A-Z]/.test(p), /\d/.test(p) && /[^A-Za-z0-9]/.test(p)].filter(Boolean).length;
}
const STRENGTH = [
  { t: "Too short", c: "#ef4444" }, { t: "Weak", c: "#f97316" }, { t: "Okay", c: "#eab308" }, { t: "Good", c: "#22c55e" }, { t: "Strong", c: "#10b981" },
];

function SettingsInner() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useSearchParams();
  const pointer = usePointer();
  const tabParam = params.get("tab");
  const tab: TabId = isTab(tabParam) ? tabParam : "profile";
  const [prevTab, setPrevTab] = useState<TabId>(tab);
  const dir = TABS.findIndex((t) => t.id === tab) >= TABS.findIndex((t) => t.id === prevTab) ? 1 : -1;

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [defaultSimType, setDefaultSimType] = useState<SimTypeId>("human_queue");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [ledger, setLedger] = useState<{ id: number; delta: number; reason: string; created_at: string }[]>([]);

  function selectTab(t: TabId) {
    setPrevTab(tab);
    window.history.replaceState(null, "", `?tab=${t}`); // shallow: no server round trip
  }

  useEffect(() => {
    // Old deep link: /settings#plan
    if (window.location.hash === "#plan") router.replace("/settings?tab=billing", { scroll: false });
    load();
    refreshBilling();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setUserId(user.id);
    setEmail(user.email || "");
    setJoined(user.created_at);
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (profile) {
      setName(profile.display_name || "");
      setRole(profile.job_role || "");
      setCompany(profile.company || "");
      setTeamSize(profile.team_size || "");
      setDefaultSimType(profile.default_sim_type || "human_queue");
    } else {
      await supabase.from("profiles").upsert({ id: user.id, display_name: "" });
    }
    setLoading(false);
  }

  async function refreshBilling() {
    const res = await fetch("/api/billing");
    if (res.ok) setBilling(await res.json());
    const { data } = await supabase.from("credit_ledger").select("id, delta, reason, created_at").order("created_at", { ascending: false }).limit(6);
    setLedger(data || []);
  }

  async function saveProfile() {
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: userId, display_name: name.trim(), job_role: role || null, company: company.trim() || null, team_size: teamSize || null,
      default_sim_type: defaultSimType, updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { toast.error(error.message, "Couldn't save"); return; }
    setSaved(true);
    toast.success("Your settings were saved.", "Saved");
    setTimeout(() => setSaved(false), 2000);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword.length < 8) { setPasswordMsg({ text: "Password must be at least 8 characters.", ok: false }); return; }
    if (newPassword !== confirmPassword) { setPasswordMsg({ text: "Passwords don't match.", ok: false }); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordMsg(error ? { text: error.message, ok: false } : { text: "Password updated.", ok: true });
    if (!error) { setNewPassword(""); setConfirmPassword(""); }
  }

  async function deleteAccount() {
    setDeleting(true);
    const res = await fetch("/api/account/delete", { method: "POST" });
    if (res.ok) {
      await supabase.auth.signOut();
      router.push("/");
    } else {
      setDeleting(false);
      setDeleteText("");
      toast.error("Couldn't delete your account. Please try again.");
    }
  }

  const meta = TABS.find((t) => t.id === tab)!;
  const tabIndex = TABS.indexOf(meta);
  const profileFields = [name.trim(), role, company.trim(), teamSize];
  const score = passwordScore(newPassword);
  const stage =
    tab === "profile" ? { label: "your-profile", status: "Profile complete", progress: profileFields.filter(Boolean).length / profileFields.length } :
    tab === "account" ? { label: "preferences", status: "Default domain", progress: 1 } :
    tab === "billing" ? { label: "plan-and-credits", status: "Credits left", progress: billing ? Math.min(1, billing.credits / PLAN_CREDITS[billing.plan]) : 0 } :
    { label: "support", status: "Average reply", progress: 0.9 };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative flex min-h-screen flex-col overflow-x-clip bg-[#fafaff]">
        <Backdrop tone="a" />
        <FlowField pointer={pointer} />
        <Navbar />

        <main className="relative z-10 mx-auto grid w-full max-w-[1400px] flex-1 gap-8 px-4 pb-16 pt-28 sm:px-8 sm:pt-32 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
          {/* ── Left: identity, tabs, panel ── */}
          <div className="min-w-0">
            {/* Identity strip */}
            <motion.div className="flex items-center gap-3.5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring(12, 0.85, 0.05)}>
              <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8b5cf6] to-[#5742FF] font-space text-[22px] font-bold text-white shadow-[0_14px_30px_-12px_rgba(87,66,255,.7)]">
                {(name || email || "?").trim().charAt(0).toUpperCase()}
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-[3px] border-[#fafaff] bg-emerald-500" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-space text-[17px] font-bold text-[#161622]">{name.trim() || (loading ? " " : "Add your name")}</p>
                <p className="flex flex-wrap items-center gap-x-3 text-[12.5px] font-medium text-[#64748b]">
                  <span className="truncate">{email}</span>
                  {joined && <span className="flex items-center gap-1 text-[#94a3b8]"><CalendarDays size={12} /> Joined {new Date(joined).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>}
                </p>
              </div>
            </motion.div>

            {/* Tab rail */}
            <LayoutGroup id="settings-tabs">
              <motion.div role="tablist" className="no-scrollbar mt-6 flex gap-1 overflow-x-auto rounded-full border border-[#ecebf7] bg-white/80 p-1.5 shadow-[0_1px_2px_rgba(16,24,40,.04)] backdrop-blur" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring(12, 0.85, 0.12)}>
                {TABS.map((t) => {
                  const on = t.id === tab;
                  return (
                    <button key={t.id} role="tab" aria-selected={on} onClick={() => selectTab(t.id)} className={`relative flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2.5 text-[13.5px] font-semibold transition-colors ${on ? "text-white" : "text-[#64748b] hover:text-[#161622]"}`}>
                      {on && <motion.span layoutId="settings-tab" className="absolute inset-0 rounded-full bg-gradient-to-b from-[#6a57ff] to-[#5742FF] border border-[#8d80ff] shadow-[0_8px_20px_-8px_rgba(87,66,255,.7)]" transition={spring(18, 0.8)} />}
                      <t.icon size={15} strokeWidth={2.3} className="relative" />
                      <span className="relative">{t.label}</span>
                    </button>
                  );
                })}
              </motion.div>
            </LayoutGroup>

            {/* Panel */}
            <AnimatePresence mode="wait" initial={false} custom={dir}>
              <motion.div
                key={tab}
                custom={dir}
                variants={{ enter: (d: number) => ({ opacity: 0, x: d * 40 }), center: { opacity: 1, x: 0 }, exit: (d: number) => ({ opacity: 0, x: d * -40 }) }}
                initial="enter" animate="center" exit="exit"
                transition={{ ...spring(13, 0.85), opacity: { duration: 0.25 } }}
                className="pt-8"
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-[#e7e3ff] bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5742FF]">
                  <span className="font-mono">{String(tabIndex + 1).padStart(2, "0")}</span>
                  <span className="h-3 w-px bg-[#d9d3fb]" />
                  {meta.eyebrow}
                </span>
                <h1 className="mt-3 font-space text-[2.1rem] font-bold leading-[1.04] tracking-[-0.035em] text-[#161622] sm:text-[2.6rem]">
                  <SplitWords key={meta.id} text={meta.title} accent={meta.accent} animateNow delay={0.05} />
                </h1>
                <motion.p className="mt-2.5 max-w-[500px] text-[14.5px] leading-relaxed text-[#64748b]" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
                  {meta.sub}
                </motion.p>

                <div className="mt-7">
                  {loading && tab !== "help" ? (
                    <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#5742FF]" /></div>
                  ) : tab === "profile" ? (
                    <div className="space-y-4">
                      <Rise i={0}>
                        <div className={card}>
                          <div className="space-y-6">
                            <div>
                              <label className={label} htmlFor="st-name">Display name</label>
                              <LineInput id="st-name" big value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" autoComplete="name" />
                            </div>
                            <div>
                              <p className={label}>What best describes you?</p>
                              <PillChoice
                                id="st-role" options={ROLES.map((r) => r.id)} value={role} onChange={setRole}
                                render={(o) => { const Icon = ROLES.find((r) => r.id === o)!.icon; return <><Icon size={14} strokeWidth={2.3} /> {o}</>; }}
                              />
                            </div>
                            <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
                              <div>
                                <label className={label} htmlFor="st-company">Company <span className="font-medium normal-case tracking-normal">(optional)</span></label>
                                <LineInput id="st-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Logistics" autoComplete="organization" />
                              </div>
                              <div>
                                <p className={label}>Team size</p>
                                <PillChoice id="st-team" options={TEAM_SIZES} value={teamSize} onChange={setTeamSize} />
                              </div>
                            </div>
                            <div>
                              <p className={label}>Email</p>
                              <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-[#ecebf7] bg-[#fafaff] px-3.5 py-2 text-[13.5px] font-semibold text-[#475569]">
                                <Mail size={14} className="text-[#94a3b8]" /> {email} <Lock size={12} className="text-[#cbd5e1]" />
                              </p>
                            </div>
                          </div>
                        </div>
                      </Rise>
                      <Rise i={1} className="flex justify-end">
                        <PrimaryButton onClick={saveProfile} disabled={saving} busy={saving} done={saved}>Save profile <ArrowRight size={16} /></PrimaryButton>
                      </Rise>
                    </div>
                  ) : tab === "account" ? (
                    <div className="space-y-4">
                      <Rise i={0}>
                        <div className={card}>
                          <CardHead icon={Sparkles} title="Default domain" sub="New projects start with these building blocks." />
                          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                            {Object.values(SIM_TYPE_REGISTRY).map((cfg, i) => {
                              const s = sceneFor(cfg.id);
                              const on = defaultSimType === cfg.id;
                              return (
                                <motion.button
                                  key={cfg.id} type="button" role="radio" aria-checked={on}
                                  onClick={() => setDefaultSimType(cfg.id as SimTypeId)}
                                  initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}
                                  transition={{ ...spring(14, 0.75, 0.25 + i * 0.04), opacity: { duration: 0.3, delay: 0.25 + i * 0.04 } }}
                                  className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border bg-white/90 p-3 text-left"
                                  style={{ borderColor: on ? s.color : "#ecebf7", boxShadow: on ? `0 0 0 3px ${s.color}22, 0 14px 30px -18px ${s.color}` : undefined }}
                                >
                                  <motion.span className="absolute inset-0 origin-left" style={{ background: `linear-gradient(90deg, ${s.tint}, transparent 80%)` }} initial={false} animate={{ scaleX: on ? 1 : 0 }} transition={spring(14, 0.9)} />
                                  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:rotate-[-6deg]" style={{ background: on ? s.color : s.tint, color: on ? "#fff" : s.color }}>
                                    <s.icon size={20} strokeWidth={2.2} />
                                  </span>
                                  <span className="relative min-w-0">
                                    <span className="block truncate text-[14px] font-bold text-[#161622]">{cfg.label}</span>
                                    <span className="block truncate text-[12px] text-[#64748b]">{s.examples.join(" · ")}</span>
                                  </span>
                                  <AnimatePresence>
                                    {on && (
                                      <motion.span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ background: s.color }} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={spring(18, 0.55)}>
                                        <Check size={11} strokeWidth={3.5} />
                                      </motion.span>
                                    )}
                                  </AnimatePresence>
                                </motion.button>
                              );
                            })}
                          </div>
                          <div className="mt-5 flex justify-end">
                            <PrimaryButton onClick={saveProfile} disabled={saving} busy={saving} done={saved}>Save preference</PrimaryButton>
                          </div>
                        </div>
                      </Rise>

                      <Rise i={1}>
                        <form onSubmit={changePassword} className={card}>
                          <CardHead icon={KeyRound} title="Password" sub="Use at least 8 characters. Mix cases, numbers and symbols for a strong one." />
                          <div className="grid gap-6 sm:grid-cols-2">
                            <div>
                              <label className={label} htmlFor="st-pw">New password</label>
                              <LineInput id="st-pw" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
                            </div>
                            <div>
                              <label className={label} htmlFor="st-pw2">Confirm password</label>
                              <LineInput id="st-pw2" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
                            </div>
                          </div>
                          <AnimatePresence>
                            {newPassword && (
                              <motion.div className="mt-4 flex items-center gap-3" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                                <div className="flex flex-1 gap-1.5">
                                  {[0, 1, 2, 3].map((i) => (
                                    <motion.span key={i} className="h-1.5 flex-1 rounded-full" initial={false} animate={{ backgroundColor: i < score ? STRENGTH[score].c : "#ecebf7" }} transition={{ duration: 0.25, delay: i * 0.05 }} />
                                  ))}
                                </div>
                                <span className="w-16 text-right text-[12px] font-bold" style={{ color: STRENGTH[score].c }}>{STRENGTH[score].t}</span>
                              </motion.div>
                            )}
                          </AnimatePresence>
                          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                            <AnimatePresence mode="wait">
                              {passwordMsg ? (
                                <motion.p key={passwordMsg.text} role="status" className={`text-[13px] font-semibold ${passwordMsg.ok ? "text-emerald-600" : "text-red-500"}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, x: passwordMsg.ok ? 0 : [0, -6, 6, -3, 3, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
                                  {passwordMsg.text}
                                </motion.p>
                              ) : <span />}
                            </AnimatePresence>
                            <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-full border border-[#e7e5f6] bg-white px-5 text-[14px] font-semibold text-[#334155] transition-colors hover:border-[#5742FF] hover:text-[#5742FF]">
                              <Lock size={14} /> Change password
                            </button>
                          </div>
                        </form>
                      </Rise>

                      <Rise i={2}>
                        <div className={`${card} !border-red-100`}>
                          <CardHead icon={AlertTriangle} danger title="Delete account" sub="Permanently removes all your projects, simulation history and chat history." />
                          <label className={label} htmlFor="st-del">Type <span className="font-mono text-red-500">DELETE</span> to confirm</label>
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            <input id="st-del" value={deleteText} onChange={(e) => setDeleteText(e.target.value)} placeholder="DELETE" className="h-11 w-40 rounded-full border border-red-100 bg-red-50/50 px-4 font-mono text-[14px] font-bold text-red-600 outline-none placeholder:text-red-200 focus:border-red-300 focus:shadow-[0_0_0_4px_rgba(239,68,68,.12)]" />
                            <motion.button
                              onClick={deleteAccount}
                              disabled={deleteText !== "DELETE" || deleting}
                              animate={{ opacity: deleteText === "DELETE" ? 1 : 0.4, scale: deleteText === "DELETE" ? 1 : 0.97 }}
                              transition={spring(16, 0.7)}
                              className="inline-flex h-11 items-center gap-2 rounded-full bg-red-500 border border-red-400 px-5 text-[14px] font-semibold text-white hover:bg-red-600"
                            >
                              {deleting && <Loader2 size={15} className="animate-spin" />} Permanently delete
                            </motion.button>
                          </div>
                        </div>
                      </Rise>
                    </div>
                  ) : tab === "billing" ? (
                    <BillingPanel billing={billing} ledger={ledger} email={email} name={name} onChange={refreshBilling} />
                  ) : (
                    <HelpPanel />
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Right: live preview ── */}
          <div className="order-first h-[320px] sm:h-[400px] lg:sticky lg:top-28 lg:order-none lg:h-[calc(100vh-9rem)] lg:min-h-[560px]">
            <Stage pointer={pointer} label={stage.label} domain={defaultSimType} progress={stage.progress} status={stage.status}>
              {tab === "profile" && <ProfileScene name={name} role={role} company={company} teamSize={teamSize} />}
              {tab === "account" && <WorldScene focus={defaultSimType} selected={[defaultSimType]} />}
              {tab === "billing" && <CreditsScene plan={billing && billing.plan !== "free" ? "pro" : "free"} interval={billing?.billing_interval ?? "monthly"} />}
              {tab === "help" && <SupportScene />}
            </Stage>
          </div>
        </main>
        <Ticker />
      </div>
    </MotionConfig>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fafaff]" />}>
      <SettingsInner />
    </Suspense>
  );
}
