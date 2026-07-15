"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, UserPlus, Menu, X, LogOut, LayoutDashboard } from "lucide-react";
import { GlitchText } from "@/components/ui/GlitchText";
import { JustCmul8Icon } from "@/components/ui/JustCmul8Icon";
import { createClient } from "@/lib/supabase/client";

const navLinks = [
  { label: "Features", href: "/#features" },
  { label: "Engine",   href: "/#engine" },
  { label: "Security", href: "/#security" },
  { label: "Pricing",  href: "/#pricing" },
];

function Divider() {
  return (
    <span
      className="hidden md:block flex-shrink-0 w-px h-5 pointer-events-none"
      style={{ background: "linear-gradient(to bottom, transparent, rgba(0,242,255,0.35), transparent)" }}
    />
  );
}

export default function Navbar() {
  const pathname     = usePathname();
  const router       = useRouter();
  const supabase     = createClient();
  const [scrolled, setScrolled]     = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [userEmail, setUserEmail]   = React.useState<string | null>(null);
  const isLanding = pathname === "/";

  React.useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

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

  return (
    <>
      {/* ── Floating glass background (outside motion.nav so backdrop-filter works) ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="fixed top-3 left-0 right-0 z-40 pointer-events-none flex justify-center"
      >
        <div
          className="w-full transition-all duration-500"
          style={{
            maxWidth: "1040px",
            height: "56px",
            background: scrolled
              ? "linear-gradient(135deg, rgba(0,0,0,0.7), rgba(5,5,15,0.75))"
              : "linear-gradient(135deg, rgba(0,0,0,0.35), rgba(5,5,15,0.4))",
            backdropFilter: scrolled ? "blur(20px)" : "blur(8px)",
            WebkitBackdropFilter: scrolled ? "blur(20px)" : "blur(8px)",
            boxShadow: scrolled
              ? "0 0 0 1px rgba(0,242,255,0.18), 0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(0,242,255,0.06)"
              : "0 0 0 1px rgba(0,242,255,0.1), 0 4px 16px rgba(0,0,0,0.3)",
            position: "relative",
          }}
        >
          {/* Glowing bottom edge line */}
          <div
            className="absolute bottom-0 left-4 right-4 h-px"
            style={{
              background: "linear-gradient(to right, transparent, rgba(0,242,255,0.6) 30%, rgba(0,242,255,0.6) 70%, transparent)",
              boxShadow: "0 0 6px rgba(0,242,255,0.4)",
            }}
          />
          {/* Corner brackets */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `
              linear-gradient(to right,  rgba(0,242,255,0.7), rgba(0,242,255,0.7)) 0 0    / 12px 2px no-repeat,
              linear-gradient(to bottom, rgba(0,242,255,0.7), rgba(0,242,255,0.7)) 0 0    / 2px 12px no-repeat,
              linear-gradient(to left,   rgba(0,242,255,0.7), rgba(0,242,255,0.7)) 100% 0    / 12px 2px no-repeat,
              linear-gradient(to bottom, rgba(0,242,255,0.7), rgba(0,242,255,0.7)) 100% 0    / 2px 12px no-repeat,
              linear-gradient(to right,  rgba(0,242,255,0.7), rgba(0,242,255,0.7)) 0 100% / 12px 2px no-repeat,
              linear-gradient(to top,    rgba(0,242,255,0.7), rgba(0,242,255,0.7)) 0 100% / 2px 12px no-repeat,
              linear-gradient(to left,   rgba(0,242,255,0.7), rgba(0,242,255,0.7)) 100% 100% / 12px 2px no-repeat,
              linear-gradient(to top,    rgba(0,242,255,0.7), rgba(0,242,255,0.7)) 100% 100% / 2px 12px no-repeat
            `,
          }} />
        </div>
      </motion.div>

      {/* ── Actual nav content ── */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="fixed top-3 left-0 right-0 z-50 pointer-events-none flex justify-center"
        aria-label="Main navigation"
      >
        <div className="w-full pointer-events-auto" style={{ maxWidth: "1040px" }}>
          <div className="flex items-center h-14 px-5 gap-4">

            {/* ── Logo ── */}
            <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
              <div className="relative w-6 h-6 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12 flex items-center justify-center">
                <JustCmul8Icon className="w-full h-full text-neon-cyan drop-shadow-[0_0_6px_rgba(0,242,255,0.8)]" />
              </div>
              <span
                className="font-display font-bold text-sm tracking-widest"
                style={{ fontFamily: "var(--font-display)", color: "var(--neon-cyan)" }}
              >
                <GlitchText intensity="normal">JUSTCMUL8</GlitchText>
              </span>
            </Link>

            {/* ── Landing nav links (only on homepage) ── */}
            {isLanding && (
              <>
                <Divider />
                <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
                  {navLinks.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      className="group relative px-3 py-1 text-xs tracking-widest uppercase transition-all duration-200"
                      style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}
                    >
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        style={{ color: "rgba(0,242,255,0.5)", fontFamily: "var(--font-mono)" }}
                      >//</span>
                      <span className="group-hover:text-[var(--neon-cyan)] group-hover:pl-4 transition-all duration-200">
                        {link.label}
                      </span>
                      <span
                        className="absolute bottom-0 left-3 right-3 h-px scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"
                        style={{ background: "rgba(0,242,255,0.6)", boxShadow: "0 0 4px rgba(0,242,255,0.6)" }}
                      />
                    </a>
                  ))}
                </div>
              </>
            )}

            {/* ── Right side: auth-aware CTAs ── */}
            <div className="hidden md:flex items-center gap-2 flex-shrink-0 ml-auto">
              <Divider />
              {isAuthenticated ? (
                /* Logged-in state */
                <>
                  <Link
                    href="/dashboard"
                    className="btn-cyber-ghost"
                    style={{ padding: "6px 14px", fontSize: "0.7rem", letterSpacing: "0.1em" }}
                  >
                    <LayoutDashboard size={12} />
                    DASHBOARD
                  </Link>
                  <button
                    onClick={logout}
                    className="btn-cyber-ghost"
                    style={{ padding: "6px 14px", fontSize: "0.7rem", letterSpacing: "0.1em" }}
                  >
                    <LogOut size={12} />
                    LOGOUT
                  </button>
                </>
              ) : (
                /* Guest state */
                <>
                  <Link
                    href="/login"
                    className="btn-cyber-ghost"
                    style={{ padding: "6px 16px", fontSize: "0.7rem", letterSpacing: "0.12em" }}
                  >
                    <LogIn size={12} />
                    LOGIN
                  </Link>
                  <Link
                    href="/signup"
                    className="btn-cyber-primary animate-pulse-glow"
                    style={{ padding: "6px 16px", fontSize: "0.7rem", letterSpacing: "0.12em" }}
                  >
                    <UserPlus size={12} />
                    GET STARTED
                  </Link>
                </>
              )}
            </div>

            {/* ── Mobile toggle ── */}
            <button
              className="md:hidden ml-auto p-1.5 transition-colors duration-200"
              style={{ color: "var(--neon-cyan)" }}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          {/* ── Mobile dropdown ── */}
          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scaleY: 0.95 }}
                animate={{ opacity: 1, y: 0, scaleY: 1 }}
                exit={{ opacity: 0, y: -8, scaleY: 0.95 }}
                transition={{ duration: 0.2 }}
                className="md:hidden mt-1 px-5 py-4 space-y-3"
                style={{
                  background: "rgba(0,0,0,0.85)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  border: "1px solid rgba(0,242,255,0.15)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                }}
              >
                {isLanding && navLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="block text-xs uppercase tracking-widest py-1.5 border-b transition-colors duration-200"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-secondary)",
                      borderColor: "rgba(0,242,255,0.08)",
                    }}
                  >
                    // {link.label}
                  </a>
                ))}
                <div className="flex gap-3 pt-2">
                  {isAuthenticated ? (
                    <>
                      <Link href="/dashboard" className="btn-cyber-ghost flex-1" style={{ padding: "8px 12px", fontSize: "0.7rem" }}>Dashboard</Link>
                      <button onClick={logout} className="btn-cyber-ghost flex-1" style={{ padding: "8px 12px", fontSize: "0.7rem" }}>Logout</button>
                    </>
                  ) : (
                    <>
                      <Link href="/login"  className="btn-cyber-ghost flex-1" style={{ padding: "8px 12px", fontSize: "0.7rem" }}>Login</Link>
                      <Link href="/signup" className="btn-cyber-primary flex-1" style={{ padding: "8px 12px", fontSize: "0.7rem" }}>Get Started</Link>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.nav>
    </>
  );
}
