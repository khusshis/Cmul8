"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, UserPlus, Menu, X, LogOut, LayoutDashboard } from "lucide-react";
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
      style={{ background: "var(--color-border)" }}
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
      {/* Floating glass background */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="fixed top-3 left-0 right-0 z-40 pointer-events-none flex justify-center px-4"
      >
        <div
          className="w-full transition-all duration-500 rounded-full"
          style={{
            maxWidth: "1040px",
            height: "56px",
            background: scrolled
              ? "rgba(var(--color-bg-rgb, 255, 255, 255), 0.9)"
              : "rgba(var(--color-bg-rgb, 255, 255, 255), 0.7)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: scrolled
              ? "0 4px 20px rgba(0,0,0,0.08), 0 0 0 1px var(--color-border)"
              : "0 0 0 1px var(--color-border)",
          }}
        />
      </motion.div>

      {/* Actual nav content */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="fixed top-3 left-0 right-0 z-50 pointer-events-none flex justify-center px-4"
        aria-label="Main navigation"
      >
        <div className="w-full pointer-events-auto" style={{ maxWidth: "1040px" }}>
          <div className="flex items-center h-14 px-6 gap-6">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
              <div className="w-6 h-6 flex items-center justify-center text-accent">
                <JustCmul8Icon className="w-full h-full" style={{ color: "var(--color-info)" }} />
              </div>
              <span
                className="font-bold text-lg tracking-tight"
                style={{ color: "var(--color-text-primary)" }}
              >
                JustCmul8
              </span>
            </Link>

            {/* Landing nav links (only on homepage) */}
            {isLanding && (
              <>
                <Divider />
                <div className="hidden md:flex items-center gap-6 flex-1 justify-center">
                  {navLinks.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      className="text-sm font-medium transition-colors hover:opacity-80"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </>
            )}

            {/* Right side: auth-aware CTAs */}
            <div className="hidden md:flex items-center gap-4 flex-shrink-0 ml-auto">
              {isLanding && <Divider />}
              {isAuthenticated ? (
                /* Logged-in state */
                <>
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    <LayoutDashboard size={16} />
                    Dashboard
                  </Link>
                  <button
                    onClick={logout}
                    className="flex items-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </>
              ) : (
                /* Guest state */
                <>
                  <Link
                    href="/login"
                    className="flex items-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    <LogIn size={16} />
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    className="flex items-center gap-2 py-1.5 px-4 rounded-full text-white font-medium transition-opacity hover:opacity-90"
                    style={{ backgroundColor: "var(--color-info)" }}
                  >
                    <UserPlus size={16} />
                    Get Started
                  </Link>
                </>
              )}
            </div>

            {/* Mobile toggle */}
            <button
              className="md:hidden ml-auto p-1.5"
              style={{ color: "var(--color-text-primary)" }}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          {/* Mobile dropdown */}
          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scaleY: 0.95 }}
                animate={{ opacity: 1, y: 0, scaleY: 1 }}
                exit={{ opacity: 0, y: -8, scaleY: 0.95 }}
                transition={{ duration: 0.2 }}
                className="md:hidden mt-2 px-6 py-4 space-y-4 rounded-2xl"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
                }}
              >
                {isLanding && navLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="block text-sm font-medium py-2 border-b"
                    style={{
                      color: "var(--color-text-secondary)",
                      borderColor: "var(--color-border)",
                    }}
                  >
                    {link.label}
                  </a>
                ))}
                <div className="flex flex-col gap-3 pt-2">
                  {isAuthenticated ? (
                    <>
                      <Link href="/dashboard" className="py-2 text-center text-sm font-medium rounded" style={{ border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}>Dashboard</Link>
                      <button onClick={logout} className="py-2 text-center text-sm font-medium rounded" style={{ border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}>Logout</button>
                    </>
                  ) : (
                    <>
                      <Link href="/login" className="py-2 text-center text-sm font-medium rounded" style={{ border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}>Login</Link>
                      <Link href="/signup" className="py-2 text-center text-sm font-medium rounded text-white" style={{ backgroundColor: "var(--color-info)" }}>Get Started</Link>
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
