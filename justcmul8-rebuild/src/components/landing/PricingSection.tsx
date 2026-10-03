"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Building2, Check, Gift, Minus, Rocket, Sparkles } from "lucide-react";
import { Reveal, SectionHeader, Stagger, StaggerItem, spring } from "@/components/landing/motionKit";
import FaqSection from "@/components/landing/FaqSection";

type Billing = "monthly" | "yearly";
type Plan = {
  id: string;
  name: string;
  tagline: string;
  icon: React.ElementType;
  price: { monthly: number; yearly: number } | null; // null = custom quote
  inherits?: string;
  features: string[];
  cta: string;
  href: string;
  featured?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "free", name: "Free", tagline: "For exploring and your first models.", icon: Gift,
    price: { monthly: 0, yearly: 0 },
    features: ["100 credits / month", "Full visual builder", "Real-time execution", "Standard KPIs", "JSON export"],
    cta: "Start for free", href: "/signup",
  },
  {
    id: "pro", name: "Pro", tagline: "For serious builders and professionals.", icon: Rocket,
    price: { monthly: 29, yearly: 23 }, inherits: "Free",
    features: ["500 credits / month", "Invite collaborators", "Share links", "CSV exports", "14-day free trial"],
    cta: "Start 14-day free trial", href: "/signup?plan=pro", featured: true,
  },
  {
    id: "enterprise", name: "Enterprise", tagline: "For teams with security and scale needs.", icon: Building2,
    price: null, inherits: "Pro",
    features: ["SSO integration", "Full team collaboration", "Dedicated compute", "Priority support", "Custom onboarding"],
    cta: "Contact sales", href: "mailto:hello@justcmul8.com",
  },
];

const COMPARE: { label: string; values: (boolean | string)[] }[] = [
  { label: "Credits per month", values: ["100", "500", "Custom"] },
  { label: "Visual builder & live results", values: [true, true, true] },
  { label: "AI assistant", values: ["Uses credits", "Uses credits", "Uses credits"] },
  { label: "CSV results export", values: [false, true, true] },
  { label: "Team collaboration", values: [false, "Share links", "Full"] },
  { label: "SSO & dedicated compute", values: [false, false, true] },
];

// A price that rolls to its new value when billing changes.
function RollingPrice({ value, className = "" }: { value: string; className?: string }) {
  return (
    <span className={`relative inline-flex overflow-hidden ${className}`}>
      <motion.span key={value} initial={{ y: "100%", opacity: 0 }} animate={{ y: "0%", opacity: 1 }} transition={spring(16, 0.85)} className="tabular-nums">
        {value}
      </motion.span>
    </span>
  );
}

// A tick that draws itself when it scrolls into view.
function Tick({ light, delay }: { light?: boolean; delay: number }) {
  return (
    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${light ? "bg-white/20" : "bg-[#f1eeff]"}`}>
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke={light ? "#fff" : "#5742FF"} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
        <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.4, delay }} />
      </svg>
    </span>
  );
}

function PlanCard({ plan, billing }: { plan: Plan; billing: Billing }) {
  const f = !!plan.featured;
  const Icon = plan.icon;
  const price = plan.price ? plan.price[billing] : null;
  return (
    <motion.div
      whileHover={{ y: f ? -6 : -6 }}
      transition={spring(18, 0.8)}
      className={`relative flex h-full flex-col overflow-hidden rounded-[2rem] p-7 sm:p-8 ${
        f
          ? "bg-gradient-to-b from-[#7a67ff] via-[#5742FF] to-[#4a36e6] text-white shadow-[0_40px_80px_-30px_rgba(87,66,255,.65)] lg:-my-5 lg:py-12"
          : "border border-[#ecebf7] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_16px_40px_-28px_rgba(16,24,40,.25)]"
      }`}
    >
      {f && (
        <>
          {/* Soft light sheen sweeping across the featured card */}
          <span aria-hidden className="lp-sheen pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <span aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.12) 1px, transparent 1.5px)", backgroundSize: "18px 18px", maskImage: "linear-gradient(180deg,#000,transparent 60%)", WebkitMaskImage: "linear-gradient(180deg,#000,transparent 60%)" }} />
        </>
      )}

      <div className="relative flex items-center justify-between">
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${f ? "bg-white/15 text-white ring-1 ring-white/25" : "bg-[#f5f3ff] text-[#5742FF]"}`}>
          <Icon size={21} strokeWidth={2} />
        </span>
        {f && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#5742FF] shadow-[0_6px_16px_-6px_rgba(0,0,0,.35)]">
            <Sparkles size={12} /> Most popular
          </span>
        )}
      </div>

      <h3 className={`relative mt-5 font-space text-[22px] font-bold tracking-[-0.02em] ${f ? "text-white" : "text-[#161622]"}`}>{plan.name}</h3>
      <p className={`relative mt-1 text-[14px] ${f ? "text-white/75" : "text-[#64748b]"}`}>{plan.tagline}</p>

      <div className="relative mt-6 flex items-end gap-1.5">
        {price === null ? (
          <span className={`font-space text-[44px] font-bold leading-none tracking-[-0.03em] ${f ? "text-white" : "text-[#161622]"}`}>Custom</span>
        ) : (
          <>
            <span className={`font-space text-[52px] font-bold leading-none tracking-[-0.04em] ${f ? "text-white" : "text-[#161622]"}`}>
              $<RollingPrice value={String(price)} />
            </span>
            <span className={`mb-1.5 text-[14px] font-medium ${f ? "text-white/70" : "text-[#94a3b8]"}`}>/ month</span>
          </>
        )}
      </div>
      <div className={`relative mt-2 h-5 text-[12.5px] font-medium ${f ? "text-white/70" : "text-[#94a3b8]"}`}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={`${billing}-${plan.id}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }} className="block">
            {price === null ? "Tailored to your organisation" : price === 0 ? "Free forever" : billing === "yearly" ? `Billed $${price * 12} yearly` : "Billed monthly"}
          </motion.span>
        </AnimatePresence>
      </div>

      <Link
        href={plan.id === "pro" ? `${plan.href}&billing=${billing}` : plan.href}
        className={`group/cta relative mt-7 inline-flex h-12 shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full text-[14.5px] font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98] ${
          f ? "bg-white text-[#5742FF] shadow-[0_10px_24px_-10px_rgba(0,0,0,.45)]" : "bg-[#161622] text-white hover:bg-[#2a2940]"
        }`}
      >
        {plan.cta}
        <ArrowRight size={16} className="transition-transform group-hover/cta:translate-x-0.5" />
      </Link>

      <div className={`relative my-7 h-px ${f ? "bg-white/20" : "bg-[#f1f0fa]"}`} />

      {plan.inherits && (
        <p className={`relative mb-3.5 text-[12.5px] font-bold uppercase tracking-[0.12em] ${f ? "text-white/80" : "text-[#94a3b8]"}`}>Everything in {plan.inherits}, plus</p>
      )}
      <ul className="relative space-y-3">
        {plan.features.map((feat, i) => (
          <li key={feat} className={`flex items-start gap-3 text-[14.5px] ${f ? "text-white" : "text-[#334155]"}`}>
            <Tick light={f} delay={0.15 + i * 0.07} />
            {feat}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function Cell({ v }: { v: boolean | string }) {
  if (v === true) return <Check size={17} strokeWidth={2.6} className="mx-auto text-[#5742FF]" />;
  if (v === false) return <Minus size={16} className="mx-auto text-[#cbd5e1]" />;
  return <span className="text-[13px] font-semibold text-[#334155]">{v}</span>;
}

export default function PricingSection() {
  const [billing, setBilling] = useState<Billing>("monthly");
  return (
    <div id="pricing" className="relative pt-24 md:pt-36 scroll-mt-16">
      <SectionHeader title="Simple pricing." accent="Serious power." sub="Start free, upgrade when your models grow. No hidden fees, cancel anytime." className="!mb-8" />

      {/* Billing toggle */}
      <Reveal className="flex justify-center mb-12 md:mb-16" y={12}>
        <div className="relative flex h-12 items-center rounded-full bg-black/[0.04] p-1 shadow-[inset_0_1px_2px_rgba(16,24,40,.06)]" role="tablist" aria-label="Billing period">
          {(["monthly", "yearly"] as const).map((b) => (
            <button key={b} role="tab" aria-selected={billing === b} onClick={() => setBilling(b)} className="relative h-10 rounded-full px-5 text-[14px] font-semibold">
              {billing === b && <motion.span layoutId="billing-pill" className="absolute inset-0 rounded-full bg-white shadow-[0_2px_8px_-2px_rgba(16,24,40,.18),inset_0_1px_0_#fff]" transition={spring(20, 0.85)} />}
              <span className={`relative flex items-center gap-2 transition-colors ${billing === b ? "text-[#161622]" : "text-[#64748b]"}`}>
                {b === "monthly" ? "Monthly" : "Yearly"}
                {b === "yearly" && <span className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10.5px] font-bold text-[#15803d]">Save 20%</span>}
              </span>
            </button>
          ))}
        </div>
      </Reveal>

      <Stagger className="mx-auto grid max-w-6xl grid-cols-1 items-stretch gap-6 md:grid-cols-3 lg:gap-7" gap={0.1}>
        {PLANS.map((p) => (
          <StaggerItem key={p.id} className="h-full">
            <PlanCard plan={p} billing={billing} />
          </StaggerItem>
        ))}
      </Stagger>

      <Reveal className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] font-medium text-[#64748b]" y={10}>
        {["No credit card required", "Cancel anytime", "Student-friendly"].map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5"><Check size={14} className="text-[#12a150]" /> {t}</span>
        ))}
      </Reveal>

      {/* Compare plans */}
      <Reveal className="mx-auto mt-20 max-w-5xl" y={24}>
        <h3 className="mb-6 text-center font-space text-[26px] font-bold tracking-[-0.03em] text-[#161622]">Compare plans</h3>
        <div className="overflow-x-auto rounded-3xl border border-[#ecebf7] bg-white shadow-[0_16px_40px_-28px_rgba(16,24,40,.25)]">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-[#f1f0fa]">
                <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-[0.12em] text-[#94a3b8]">Feature</th>
                {PLANS.map((p) => (
                  <th key={p.id} className={`px-4 py-4 text-center text-[14px] font-bold ${p.featured ? "text-[#5742FF]" : "text-[#161622]"}`}>{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row) => (
                <tr key={row.label} className="border-b border-[#f7f6fc] last:border-0 transition-colors hover:bg-[#faf9ff]">
                  <td className="px-6 py-3.5 text-[14px] font-medium text-[#334155]">{row.label}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className={`px-4 py-3.5 text-center ${PLANS[i].featured ? "bg-[#f8f7ff]" : ""}`}><Cell v={v} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      <FaqSection />
    </div>
  );
}
