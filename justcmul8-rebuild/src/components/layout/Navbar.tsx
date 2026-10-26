"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useLenis } from "lenis/react";
import { LogOut, Plus } from "lucide-react";
import LogoutDialog from "@/components/ui/LogoutDialog";
import { MARK_SRC } from "@/components/brand/CubeMark";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ui/ThemeToggle";
import ProfileMenu from "@/components/layout/ProfileMenu";

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
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const [userEmail, setUserEmail]   = React.useState<string | null>(null);
  const [account, setAccount] = React.useState<{ name: string; joined: string | null } | null>(null);
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

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setShowLogoutConfirm(false);
    router.push("/");
    router.refresh();
  }

  const displayName = account?.name || userEmail?.split("@")[0] || "";
  const logoutDialog = (
    <LogoutDialog open={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} onConfirm={logout} name={displayName} email={userEmail ?? ""} />
  );

  const isAuthenticated = userEmail !== null;
  const isDashboard = pathname.startsWith("/dashboard");

  if (isDashboard) {
    return (
      <div className="fixed top-3 left-0 right-0 z-50 flex justify-center px-3 sm:px-6">
        <div
          className="w-full flex h-14 items-center justify-between rounded-full border border-white/80 bg-surface/65 pl-5 pr-2 shadow-[0_12px_40px_-12px_rgba(16,24,40,.25),inset_0_1px_0_rgba(255,255,255,.95),inset_0_-1px_0_rgba(16,24,40,.05)] dark:border-white/[0.07] dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,.6),inset_0_1px_0_rgba(255,255,255,.06)]"
          style={{ maxWidth: "1280px", backdropFilter: "saturate(180%) blur(24px)", WebkitBackdropFilter: "saturate(180%) blur(24px)" }}
        >
          {/* Left: Branding */}
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/" aria-label="JustCmul8 home" className="group flex shrink-0 items-center gap-2">
              <img src={MARK_SRC} alt="" className="h-[24px] w-auto transition-transform duration-300 group-hover:-rotate-6" />
              <span className="hidden sm:block font-space text-[16px] font-bold tracking-tight text-fg-1d1d1f">JustCmul8</span>
            </Link>

            <div className="hidden md:block w-px h-6 bg-ink/[0.08]" />

            {/* Center Breadcrumb */}
            {/* Breadcrumb: recessed track with a glass pill on the current page */}
            <div className="hidden md:flex items-center rounded-full bg-ink/[0.035] p-1 shadow-[inset_0_1px_2px_rgba(16,24,40,.06)]">
              <Link href="/" className="flex h-9 items-center rounded-full px-3.5 text-[13px] text-fg-1d1d1f/65 transition-colors hover:text-fg-1d1d1f">
                Home
              </Link>
              <span className="flex h-9 items-center rounded-full border border-surface bg-linear-to-b from-surface to-surface/70 px-3.5 text-[13px] font-medium text-fg-1d1d1f shadow-[0_2px_8px_-2px_rgba(16,24,40,.18),inset_0_1px_0_#fff] dark:border-white/[0.06] dark:from-white/[0.13] dark:to-white/[0.07] dark:shadow-[0_2px_8px_-2px_rgba(0,0,0,.5),inset_0_1px_0_rgba(255,255,255,.08)]">
                My Simulations
              </span>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 relative">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-new-sim-modal'))}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-linear-to-b from-sf-6a57ff to-sf-5742ff border border-ln-8d80ff px-4 sm:px-5 text-[13px] font-medium text-white shadow-[0_6px_16px_-6px_rgba(87,66,255,.7),inset_0_1px_0_rgba(255,255,255,.35)] transition-transform hover:scale-[1.03] active:scale-[0.97]"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span className="hidden sm:inline">New Simulation</span>
            </button>

            <ThemeToggle className="h-10 w-10" />

            <button onClick={() => setShowLogoutConfirm(true)} className="hidden sm:inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] text-fg-1d1d1f/70 transition-colors hover:bg-ink/[0.04] hover:text-fg-1d1d1f">
              <LogOut size={15} strokeWidth={2} />
              Log out
            </button>

            <ProfileMenu />
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
              ? "bg-surface/65 border-white/80 shadow-[0_12px_40px_-12px_rgba(16,24,40,.25),inset_0_1px_0_rgba(255,255,255,.95),inset_0_-1px_0_rgba(16,24,40,.05)] dark:border-white/[0.07] dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,.6),inset_0_1px_0_rgba(255,255,255,.06)]"
              : "bg-white/45 border-white/70 shadow-[0_8px_30px_-14px_rgba(16,24,40,.18),inset_0_1px_0_rgba(255,255,255,.9),inset_0_-1px_0_rgba(16,24,40,.04)] dark:bg-surface/45 dark:border-white/[0.06] dark:shadow-[0_8px_30px_-14px_rgba(0,0,0,.5),inset_0_1px_0_rgba(255,255,255,.05)]"
          }`}
          style={{ backdropFilter: "saturate(180%) blur(24px)", WebkitBackdropFilter: "saturate(180%) blur(24px)" }}
        >
          <Link href="/" aria-label="JustCmul8 home" className="group flex shrink-0 items-center gap-2">
            <img src={MARK_SRC} alt="" className="h-[24px] w-auto transition-transform duration-300 group-hover:-rotate-6" />
            <span className="font-space text-[16px] font-bold tracking-tight text-fg-1d1d1f">JustCmul8</span>
          </Link>

          {isLanding && (
            <ul
              className="mx-auto hidden items-center rounded-full bg-ink/[0.035] p-1 shadow-[inset_0_1px_2px_rgba(16,24,40,.06)] lg:flex"
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
                        className="absolute inset-0 rounded-full border border-surface bg-linear-to-b from-surface to-surface/70 shadow-[0_2px_8px_-2px_rgba(16,24,40,.18),0_0_0_0.5px_rgba(16,24,40,.06),inset_0_1px_0_#fff] dark:border-white/[0.06] dark:from-white/[0.13] dark:to-white/[0.07] dark:shadow-[0_2px_8px_-2px_rgba(0,0,0,.5),inset_0_1px_0_rgba(255,255,255,.08)]"
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
                        on ? "font-medium text-fg-1d1d1f" : "text-fg-1d1d1f/65 hover:text-fg-1d1d1f"
                      }`}
                    >
                      {link.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-1">
          <ThemeToggle className="h-10 w-10 border-transparent! bg-transparent! hover:bg-ink/[0.05]!" />
          <div className="hidden items-center gap-1 lg:flex">
            {isAuthenticated ? (
              <>
                <button onClick={() => { setMobileOpen(false); setShowLogoutConfirm(true); }} className="h-10 rounded-full px-4 text-[13px] text-fg-1d1d1f/70 transition-colors hover:bg-ink/[0.04] hover:text-fg-1d1d1f">
                  Log out
                </button>
                <Link href="/dashboard" className="inline-flex h-10 items-center rounded-full bg-linear-to-b from-sf-6a57ff to-sf-5742ff border border-ln-8d80ff px-5 text-[13px] font-medium text-white shadow-[0_6px_16px_-6px_rgba(87,66,255,.7),inset_0_1px_0_rgba(255,255,255,.35)] transition-transform hover:scale-[1.03] active:scale-[0.97]">
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="inline-flex h-10 items-center rounded-full px-4 text-[13px] text-fg-1d1d1f/70 transition-colors hover:bg-ink/[0.04] hover:text-fg-1d1d1f">
                  Log in
                </Link>
                <Link href="/signup" className="inline-flex h-10 items-center rounded-full bg-linear-to-b from-sf-6a57ff to-sf-5742ff border border-ln-8d80ff px-5 text-[13px] font-medium text-white shadow-[0_6px_16px_-6px_rgba(87,66,255,.7),inset_0_1px_0_rgba(255,255,255,.35)] transition-transform hover:scale-[1.03] active:scale-[0.97]">
                  Get started
                </Link>
              </>
            )}
          </div>

          {/* Two lines that fold into an X */}
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-ink/[0.04] lg:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            <span className="relative block h-3 w-[18px]">
              <motion.span
                className="absolute inset-x-0 h-[1.5px] rounded-full bg-fg-1d1d1f"
                animate={mobileOpen ? { top: 5, rotate: 45 } : { top: 1, rotate: 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              />
              <motion.span
                className="absolute inset-x-0 h-[1.5px] rounded-full bg-fg-1d1d1f"
                animate={mobileOpen ? { top: 5, rotate: -45 } : { top: 9, rotate: 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              />
            </span>
          </button>
          </div>
        </div>
      </nav>

      {/* Mobile: full-screen sheet, big links cascading in */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-surface/95 px-8 pt-24 lg:hidden"
            style={{ backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ duration: 0.25 }}
          >
            <motion.ul initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } } }}>
              {(isLanding ? navLinks : []).map((link) => (
                <motion.li key={link.label} variants={{ hidden: { opacity: 0, y: -8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } } }}>
                  <a href={link.href} onClick={(e) => go(e, link.href)} className="block py-2 text-[28px] font-semibold tracking-[-0.02em] text-fg-1d1d1f">
                    {link.label}
                  </a>
                </motion.li>
              ))}
              <motion.li variants={{ hidden: { opacity: 0, y: -8 }, show: { opacity: 1, y: 0 } }} className="mt-8 flex flex-col gap-3 border-t border-ink/[0.08] pt-6">
                {isAuthenticated ? (
                  <>
                    <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="inline-flex h-11 items-center justify-center rounded-full bg-sf-5742ff text-[15px] font-medium text-white">
                      Dashboard
                    </Link>
                    <button onClick={() => { setMobileOpen(false); setShowLogoutConfirm(true); }} className="h-11 text-[15px] text-fg-1d1d1f/75">
                      Log out
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/signup" onClick={() => setMobileOpen(false)} className="inline-flex h-11 items-center justify-center rounded-full bg-sf-5742ff text-[15px] font-medium text-white">
                      Get started
                    </Link>
                    <Link href="/login" onClick={() => setMobileOpen(false)} className="inline-flex h-11 items-center justify-center text-[15px] text-fg-1d1d1f/75">
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
