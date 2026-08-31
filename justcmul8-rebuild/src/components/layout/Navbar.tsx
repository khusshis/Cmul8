"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, UserPlus, Menu, X, LogOut, LayoutDashboard, Plus, Crown, Calendar, Rocket, User, Settings, CreditCard, HelpCircle, ChevronRight } from "lucide-react";
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
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const [userEmail, setUserEmail]   = React.useState<string | null>(null);
  const isLanding = pathname === "/";

  // Listen for scroll
  React.useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

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
      <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-6">
        <div 
          className="w-full flex items-center justify-between px-6 py-3 rounded-full bg-white/90 backdrop-blur-xl border border-white/60 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)]"
          style={{ maxWidth: "1280px" }}
        >
          {/* Left: Branding */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center group flex-shrink-0 relative w-48 h-12">
              <img 
                src="/logo-full-transparent.png" 
                alt="JustCmul8 Logo" 
                className="absolute left-0 top-1/2 -translate-y-1/2 h-[80px] md:h-[100px] w-auto object-contain origin-left"
              />
            </Link>

            <div className="w-px h-8 bg-gray-200" />

            {/* Center Breadcrumb */}
            <div className="flex items-center gap-2">
              <Link href="/dashboard" className="flex items-center gap-2 px-3 py-2 rounded-full text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                <span className="text-[13px] font-semibold">Home</span>
              </Link>
              
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-300 mx-1"><polyline points="9 18 15 12 9 6"/></svg>

              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#F5F3FF] text-[#5742FF]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                <span className="text-[13px] font-bold">My Simulations</span>
              </div>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-4 relative">

            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('open-new-sim-modal'))}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-white transition-all hover:shadow-[0_8px_20px_-6px_rgba(87,66,255,0.4)] hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #5742FF, #4531E5)" }}
            >
              <Plus size={16} strokeWidth={2.5} />
              <span className="text-[13px] font-bold">New Simulation</span>
            </button>

            <div className="w-px h-8 bg-gray-200 mx-1" />

            <button onClick={() => setShowLogoutConfirm(true)} className="flex items-center gap-2 px-3 py-2 rounded-full text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all">
              <LogOut size={16} strokeWidth={2} />
              <span className="text-[13px] font-semibold">Logout</span>
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
                              <h5 className="font-bold text-[#111827] text-[14px]">You're on Pro Plan</h5>
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
                          { icon: User, title: "Profile Settings", sub: "Update your personal information" },
                          { icon: Settings, title: "Account Settings", sub: "Manage your account preferences" },
                          { icon: CreditCard, title: "Billing & Subscription", sub: "View invoices and payment methods" },
                          { icon: HelpCircle, title: "Help & Support", sub: "Get help and view documentation" }
                        ].map((item, idx) => (
                          <button key={idx} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors group text-left">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-white group-hover:shadow-sm transition-all">
                              <item.icon size={16} strokeWidth={2} />
                            </div>
                            <div className="flex-1">
                              <h6 className="font-bold text-[#111827] text-[13px]">{item.title}</h6>
                              <p className="text-[11px] text-gray-500">{item.sub}</p>
                            </div>
                            <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                          </button>
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

  // Landing Page Navbar
  return (
    <>
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

      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="fixed top-3 left-0 right-0 z-50 pointer-events-none flex justify-center px-4"
        aria-label="Main navigation"
      >
        <div className="w-full pointer-events-auto" style={{ maxWidth: "1040px" }}>
          <div className="flex items-center h-14 px-6 gap-6">

            <Link href="/" className="flex items-center group flex-shrink-0 h-full relative w-40">
              <img 
                src="/logo-full-transparent.png" 
                alt="JustCmul8 Logo" 
                className="absolute left-0 top-1/2 -translate-y-1/2 h-[70px] md:h-[90px] w-auto object-contain origin-left"
              />
            </Link>

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

            <div className="hidden md:flex items-center gap-4 flex-shrink-0 ml-auto">
              {isLanding && <Divider />}
              {isAuthenticated ? (
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

            <button
              className="md:hidden ml-auto p-1.5"
              style={{ color: "var(--color-text-primary)" }}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

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
