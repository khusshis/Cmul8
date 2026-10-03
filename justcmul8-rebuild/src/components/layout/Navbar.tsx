"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useLenis } from "lenis/react";
import { LogOut, Plus, Crown, Calendar, Rocket, Sparkles, Coins, User, Settings, CreditCard, HelpCircle, ChevronRight } from "lucide-react";
import LogoutDialog from "@/components/ui/LogoutDialog";
import { PLAN_CREDITS, TRIAL_DAYS, type Billing } from "@/lib/billing/plans";
import { MARK_SRC } from "@/components/brand/CubeMark";
import { createClient } from "@/lib/supabase/client";

const navLinks = [
  { label: "Features", href: "/#features" },
  { label: "AI", href: "/#ai" },
  { label: "Engine", href: "/#engine" },
  { label: "Simulations", href: "/#simulations" },
  { label: "Security", href: "/#security" },
  { label: "Pricing", href: "/#pricing" },
];

export default function Navbar() {
  const pathname     = usePathname();
  const router       = useRouter();
  const supabase     = createClient();
  const [scrolled, setScrolled]     = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const [userEmail, setUserEmail]   = React.useState<string | null>(null);
  const [account, setAccount] = React.useState<{ name: string; joined: string | null } | null>(null);
  const [billing, setBilling] = React.useState<Billing | null>(null);
  const isLanding = pathname === "/";
  const lenis = useLenis();

  // Listen for scroll
  React.useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Scroll-spy: the section crossing the middle band of the screen owns the glass pill.
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [hoverId, setHoverId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!isLanding) return;
    const els = navLinks.map((l) => document.getElementById(l.href.split("#")[1])).filter((el): el is HTMLElement => !!el);
    // Track every section in the band and pick the last in nav order: #pricing sits inside #security,
    // so both can be in the band at once and the nested one should win.
    const inBand = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => (e.isIntersecting ? inBand.add(e.target.id) : inBand.delete(e.target.id)));
        const last = [...els].reverse().find((el) => inBand.has(el.id));
        if (last) setActiveId(last.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    // Above the first section (the hero) nothing is active.
    const top = () => {
      if (window.scrollY < (els[0]?.offsetTop ?? 0) - window.innerHeight * 0.5) setActiveId(null);
    };
    window.addEventListener("scroll", top, { passive: true });
    return () => { io.disconnect(); window.removeEventListener("scroll", top); };
  }, [isLanding]);

  // Freeze the page behind the mobile sheet.
  React.useEffect(() => {
    if (!lenis) return;
    if (mobileOpen) lenis.stop();
    else lenis.start();
  }, [mobileOpen, lenis]);

  // Listen for auth, and load the real profile (name from the profile row, join date from the account).
  React.useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUserEmail(user?.email ?? null);
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
      const meta = user.user_metadata as { full_name?: string; name?: string };
      setAccount({
        name: profile?.display_name || meta?.full_name || meta?.name || user.email?.split("@")[0] || "",
        joined: user.created_at ?? null,
      });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadBilling = React.useCallback(() => {
    fetch("/api/billing").then((r) => (r.ok ? r.json() : null)).then((b) => b && setBilling(b)).catch(() => {});
  }, []);
  React.useEffect(() => { if (pathname.startsWith("/dashboard") && userEmail) loadBilling(); }, [pathname, userEmail, loadBilling]);

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setShowLogoutConfirm(false);
    router.push("/");
    router.refresh();
  }

  const displayName = account?.name || userEmail?.split("@")[0] || "";
  const initial = (displayName || "?").charAt(0).toUpperCase();
  const logoutDialog = (
    <LogoutDialog open={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} onConfirm={logout} name={displayName} email={userEmail ?? ""} />
  );

  const isAuthenticated = userEmail !== null;
  const isDashboard = pathname.startsWith("/dashboard");

  if (isDashboard) {
    return (
      <div className="fixed top-3 left-0 right-0 z-50 flex justify-center px-3 sm:px-6">
        <div
          className="w-full flex h-14 items-center justify-between rounded-full border border-white/80 bg-white/65 pl-5 pr-2 shadow-[0_12px_40px_-12px_rgba(16,24,40,.25),inset_0_1px_0_rgba(255,255,255,.95),inset_0_-1px_0_rgba(16,24,40,.05)]"
          style={{ maxWidth: "1280px", backdropFilter: "saturate(180%) blur(24px)", WebkitBackdropFilter: "saturate(180%) blur(24px)" }}
        >
          {/* Left: Branding */}
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/" aria-label="JustCmul8 home" className="group flex shrink-0 items-center gap-2">
              <img src={MARK_SRC} alt="" className="h-[24px] w-auto transition-transform duration-300 group-hover:-rotate-6" />
              <span className="hidden sm:block font-space text-[16px] font-bold tracking-tight text-[#1d1d1f]">JustCmul8</span>
            </Link>

            <div className="hidden md:block w-px h-6 bg-black/[0.08]" />

            {/* Center Breadcrumb */}
            {/* Breadcrumb: recessed track with a glass pill on the current page */}
            <div className="hidden md:flex items-center rounded-full bg-black/[0.035] p-1 shadow-[inset_0_1px_2px_rgba(16,24,40,.06)]">
              <Link href="/" className="flex h-9 items-center rounded-full px-3.5 text-[13px] text-[#1d1d1f]/65 transition-colors hover:text-[#1d1d1f]">
                Home
              </Link>
              <span className="flex h-9 items-center rounded-full border border-white bg-gradient-to-b from-white to-white/70 px-3.5 text-[13px] font-medium text-[#1d1d1f] shadow-[0_2px_8px_-2px_rgba(16,24,40,.18),inset_0_1px_0_#fff]">
                My Simulations
              </span>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 relative">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-new-sim-modal'))}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-b from-[#6a57ff] to-[#5742FF] border border-[#8d80ff] px-4 sm:px-5 text-[13px] font-medium text-white shadow-[0_6px_16px_-6px_rgba(87,66,255,.7),inset_0_1px_0_rgba(255,255,255,.35)] transition-transform hover:scale-[1.03] active:scale-[0.97]"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span className="hidden sm:inline">New Simulation</span>
            </button>

            <button onClick={() => setShowLogoutConfirm(true)} className="hidden sm:inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] text-[#1d1d1f]/70 transition-colors hover:bg-black/[0.04] hover:text-[#1d1d1f]">
              <LogOut size={15} strokeWidth={2} />
              Log out
            </button>

            {/* Profile Dropdown Container */}
            <div className="relative">
              <button 
                onClick={() => { if (!profileOpen) loadBilling(); setProfileOpen(!profileOpen); }}
                aria-label="Account menu"
                aria-expanded={profileOpen}
                className="flex items-center gap-1.5 p-1 rounded-full hover:bg-gray-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-[#5742FF] flex items-center justify-center text-white font-bold text-[14px] shadow-sm">
                  {initial}
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-400"><polyline points="6 9 12 15 18 9"/></svg>
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <>
                    {/* Invisible overlay to catch clicks outside */}
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setProfileOpen(false)}
                    />
                    
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute right-0 top-[calc(100%+12px)] w-[380px] bg-white rounded-[24px] shadow-[0_12px_40px_-8px_rgba(0,0,0,0.15)] border border-gray-100 p-5 z-50 pointer-events-auto"
                    >
                      {/* Triangle pointer */}
                      <div className="absolute -top-2 right-5 w-4 h-4 bg-white border-l border-t border-gray-100 rotate-45" />
                      
                      {/* Header */}
                      <div className="flex items-center gap-4 mb-5 relative z-10">
                        <div className="relative">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#5742FF] flex items-center justify-center text-white font-semibold text-[28px] shadow-sm">
                            {initial}
                          </div>
                          <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-green-500 border-2 border-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="font-bold text-[17px] text-[#111827] truncate">{displayName}</h4>
                            {billing && (
                              billing.plan === "free" ? (
                                <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wide">Free</span>
                              ) : (
                                <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-600 text-[10px] font-bold uppercase tracking-wide">
                                  <Crown size={10} strokeWidth={3} /> {billing.status === "trialing" ? "Pro trial" : "Pro"}
                                </span>
                              )
                            )}
                          </div>
                          <p className="text-[13px] text-gray-500 mb-1.5 truncate">{userEmail}</p>
                          {account?.joined && (
                            <div className="flex items-center gap-1.5 text-[12px] text-gray-400 font-medium">
                              <Calendar size={13} strokeWidth={2} />
                              Joined {new Date(account.joined).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Plan + credits (live from /api/billing) */}
                      <div className="bg-[#F8F7FF] rounded-[16px] p-4 mb-5 relative z-10">
                        {billing ? (() => {
                          const pro = billing.plan !== "free";
                          const allowance = PLAN_CREDITS[billing.plan];
                          const used = Math.max(0, allowance - billing.credits);
                          const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "");
                          const sub =
                            !pro ? `${allowance} credits a month. Try Pro free for ${TRIAL_DAYS} days.` :
                            billing.status === "trialing" ? `Trial ends ${day(billing.trial_ends_at)}. Cancel any time.` :
                            billing.status === "past_due" ? "Payment failed. Razorpay is retrying." :
                            billing.cancel_at_period_end ? `Ends ${day(billing.current_period_end)}.` :
                            `Renews ${day(billing.current_period_end)} · billed ${billing.billing_interval}.`;
                          return (
                            <>
                              <div className="flex items-start justify-between gap-3 mb-4">
                                <div className="flex gap-3 min-w-0">
                                  <div className="w-9 h-9 shrink-0 rounded-full bg-white flex items-center justify-center text-[#5742FF] shadow-sm">
                                    {pro ? <Rocket size={18} strokeWidth={2} /> : <Sparkles size={18} strokeWidth={2} />}
                                  </div>
                                  <div className="min-w-0">
                                    <h5 className="font-bold text-[#111827] text-[14px]">
                                      {!pro ? "You're on the Free plan" : billing.status === "trialing" ? "You're on a Pro trial" : "You're on Pro"}
                                    </h5>
                                    <p className="text-[12px] text-gray-500 leading-snug mt-0.5">{sub}</p>
                                  </div>
                                </div>
                                <Link
                                  href="/settings?tab=billing"
                                  onClick={() => setProfileOpen(false)}
                                  className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-colors shadow-sm ${pro ? "bg-white border border-gray-200 text-[#5742FF] hover:bg-gray-50" : "bg-[#5742FF] text-white hover:bg-[#4a36e6]"}`}
                                >
                                  {pro ? "Manage" : "Upgrade"} <ChevronRight size={14} />
                                </Link>
                              </div>
                              <div className="space-y-2">
                                <div className="w-full h-1.5 bg-[#E5E0FF] rounded-full overflow-hidden">
                                  <motion.div className="h-full bg-[#5742FF] rounded-full" initial={{ width: 0 }} animate={{ width: `${Math.min(100, (used / allowance) * 100)}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
                                </div>
                                <div className="flex justify-between text-[11px] font-medium text-gray-500">
                                  <span className="flex items-center gap-1"><Coins size={11} /> Credits used this month</span>
                                  <span className="text-gray-900 font-bold">{used} / {allowance}</span>
                                </div>
                                <p className="text-[11px] text-gray-400">{billing.credits} left · refills {day(billing.credits_reset_at)}</p>
                              </div>
                            </>
                          );
                        })() : (
                          <div className="space-y-3 animate-pulse" aria-label="Loading plan">
                            <div className="h-4 w-1/2 rounded-full bg-[#E5E0FF]" />
                            <div className="h-3 w-3/4 rounded-full bg-[#ECE9FF]" />
                            <div className="h-1.5 w-full rounded-full bg-[#E5E0FF]" />
                          </div>
                        )}
                      </div>

                      {/* Links List */}
                      <div className="flex flex-col gap-1 mb-5 relative z-10">
                        {[
                          { icon: User, title: "Profile Settings", sub: "Update your personal information", href: "/settings?tab=profile" },
                          { icon: Settings, title: "Account Settings", sub: "Manage your account preferences", href: "/settings?tab=account" },
                          { icon: CreditCard, title: "Billing & Subscription", sub: "Plan, credits and cancellation", href: "/settings?tab=billing" },
                          { icon: HelpCircle, title: "Help & Support", sub: "FAQs and contact our team", href: "/settings?tab=help" }
                        ].map((item, idx) => (
                          item.href ? (
                            <Link key={idx} href={item.href} onClick={() => setProfileOpen(false)} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors group text-left">
                              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-white group-hover:shadow-sm transition-all">
                                <item.icon size={16} strokeWidth={2} />
                              </div>
                              <div className="flex-1">
                                <h6 className="font-bold text-[#111827] text-[13px]">{item.title}</h6>
                                <p className="text-[11px] text-gray-500">{item.sub}</p>
                              </div>
                              <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                            </Link>
                          ) : (
                            <button key={idx} disabled className="flex items-center gap-4 p-3 rounded-xl opacity-50 cursor-not-allowed text-left">
                              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                <item.icon size={16} strokeWidth={2} />
                              </div>
                              <div className="flex-1">
                                <h6 className="font-bold text-gray-500 text-[13px]">{item.title}</h6>
                                <p className="text-[11px] text-gray-400">Coming soon</p>
                              </div>
                            </button>
                          )
                        ))}
                      </div>

                      {/* Logout Button */}
                      <button 
                        onClick={() => { setProfileOpen(false); setShowLogoutConfirm(true); }}
                        className="w-full flex flex-col items-center justify-center p-4 rounded-[16px] bg-[#FFF5F5] hover:bg-[#FFEBEB] transition-colors relative z-10"
                      >
                        <div className="flex items-center gap-2 text-red-500 font-bold text-[14px] mb-1">
                          <LogOut size={16} strokeWidth={2.5} />
                          Logout
                        </div>
                        <p className="text-[11px] text-gray-500">
                          You will be signed out from all devices
                        </p>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {logoutDialog}
      </div>
    );
  }

  // Landing navbar: a floating Liquid Glass capsule (iOS 26). One glass pill slides between links:
  // it follows the pointer on hover, otherwise it rests on the section you're reading.
  const go = (e: React.MouseEvent, href: string) => {
    setMobileOpen(false);
    const id = href.split("#")[1];
    if (!isLanding || !id || !lenis) return;
    e.preventDefault();
    lenis.start(); // the mobile sheet stops Lenis; a stopped instance ignores scrollTo
    lenis.scrollTo(`#${id}`, { offset: -84, duration: 1.2 });
  };
  const pillOn = hoverId ?? activeId;

  return (
    <>
      <nav aria-label="Main navigation" className="fixed inset-x-0 top-3 z-50 flex justify-center px-3 pointer-events-none">
        <div
          className={`pointer-events-auto flex h-14 w-full max-w-[980px] items-center gap-3 rounded-full border pl-5 pr-2 transition-[background-color,box-shadow] duration-300 ${
            scrolled || mobileOpen
              ? "bg-white/65 border-white/80 shadow-[0_12px_40px_-12px_rgba(16,24,40,.25),inset_0_1px_0_rgba(255,255,255,.95),inset_0_-1px_0_rgba(16,24,40,.05)]"
              : "bg-white/45 border-white/70 shadow-[0_8px_30px_-14px_rgba(16,24,40,.18),inset_0_1px_0_rgba(255,255,255,.9),inset_0_-1px_0_rgba(16,24,40,.04)]"
          }`}
          style={{ backdropFilter: "saturate(180%) blur(24px)", WebkitBackdropFilter: "saturate(180%) blur(24px)" }}
        >
          <Link href="/" aria-label="JustCmul8 home" className="group flex shrink-0 items-center gap-2">
            <img src={MARK_SRC} alt="" className="h-[24px] w-auto transition-transform duration-300 group-hover:-rotate-6" />
            <span className="font-space text-[16px] font-bold tracking-tight text-[#1d1d1f]">JustCmul8</span>
          </Link>

          {isLanding && (
            <ul
              className="mx-auto hidden items-center rounded-full bg-black/[0.035] p-1 shadow-[inset_0_1px_2px_rgba(16,24,40,.06)] md:flex"
              onMouseLeave={() => setHoverId(null)}
            >
              {navLinks.map((link) => {
                const id = link.href.split("#")[1];
                const on = pillOn === id;
                return (
                  <li key={link.label} className="relative">
                    {on && (
                      <motion.span
                        layoutId="nav-glass-pill"
                        className="absolute inset-0 rounded-full border border-white bg-gradient-to-b from-white to-white/70 shadow-[0_2px_8px_-2px_rgba(16,24,40,.18),0_0_0_0.5px_rgba(16,24,40,.06),inset_0_1px_0_#fff]"
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 520, damping: 34, mass: 0.9 }}
                      />
                    )}
                    <a
                      href={link.href}
                      onClick={(e) => go(e, link.href)}
                      onMouseEnter={() => setHoverId(id)}
                      aria-current={activeId === id ? "location" : undefined}
                      className={`relative z-10 flex h-9 items-center rounded-full px-3.5 text-[13px] tracking-[-0.01em] transition-colors duration-200 ${
                        on ? "font-medium text-[#1d1d1f]" : "text-[#1d1d1f]/65 hover:text-[#1d1d1f]"
                      }`}
                    >
                      {link.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="ml-auto hidden shrink-0 items-center gap-1 md:flex">
            {isAuthenticated ? (
              <>
                <button onClick={() => { setMobileOpen(false); setShowLogoutConfirm(true); }} className="h-10 rounded-full px-4 text-[13px] text-[#1d1d1f]/70 transition-colors hover:bg-black/[0.04] hover:text-[#1d1d1f]">
                  Log out
                </button>
                <Link href="/dashboard" className="inline-flex h-10 items-center rounded-full bg-gradient-to-b from-[#6a57ff] to-[#5742FF] border border-[#8d80ff] px-5 text-[13px] font-medium text-white shadow-[0_6px_16px_-6px_rgba(87,66,255,.7),inset_0_1px_0_rgba(255,255,255,.35)] transition-transform hover:scale-[1.03] active:scale-[0.97]">
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="inline-flex h-10 items-center rounded-full px-4 text-[13px] text-[#1d1d1f]/70 transition-colors hover:bg-black/[0.04] hover:text-[#1d1d1f]">
                  Log in
                </Link>
                <Link href="/signup" className="inline-flex h-10 items-center rounded-full bg-gradient-to-b from-[#6a57ff] to-[#5742FF] border border-[#8d80ff] px-5 text-[13px] font-medium text-white shadow-[0_6px_16px_-6px_rgba(87,66,255,.7),inset_0_1px_0_rgba(255,255,255,.35)] transition-transform hover:scale-[1.03] active:scale-[0.97]">
                  Get started
                </Link>
              </>
            )}
          </div>

          {/* Two lines that fold into an X */}
          <button
            className="ml-auto flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/[0.04] md:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            <span className="relative block h-3 w-[18px]">
              <motion.span
                className="absolute inset-x-0 h-[1.5px] rounded-full bg-[#1d1d1f]"
                animate={mobileOpen ? { top: 5, rotate: 45 } : { top: 1, rotate: 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              />
              <motion.span
                className="absolute inset-x-0 h-[1.5px] rounded-full bg-[#1d1d1f]"
                animate={mobileOpen ? { top: 5, rotate: -45 } : { top: 9, rotate: 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              />
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile: full-screen sheet, big links cascading in */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-white/95 px-8 pt-24 md:hidden"
            style={{ backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ duration: 0.25 }}
          >
            <motion.ul initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } } }}>
              {(isLanding ? navLinks : []).map((link) => (
                <motion.li key={link.label} variants={{ hidden: { opacity: 0, y: -8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } } }}>
                  <a href={link.href} onClick={(e) => go(e, link.href)} className="block py-2 text-[28px] font-semibold tracking-[-0.02em] text-[#1d1d1f]">
                    {link.label}
                  </a>
                </motion.li>
              ))}
              <motion.li variants={{ hidden: { opacity: 0, y: -8 }, show: { opacity: 1, y: 0 } }} className="mt-8 flex flex-col gap-3 border-t border-black/[0.08] pt-6">
                {isAuthenticated ? (
                  <>
                    <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="inline-flex h-11 items-center justify-center rounded-full bg-[#5742FF] text-[15px] font-medium text-white">
                      Dashboard
                    </Link>
                    <button onClick={() => { setMobileOpen(false); setShowLogoutConfirm(true); }} className="h-11 text-[15px] text-[#1d1d1f]/75">
                      Log out
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/signup" onClick={() => setMobileOpen(false)} className="inline-flex h-11 items-center justify-center rounded-full bg-[#5742FF] text-[15px] font-medium text-white">
                      Get started
                    </Link>
                    <Link href="/login" onClick={() => setMobileOpen(false)} className="inline-flex h-11 items-center justify-center text-[15px] text-[#1d1d1f]/75">
                      Log in
                    </Link>
                  </>
                )}
              </motion.li>
            </motion.ul>
          </motion.div>
        )}
      </AnimatePresence>
      {logoutDialog}
    </>
  );
}
