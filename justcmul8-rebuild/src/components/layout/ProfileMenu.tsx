"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Crown, Calendar, Rocket, Coins, User, Settings, CreditCard, HelpCircle, ChevronRight, Gift } from "lucide-react";
import LogoutDialog from "@/components/ui/LogoutDialog";
import { PLAN_CREDITS, TRIAL_DAYS, isComplimentary, type Billing } from "@/lib/billing/plans";
import { createClient } from "@/lib/supabase/client";

/** Avatar button + account menu (plan, credits, settings links, logout). Used by the dashboard navbar and the editor header. */
export default function ProfileMenu({ avatarClass = "w-9 h-9 text-[14px]" }: { avatarClass?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [account, setAccount] = React.useState<{ name: string; joined: string | null } | null>(null);
  const [billing, setBilling] = React.useState<Billing | null>(null);

  // Real profile: name from the profile row, join date from the account.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  const loadBilling = React.useCallback(() => {
    fetch("/api/billing").then((r) => (r.ok ? r.json() : null)).then((b) => b && setBilling(b)).catch(() => {});
  }, []);
  React.useEffect(() => { if (userEmail) loadBilling(); }, [userEmail, loadBilling]);

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setShowLogoutConfirm(false);
    router.push("/");
    router.refresh();
  }

  const displayName = account?.name || userEmail?.split("@")[0] || "";
  const initial = (displayName || "?").charAt(0).toUpperCase();

  return (
    <>
            <div className="relative">
          <button 
            onClick={() => { if (!profileOpen) loadBilling(); setProfileOpen(!profileOpen); }}
            aria-label="Account menu"
            aria-expanded={profileOpen}
            className="flex items-center gap-1.5 p-1 rounded-full hover:bg-gray-50 transition-colors"
          >
            <div className={`${avatarClass} rounded-full bg-sf-5742ff flex items-center justify-center text-white font-bold shadow-sm`}>
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
                  className="absolute right-0 top-[calc(100%+12px)] w-[380px] bg-surface rounded-[24px] shadow-[0_12px_40px_-8px_rgba(0,0,0,0.15)] dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,.7)] border border-gray-100 p-5 z-50 pointer-events-auto"
                >
                  {/* Triangle pointer */}
                  <div className="absolute -top-2 right-5 w-4 h-4 bg-surface border-l border-t border-gray-100 rotate-45" />
                  
                  {/* Header */}
                  <div className="flex items-center gap-4 mb-5 relative z-10">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full bg-linear-to-br from-sf-8b5cf6 to-sf-5742ff flex items-center justify-center text-white font-semibold text-[28px] shadow-sm">
                        {initial}
                      </div>
                      <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-green-500 border-2 border-surface" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="font-bold text-[17px] text-fg-111827 truncate">{displayName}</h4>
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
                  <div className="bg-sf-f8f7ff rounded-[16px] p-4 mb-5 relative z-10">
                    {billing ? (() => {
                      const pro = billing.plan !== "free";
                      const allowance = PLAN_CREDITS[billing.plan];
                      const used = Math.max(0, allowance - billing.credits);
                      const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "");
                      const sub =
                        !pro ? `${allowance} credits a month. Try Pro free for ${TRIAL_DAYS} days.` :
                        isComplimentary(billing) ? "Complimentary plan. Not billed." :
                        billing.status === "trialing" ? `Trial ends ${day(billing.trial_ends_at)}. Cancel any time.` :
                        billing.status === "past_due" ? "Payment failed. Razorpay is retrying." :
                        billing.cancel_at_period_end ? `Ends ${day(billing.current_period_end)}.` :
                        `Renews ${day(billing.current_period_end)} · billed ${billing.billing_interval}.`;
                      return (
                        <>
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="flex gap-3 min-w-0">
                              <div className="w-9 h-9 shrink-0 rounded-full bg-surface flex items-center justify-center text-fg-5742ff shadow-sm">
                                {pro ? <Rocket size={18} strokeWidth={2} /> : <Gift size={18} strokeWidth={2} />}
                              </div>
                              <div className="min-w-0">
                                <h5 className="font-bold text-fg-111827 text-[14px]">
                                  {!pro ? "You're on the Free plan" : billing.status === "trialing" ? "You're on a Pro trial" : "You're on Pro"}
                                </h5>
                                <p className="text-[12px] text-gray-500 leading-snug mt-0.5">{sub}</p>
                              </div>
                            </div>
                            <Link
                              href="/settings?tab=billing"
                              onClick={() => setProfileOpen(false)}
                              className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-colors shadow-sm ${pro ? "bg-surface border border-gray-200 text-fg-5742ff hover:bg-gray-50" : "bg-sf-5742ff text-white hover:bg-sf-4a36e6"}`}
                            >
                              {pro ? "Manage" : "Upgrade"} <ChevronRight size={14} />
                            </Link>
                          </div>
                          <div className="space-y-2">
                            <div className="w-full h-1.5 bg-sf-e5e0ff rounded-full overflow-hidden">
                              <motion.div className="h-full bg-sf-5742ff rounded-full" initial={{ width: 0 }} animate={{ width: `${Math.min(100, (used / allowance) * 100)}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
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
                        <div className="h-4 w-1/2 rounded-full bg-sf-e5e0ff" />
                        <div className="h-3 w-3/4 rounded-full bg-sf-ece9ff" />
                        <div className="h-1.5 w-full rounded-full bg-sf-e5e0ff" />
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
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-surface group-hover:shadow-sm transition-all">
                            <item.icon size={16} strokeWidth={2} />
                          </div>
                          <div className="flex-1">
                            <h6 className="font-bold text-fg-111827 text-[13px]">{item.title}</h6>
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
                    className="w-full flex flex-col items-center justify-center p-4 rounded-[16px] bg-sf-fff5f5 hover:bg-sf-ffebeb transition-colors relative z-10"
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
      <LogoutDialog open={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} onConfirm={logout} name={displayName} email={userEmail ?? ""} />
    </>
  );
}
