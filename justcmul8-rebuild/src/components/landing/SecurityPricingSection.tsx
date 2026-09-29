"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Lock, Shield, KeyRound, Database, Users, ShieldAlert, Globe, Zap, Server, Activity } from "lucide-react";
import { Backdrop, Reveal, SectionHeader, Stagger, StaggerItem, TiltCard, spring } from "@/components/landing/motionKit";
import PricingSection from "@/components/landing/PricingSection";

const THEMES = {
  red: { bg: "bg-red-50", tag: "bg-red-50/60", text: "text-red-500", bar: "from-red-400 to-rose-500" },
  purple: { bg: "bg-violet-50", tag: "bg-violet-50/60", text: "text-violet-600", bar: "from-[#8b5cf6] to-[#5742FF]" },
  green: { bg: "bg-green-50", tag: "bg-green-50/60", text: "text-green-600", bar: "from-emerald-400 to-green-500" },
};

type Tag = { i: React.ElementType; t: string; s: string };

function SecurityCard({ color, title, desc, Icon, tags }: { color: keyof typeof THEMES; title: string; desc: string; Icon: React.ElementType; tags: Tag[] }) {
  const [hover, setHover] = useState(false);
  const theme = THEMES[color];
  return (
    <TiltCard className="h-full rounded-[2rem]" max={5}>
      <motion.div
        onHoverStart={() => setHover(true)}
        onHoverEnd={() => setHover(false)}
        animate={{ y: hover ? -8 : 0 }}
        transition={spring(18, 0.8)}
        className="relative bg-white rounded-[2rem] border border-[#ecebf7] shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_28px_50px_-26px_rgba(16,24,40,0.16)] transition-shadow p-6 md:p-8 flex flex-col h-full overflow-hidden"
      >
        <motion.div
          className={`absolute top-0 left-1/2 -translate-x-1/2 h-[4px] rounded-b-md bg-gradient-to-r ${theme.bar}`}
          animate={{ width: hover ? "calc(100% - 2rem)" : "35%" }}
          transition={spring(14, 0.8)}
        />
        <div className="pt-2 flex-1">
          <motion.div
            animate={hover ? { y: [0, -5, 0], rotate: [0, -6, 6, 0] } : { y: 0, rotate: 0 }}
            transition={{ duration: 1.8, repeat: hover ? Infinity : 0, ease: "easeInOut" }}
            className={`w-14 h-14 rounded-2xl ${theme.bg} ${theme.text} flex items-center justify-center mb-6`}
          >
            <Icon size={26} strokeWidth={2} />
          </motion.div>
          <h3 className="font-space font-bold text-[15px] tracking-wider text-gray-900 mb-3">{title}</h3>
          <p className="text-[13px] leading-relaxed text-gray-500 mb-8">{desc}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-auto">
          {tags.map((t, i) => (
            <motion.div
              key={t.t}
              animate={hover ? { y: -3, opacity: 1 } : { y: 0, opacity: 0.85 }}
              transition={spring(18, 0.7, i * 0.05)}
              className={`flex flex-col items-center justify-center text-center p-2 rounded-xl ${theme.tag} border border-transparent hover:border-gray-100 gap-1.5`}
            >
              <div className={theme.text}><t.i size={16} strokeWidth={2} /></div>
              <div>
                <div className="text-[9px] font-bold text-gray-800 leading-tight">{t.t}</div>
                <div className="text-[8.5px] text-gray-500 leading-tight">{t.s}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </TiltCard>
  );
}

export default function SecurityPricingSection() {
  return (
    <section id="security" className="relative py-20 md:py-32 px-4 bg-white overflow-hidden">
      <Backdrop tone="a" />
      <div className="relative z-10 max-w-7xl mx-auto">
        <SectionHeader
          title="Built for Security."
          accent="Ready for Scale."
          sub="Security is at the core of everything we build. From architecture to access control — we ensure your simulations and data are always protected."
        />

        <Stagger className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6" gap={0.1}>
          <StaggerItem className="h-full">
            <SecurityCard
              color="red"
              title="DATA ISOLATION"
              desc="Strict multi-tenant model. Your projects and assets are invisible to all other users. Row-Level Security enforced at every layer."
              Icon={Lock}
              tags={[{ i: Database, t: "Isolated DB", s: "per tenant" }, { i: Users, t: "Row-Level", s: "Security" }, { i: ShieldAlert, t: "Zero cross-", s: "tenant access" }]}
            />
          </StaggerItem>
          <StaggerItem className="h-full">
            <SecurityCard
              color="purple"
              title="AUTHENTICATION"
              desc="Mandatory secure auth with MFA support. OAuth via Google & GitHub for frictionless, enterprise-grade sign-in."
              Icon={Shield}
              tags={[{ i: KeyRound, t: "MFA", s: "Enforced" }, { i: GoogleIcon, t: "Google", s: "OAuth" }, { i: GithubIcon, t: "GitHub", s: "OAuth" }]}
            />
          </StaggerItem>
          <StaggerItem className="h-full">
            <SecurityCard
              color="green"
              title="ENCRYPTION"
              desc="All communication via TLS/SSL. Data encrypted at rest. Supabase enterprise-grade infrastructure."
              Icon={KeyRound}
              tags={[{ i: Shield, t: "TLS 1.2+", s: "in transit" }, { i: Database, t: "AES-256", s: "at rest" }, { i: Server, t: "Enterprise", s: "Infra (Supabase)" }]}
            />
          </StaggerItem>
        </Stagger>

        <Reveal delay={0.1}>
          <motion.div
            whileHover="hover"
            initial="rest"
            className="bg-white rounded-3xl p-6 md:p-8 border border-[#ecebf7] shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_24px_50px_-28px_rgba(16,24,40,0.16)] transition-shadow flex flex-col xl:flex-row items-center gap-8 xl:gap-12"
          >
            <div className="flex items-start gap-5 flex-1 w-full">
              <motion.div variants={{ rest: { rotate: 0, scale: 1 }, hover: { rotate: 8, scale: 1.08 } }} transition={spring(14, 0.6)} className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                <Activity size={26} strokeWidth={2.5} />
              </motion.div>
              <div>
                <h3 className="text-xl font-space font-bold text-gray-900 mb-2">Scales with You</h3>
                <p className="text-[13px] text-gray-500 leading-relaxed max-w-md">From a single project to millions of simulations — our architecture is built to scale without compromising on security or performance.</p>
              </div>
            </div>
            <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 w-full xl:w-auto shrink-0 border-t border-[#f1f0fa] pt-6 xl:pt-0 xl:border-t-0 xl:border-l xl:pl-8" gap={0.08}>
              {[
                { icon: Users, title: "Multi-Tenant", sub: "Isolated by Design" },
                { icon: Shield, title: "99.9% Uptime", sub: "Enterprise SLA" },
                { icon: Globe, title: "Global Ready", sub: "Edge Optimized" },
                { icon: Zap, title: "Auto Scaling", sub: "On Demand" },
              ].map((t) => (
                <StaggerItem key={t.title}>
                  <motion.div whileHover={{ y: -3 }} transition={spring(18, 0.7)} className="flex items-center gap-3">
                    <div className="text-blue-500"><t.icon size={24} strokeWidth={1.5} /></div>
                    <div>
                      <div className="text-[12px] font-bold text-gray-900">{t.title}</div>
                      <div className="text-[10px] text-gray-400 font-medium">{t.sub}</div>
                    </div>
                  </motion.div>
                </StaggerItem>
              ))}
            </Stagger>
          </motion.div>
        </Reveal>

        <PricingSection />
      </div>
    </section>
  );
}

const GoogleIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const GithubIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);
