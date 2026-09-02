"use client";

import React from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { Lock, Shield, KeyRound, Check, Database, Users, ShieldAlert, Globe, Zap, Server, Activity, Gift, Rocket, Building2, CheckCircle2, ArrowRight } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";

const freePlan = {
  name: "FREE", price: "$0", period: "/mo",
  desc: "Perfect for exploring and building your first simulations.",
  features: ["1 Active Project", "Full visual builder", "Real-time execution", "Standard KPIs", "AI Chat (limited)"],
  cta: "Get Started", href: "/signup", highlight: false, icon: Gift, iconBg: "bg-indigo-50", iconCol: "text-indigo-600"
};
const proPlan = {
  name: "PRO", price: "$29", period: "/mo", badge: "★ RECOMMENDED",
  desc: "Advanced features for serious builders and professionals.",
  features: ["Unlimited Projects", "Priority execution", "Custom sprite uploads", "Advanced KPI exports", "Unlimited AI Chat"],
  cta: "Upgrade to Pro", href: "/signup", highlight: true, icon: Rocket, iconBg: "bg-red-50", iconCol: "text-red-500"
};
const enterprisePlan = {
  name: "ENTERPRISE", price: "Custom", period: " Quote",
  desc: "For teams and organizations with advanced security and scale needs.",
  features: ["Unlimited Projects", "SSO integration", "Full team collaboration", "Dedicated compute", "Priority support"],
  cta: "Contact Us", href: "mailto:hello@justcmul8.com", highlight: false, icon: Building2, iconBg: "bg-indigo-50", iconCol: "text-indigo-600"
};

export default function SecurityPricingSection() {
  const ref = React.useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  return (
    <section id="security" ref={ref} className="relative py-24 px-4 bg-[var(--color-bg)]">
      <div className="max-w-7xl mx-auto space-y-20">
        {/* SECURITY & SCALE SECTION */}
        <div className="mb-32">
          
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-16">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }} className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-orange-50 mb-6 border border-orange-100">
              <span className="text-[10px] font-bold tracking-[0.2em] text-orange-600 uppercase">SECURITY & SCALE</span>
            </motion.div>
            <motion.h2 initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.1 }} className="text-[2.5rem] md:text-[3.5rem] font-space font-black leading-[1.1] text-[#111827] -tracking-[0.03em] mb-5 uppercase">
              Built for <span className="text-gray-900">Security</span>.<br className="md:hidden" /> Ready for <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-red-500">Scale</span>.
            </motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ duration: 0.5, delay: 0.2 }} className="max-w-2xl text-[1.1rem] text-[#64748b] font-medium leading-relaxed">
              Security is at the core of everything we build. From architecture to access control — we ensure your simulations and data are always protected.
            </motion.p>
          </div>

          {/* 3 Main Security Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            
            {/* DATA ISOLATION */}
            <SecurityCard 
              color="red"
              title="DATA ISOLATION"
              desc="Strict multi-tenant model. Your projects and assets are invisible to all other users. Row-Level Security enforced at every layer."
              Icon={Lock}
              tags={[
                { i: Database, t: "Isolated DB", s: "per tenant" },
                { i: Users, t: "Row-Level", s: "Security" },
                { i: ShieldAlert, t: "Zero cross-", s: "tenant access" }
              ]}
              delay={0.2}
              inView={inView}
            />

            {/* AUTHENTICATION */}
            <SecurityCard 
              color="purple"
              title="AUTHENTICATION"
              desc="Mandatory secure auth with MFA support. OAuth via Google & GitHub for frictionless, enterprise-grade sign-in."
              Icon={Shield}
              tags={[
                { i: KeyRound, t: "MFA", s: "Enforced" },
                { i: GoogleIcon, t: "Google", s: "OAuth" },
                { i: GithubIcon, t: "GitHub", s: "OAuth" }
              ]}
              delay={0.3}
              inView={inView}
            />

            {/* ENCRYPTION */}
            <SecurityCard 
              color="green"
              title="ENCRYPTION"
              desc="All communication via TLS/SSL. Data encrypted at rest. Supabase enterprise-grade infrastructure."
              Icon={KeyRound}
              tags={[
                { i: Shield, t: "TLS 1.2+", s: "in transit" },
                { i: Database, t: "AES-256", s: "at rest" },
                { i: Server, t: "Enterprise", s: "Infra (Supabase)" }
              ]}
              delay={0.4}
              inView={inView}
            />
          </div>

          {/* Scales with You Horizontal Card */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="group bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_10px_30px_rgb(0,0,0,0.06)] transition-all duration-300 flex flex-col xl:flex-row items-center gap-8 xl:gap-12"
          >
            <div className="flex items-start gap-5 flex-1 w-full">
              <motion.div 
                whileHover={{ scale: 1.05, rotate: 5 }}
                className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0 shadow-sm"
              >
                <Activity size={26} strokeWidth={2.5} />
              </motion.div>
              <div>
                <h3 className="text-xl font-space font-bold text-gray-900 mb-2">Scales with You</h3>
                <p className="text-[13px] text-gray-500 leading-relaxed max-w-md">
                  From a single project to millions of simulations — our architecture is built to scale without compromising on security or performance.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap md:flex-nowrap gap-4 md:gap-8 w-full xl:w-auto shrink-0 justify-between xl:justify-end border-t border-gray-100 pt-6 xl:pt-0 xl:border-t-0 xl:border-l xl:pl-8">
              {[
                { icon: Users, title: "Multi-Tenant", sub: "Isolated by Design" },
                { icon: Shield, title: "99.9% Uptime", sub: "Enterprise SLA" },
                { icon: Globe, title: "Global Ready", sub: "Edge Optimized" },
                { icon: Zap, title: "Auto Scaling", sub: "On Demand" }
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="text-blue-500 opacity-80 group-hover:opacity-100 transition-opacity"><t.icon size={24} strokeWidth={1.5} /></div>
                  <div>
                    <div className="text-[12px] font-bold text-gray-900">{t.title}</div>
                    <div className="text-[10px] text-gray-400 font-medium">{t.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

        </div>

        <div id="pricing" className="relative">
          {/* Background Ambient Glows for Pricing */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="absolute -top-[20%] -left-[10%] w-[50vw] max-w-[800px] h-[50vw] max-h-[800px] rounded-full bg-violet-200/40 blur-[120px]" />
            <div className="absolute top-[10%] -right-[15%] w-[45vw] max-w-[700px] h-[45vw] max-h-[700px] rounded-full bg-orange-200/40 blur-[130px]" />
          </div>

          <div className="relative z-10 flex flex-col items-center mb-16">
            <motion.div initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="mb-4">
              <span className="text-[11px] font-black tracking-[0.25em] text-[#5742FF] uppercase">PRICING</span>
            </motion.div>
            <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
              className="text-center font-space font-black text-[#111827] text-4xl md:text-5xl lg:text-6xl tracking-tight mb-6">
              Choose your <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#8b5cf6] via-[#d946ef] to-[#f97316]">tier</span>
            </motion.h2>
            <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }} className="text-center text-[#64748b] text-[1.1rem] max-w-lg leading-relaxed font-medium">
              Start free and scale as you grow. Simple, transparent, and built for every stage of your simulation journey.
            </motion.p>
          </div>
          
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start max-w-6xl mx-auto px-4">
            <PricingCard plan={freePlan} delay={0.3} />
            <PricingCard plan={proPlan} delay={0.4} raised />
            <PricingCard plan={enterprisePlan} delay={0.5} />
          </div>
        </div>
      </div>
    </section>
  );
}

interface Plan { name: string; price: string; period: string; badge?: string; desc: string; features: string[]; cta: string; href: string; highlight: boolean; icon: any; iconBg: string; iconCol: string; }
function PricingCard({ plan, delay, raised }: { plan: Plan; delay: number; raised?: boolean }) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 40, scale: 0.95 }} 
      whileInView={{ opacity: 1, y: 0, scale: 1 }} 
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay, type: "spring", bounce: 0.3 }}
      whileHover={{ y: -8, transition: { duration: 0.2, ease: "easeOut" } }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={`group relative h-full ${raised ? "md:-mt-4" : ""}`}
    >
      {/* Optional gradient border for highlight */}
      <div className={`absolute -inset-[1px] rounded-[2rem] z-0 transition-opacity duration-300 bg-gradient-to-b from-[#8b5cf6] via-[#d946ef] to-[#f97316] ${plan.highlight ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
      
      <div className={`relative z-10 bg-white rounded-[2rem] p-8 h-full flex flex-col shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-300 ${!plan.highlight ? 'border border-gray-100 group-hover:border-transparent' : 'border border-transparent'}`}>
        
        {plan.badge && (
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1.5 text-[10px] tracking-wider font-black uppercase rounded-full bg-gradient-to-r from-[#8b5cf6] via-[#d946ef] to-[#f97316] text-white shadow-md shadow-purple-500/20 whitespace-nowrap z-20">
            {plan.badge}
          </div>
        )}

        <div className="flex items-center gap-4 mb-6">
          <motion.div 
            animate={isHovered ? { y: [0, -5, 0], scale: 1.05 } : { y: 0, scale: 1 }}
            transition={{ duration: 2, repeat: isHovered ? Infinity : 0, ease: "easeInOut" }}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${plan.iconBg} ${plan.iconCol}`}
          >
            <plan.icon size={24} strokeWidth={2} />
          </motion.div>
          <div>
            <p className="text-[12px] font-bold tracking-[0.1em] text-indigo-600 uppercase leading-none mb-1">{plan.name}</p>
            <div className="flex items-baseline gap-1">
              <span className="font-black text-[2.5rem] leading-none text-gray-900">{plan.price}</span>
              <span className="text-[13px] font-medium text-gray-400">{plan.period}</span>
            </div>
          </div>
        </div>

        <p className="text-[13px] text-gray-500 font-medium leading-relaxed mb-6 h-[40px]">
          {plan.desc}
        </p>

        <hr className="border-gray-100 mb-6" />

        <ul className="space-y-3.5 flex-1 mb-8">
          {plan.features.map((f, i) => (
            <motion.li 
              key={f} 
              initial={{ opacity: 0.8, x: 0 }}
              animate={isHovered ? { opacity: 1, x: 4 } : { opacity: 0.8, x: 0 }}
              transition={{ duration: 0.2, delay: i * 0.05 }}
              className="flex items-start gap-2.5 text-[13.5px] font-medium text-gray-600"
            >
              <CheckCircle2 size={16} strokeWidth={2.5} className="mt-0.5 shrink-0 text-[#8b5cf6]" />
              <span className="leading-snug">{f}</span>
            </motion.li>
          ))}
        </ul>

        <Link href={plan.href}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-bold transition-all ${
            plan.highlight 
              ? "bg-gradient-to-r from-[#8b5cf6] to-[#f97316] text-white shadow-lg shadow-purple-500/20" 
              : "bg-[#f5f3ff] text-[#5742FF] hover:bg-indigo-100"
          }`}>
          {plan.cta}
          <motion.div animate={isHovered ? { x: 3 } : { x: 0 }}>
            <ArrowRight size={16} strokeWidth={2.5} className={plan.highlight ? "text-white" : "text-[#5742FF]"} />
          </motion.div>
        </Link>
      </div>
    </motion.div>
  );
}

function SecurityCard({ color, title, desc, Icon, tags, delay, inView }: any) {
  const [isHovered, setIsHovered] = React.useState(false);
  
  const colorMap: any = {
    red: { bg: "bg-red-50", text: "text-red-500", border: "border-red-500", tagBg: "bg-red-50/50" },
    purple: { bg: "bg-purple-50", text: "text-purple-500", border: "border-purple-500", tagBg: "bg-purple-50/50" },
    green: { bg: "bg-green-50", text: "text-green-500", border: "border-green-500", tagBg: "bg-green-50/50" }
  };
  const theme = colorMap[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -8, transition: { duration: 0.2, ease: "easeOut" } }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="group relative bg-white rounded-[2rem] border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_15px_30px_rgb(0,0,0,0.08)] transition-all duration-300 p-6 md:p-8 flex flex-col h-full overflow-hidden cursor-default"
    >
      <div className={`absolute top-0 left-4 right-4 h-[4px] rounded-b-md ${theme.bg} ${theme.border} border-t-[4px] opacity-70 group-hover:opacity-100 transition-opacity`} />
      
      <div className="pt-2 flex-1">
        <motion.div 
          animate={isHovered ? { y: [0, -5, 0], scale: 1.05 } : { y: 0, scale: 1 }}
          transition={{ duration: 2, repeat: isHovered ? Infinity : 0, ease: "easeInOut" }}
          className={`w-14 h-14 rounded-2xl ${theme.bg} ${theme.text} flex items-center justify-center mb-6 shadow-sm border border-transparent group-hover:border-current transition-colors`}
        >
          <Icon size={26} strokeWidth={2} />
        </motion.div>
        
        <h3 className="font-space font-bold text-[15px] tracking-wider text-gray-900 mb-3">{title}</h3>
        <p className="text-[13px] leading-relaxed text-gray-500 mb-8">{desc}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-auto">
        {tags.map((t: any, i: number) => (
          <motion.div
            key={i}
            initial={{ opacity: 0.8 }}
            animate={isHovered ? { opacity: 1, y: -2 } : { opacity: 0.8, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.05 }}
            className={`flex flex-col items-center justify-center text-center p-2 rounded-xl ${theme.tagBg} border border-transparent group-hover:border-gray-100 transition-colors gap-1.5`}
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
  );
}

const GoogleIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const GithubIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
  </svg>
);
