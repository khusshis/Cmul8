"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useLenis } from "lenis/react";
import { LogOut, Plus, Crown, Calendar, Rocket, User, Settings, CreditCard, HelpCircle, ChevronRight } from "lucide-react";
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

  // Listen for auth
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
  }

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
              className="inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-b from-[#6a57ff] to-[#5742FF] px-4 sm:px-5 text-[13px] font-medium text-white shadow-[0_6px_16px_-6px_rgba(87,66,255,.7),inset_0_1px_0_rgba(255,255,255,.35)] transition-transform hover:scale-[1.03] active:scale-[0.97]"
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
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-1.5 p-1 rounded-full hover:bg-gray-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-[#5742FF] flex items-center justify-center text-white font-bold text-[14px] shadow-sm">
                  {userEmail ? userEmail[0].toUpperCase() : "M"}
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
                          <div className="w-16 h-16 rounded-full bg-[#5742FF] flex items-center justify-center text-white font-semibold text-[28px] shadow-sm">
                            {userEmail ? userEmail[0].toUpperCase() : "M"}
                          </div>
                          <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-green-500 border-2 border-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="font-bold text-[17px] text-[#111827]">
                              {userEmail ? userEmail.split('@')[0] : "Mohit Gupta"}
                            </h4>
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-600 text-[10px] font-bold uppercase tracking-wide">
                              <Crown size={10} strokeWidth={3} /> Pro
                            </span>
                          </div>
                          <p className="text-[13px] text-gray-500 mb-1.5">{userEmail || "mohit.gupta261715@gmail.com"}</p>
                          <div className="flex items-center gap-1.5 text-[12px] text-gray-400 font-medium">
                            <Calendar size={13} strokeWidth={2} />
                            Joined Aug 2024
                          </div>
                        </div>
                      </div>

                      {/* Pro Plan Card */}
                      <div className="bg-[#F8F7FF] rounded-[16px] p-4 mb-5 relative z-10">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex gap-3">
                            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#5742FF] shadow-sm">
                              <Rocket size={18} strokeWidth={2} />
                            </div>
                            <div>
                              <h5 className="font-bold text-[#111827] text-[14px]">You&apos;re on Pro Plan</h5>
                              <p className="text-[12px] text-gray-500 leading-snug mt-0.5 max-w-[160px]">
                                Manage your plan and billing data details.
                              </p>
                            </div>
                          </div>
                          <button className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-[#5742FF] text-[12px] font-semibold hover:bg-gray-50 transition-colors shadow-sm">
                            Manage Plan <ChevronRight size={14} />
                          </button>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="space-y-2">
                          <div className="w-full h-1.5 bg-[#E5E0FF] rounded-full overflow-hidden">
                            <div className="w-[10%] h-full bg-[#5742FF] rounded-full" />
                          </div>
                          <div className="flex justify-between text-[11px] font-medium text-gray-500">
                            <span>Simulations Used</span>
                            <span className="text-gray-900 font-bold">2 / 20</span>
                          </div>
                        </div>
                      </div>

                      {/* Links List */}
                      <div className="flex flex-col gap-1 mb-5 relative z-10">
                        {[
                          { icon: User, title: "Profile Settings", sub: "Update your personal information", href: "/settings" },
                          { icon: Settings, title: "Account Settings", sub: "Manage your account preferences", href: "/settings" },
                          { icon: CreditCard, title: "Billing & Subscription", sub: "View invoices and payment methods", href: null },
                          { icon: HelpCircle, title: "Help & Support", sub: "Get help and view documentation", href: null }
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

        {/* Logout Confirmation Modal */}
        <AnimatePresence>
          {showLogoutConfirm && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                onClick={() => setShowLogoutConfirm(false)}
              />
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 10 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }} 
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="bg-white p-6 w-full max-w-sm rounded-[24px] shadow-2xl relative z-10 flex flex-col items-center text-center"
              >
                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-4">
                  <LogOut size={24} strokeWidth={2.5} />
                </div>
                <h3 className="text-xl font-bold text-[#111827] mb-2">Ready to leave?</h3>
                <p className="text-sm text-gray-500 mb-6">Are you sure you want to log out of your account?</p>
                <div className="w-full flex gap-3">
                  <button 
                    onClick={() => setShowLogoutConfirm(false)} 
                    className="flex-1 py-3 rounded-full text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={logout} 
                    className="flex-1 py-3 rounded-full text-white text-sm font-semibold bg-red-500 hover:bg-red-600 transition-colors"
                  >
                    Log Out
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
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
                <button onClick={logout} className="h-10 rounded-full px-4 text-[13px] text-[#1d1d1f]/70 transition-colors hover:bg-black/[0.04] hover:text-[#1d1d1f]">
                  Log out
                </button>
                <Link href="/dashboard" className="inline-flex h-10 items-center rounded-full bg-gradient-to-b from-[#6a57ff] to-[#5742FF] px-5 text-[13px] font-medium text-white shadow-[0_6px_16px_-6px_rgba(87,66,255,.7),inset_0_1px_0_rgba(255,255,255,.35)] transition-transform hover:scale-[1.03] active:scale-[0.97]">
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="inline-flex h-10 items-center rounded-full px-4 text-[13px] text-[#1d1d1f]/70 transition-colors hover:bg-black/[0.04] hover:text-[#1d1d1f]">
                  Log in
                </Link>
                <Link href="/signup" className="inline-flex h-10 items-center rounded-full bg-gradient-to-b from-[#6a57ff] to-[#5742FF] px-5 text-[13px] font-medium text-white shadow-[0_6px_16px_-6px_rgba(87,66,255,.7),inset_0_1px_0_rgba(255,255,255,.35)] transition-transform hover:scale-[1.03] active:scale-[0.97]">
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
                    <button onClick={logout} className="h-11 text-[15px] text-[#1d1d1f]/75">
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
    </>
  );
}
