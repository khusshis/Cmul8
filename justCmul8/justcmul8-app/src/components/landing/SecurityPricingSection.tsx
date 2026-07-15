"use client";

import React from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { Lock, Shield, KeyRound, Check } from "lucide-react";

const freePlan = {
  name: "FREE", price: "$0", period: "/mo",
  features: ["1 Active Project", "Full visual builder", "Real-time execution", "Standard KPIs", "AI Chat (limited)"],
  cta: "GET STARTED", href: "/signup", highlight: false,
};
const proPlan = {
  name: "PRO", price: "$29", period: "/mo", badge: "★ RECOMMENDED",
  features: ["Unlimited Projects", "Priority execution", "Custom sprite uploads", "Advanced KPI exports", "Unlimited AI Chat"],
  cta: "UPGRADE TO PRO", href: "/signup", highlight: true,
};
const enterprisePlan = {
  name: "ENTERPRISE", price: "Custom", period: " Quote",
  features: ["Unlimited Projects", "SSO integration", "Full team collaboration", "Dedicated compute", "Priority support"],
  cta: "CONTACT US", href: "mailto:hello@justcmul8.com", highlight: false, magenta: true,
};

export default function SecurityPricingSection() {
  const ref = React.useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  return (
    <section ref={ref} className="relative py-24 px-4">
      <div className="max-w-7xl mx-auto space-y-20">
        {/* Security */}
        <div>
          <motion.div initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ duration: 0.5 }} className="flex justify-center mb-6">
            <span className="section-label">SECURITY &amp; SCALE</span>
          </motion.div>
          <motion.h2 initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.1 }}
            className="text-center font-display font-bold text-white mb-12" id="security"
            style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", letterSpacing: "0.08em" }}>
            BUILT FOR SECURITY. READY FOR SCALE.
          </motion.h2>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.2 }}
            className="glass-panel hover-glow-cyan p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { icon: <Lock size={28} style={{ color: "var(--neon-cyan)" }} />, title: "DATA ISOLATION", text: "Strict multi-tenant model. Your projects and assets are invisible to all other users. Row-Level Security enforced." },
                { icon: <Shield size={28} style={{ color: "var(--neon-cyan)" }} />, title: "AUTHENTICATION", text: "Mandatory secure auth with MFA support. OAuth via Google & GitHub for frictionless sign-in." },
                { icon: <KeyRound size={28} style={{ color: "var(--neon-cyan)" }} />, title: "ENCRYPTION", text: "All communication via TLS/SSL. Data encrypted at rest. Supabase enterprise-grade infrastructure." },
              ].map((item) => (
                <div key={item.title} className="space-y-3">
                  {item.icon}
                  <h3 className="font-display font-semibold text-sm tracking-wider text-neon-cyan" style={{ fontFamily: "var(--font-display)" }}>{item.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}>{item.text}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Pricing */}
        <div>
          <motion.div initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ duration: 0.5, delay: 0.3 }} className="flex justify-center mb-6">
            <span className="section-label">PRICING</span>
          </motion.div>
          <motion.h2 initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.35 }}
            className="text-center font-display font-bold text-white mb-12" id="pricing"
            style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", letterSpacing: "0.08em" }}>
            CHOOSE YOUR TIER
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <PricingCard plan={freePlan} delay={0.4} inView={inView} />
            <PricingCard plan={proPlan} delay={0.5} inView={inView} raised />
            <PricingCard plan={enterprisePlan} delay={0.6} inView={inView} />
          </div>
        </div>
      </div>
    </section>
  );
}

interface Plan { name: string; price: string; period: string; badge?: string; features: string[]; cta: string; href: string; highlight: boolean; magenta?: boolean; }
function PricingCard({ plan, delay, inView, raised }: { plan: Plan; delay: number; inView: boolean; raised?: boolean }) {
  const border = plan.magenta ? "rgba(255,0,255,0.25)" : plan.highlight ? "rgba(0,242,255,0.35)" : "rgba(0,242,255,0.12)";
  return (
    <motion.div initial={{ opacity: 0, y: 40 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay }}
      className={`glass-panel p-7 space-y-5 relative hover-glow-cyan ${raised ? "-mt-4" : ""}`}
      style={{ border: `1px solid ${border}` }}>
      {plan.badge && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-semibold rounded-full"
          style={{ background: "rgba(0,242,255,0.1)", border: "1px solid rgba(0,242,255,0.4)", color: "var(--neon-cyan)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
          {plan.badge}
        </div>
      )}
      <div>
        <p className="text-xs tracking-widest mb-1" style={{ fontFamily: "var(--font-mono)", color: plan.magenta ? "var(--neon-magenta)" : "var(--text-muted)" }}>{plan.name}</p>
        <div className="flex items-end gap-1">
          <span className="font-display font-black text-4xl text-white" style={{ fontFamily: "var(--font-display)" }}>{plan.price}</span>
          <span className="text-sm mb-1" style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)" }}>{plan.period}</span>
        </div>
      </div>
      <hr style={{ borderColor: "rgba(255,255,255,0.05)" }} />
      <ul className="space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check size={14} className="mt-0.5 flex-shrink-0" style={{ color: plan.magenta ? "var(--neon-magenta)" : "var(--neon-cyan)" }} />
            <span style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}>{f}</span>
          </li>
        ))}
      </ul>
      <Link href={plan.href}
        className={plan.highlight ? "btn-cyber-primary w-full justify-center" : "btn-cyber-ghost w-full justify-center"}
        style={plan.magenta ? { borderColor: "rgba(255,0,255,0.4)", color: "var(--neon-magenta)" } : undefined}>
        {plan.cta}
      </Link>
    </motion.div>
  );
}
