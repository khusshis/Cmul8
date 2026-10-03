"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Building2, Check, Loader2, LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Backdrop, SplitWords, spring } from "@/components/landing/motionKit";
import { CubeMark, TEXT_SRC, TEXT_RATIO } from "@/components/brand/CubeMark";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import { CREDIT_COSTS, PLAN_CREDITS, PRO_FEATURES, PRO_PRICE, TRIAL_DAYS, type Interval } from "@/lib/billing/plans";
import { startProCheckout } from "@/lib/billing/checkout";
import PageScrollbar from "@/components/PageScrollbar";
import {
  CreditsScene, FlowField, LaunchOverlay, LineInput, PillChoice, ProfileScene, ROLES, RouteProgress, Stage, TEAM_SIZES, Ticker, WorldScene, sceneFor, usePointer,
} from "@/components/onboarding/OnboardingStage";

const EXPERIENCE = [
  { id: "new", label: "Brand new" },
  { id: "some", label: "Some experience" },
  { id: "expert", label: "Expert" },
];
const REFERRALS = ["Search", "Social media", "Friend or colleague", "YouTube", "Other"];

const COPY = [
  { eyebrow: "About you", title: "Let's set up", accent: "your workspace.", sub: "Tell us a little about yourself. Watch your profile come together on the right." },
  { eyebrow: "Your work", title: "What will you", accent: "simulate?", sub: "Pick every domain you work in. Your first pick becomes the default for new projects." },
  { eyebrow: "Your plan", title: "Power up", accent: "your workspace.", sub: `Start free, or try everything in Pro free for ${TRIAL_DAYS} days. You can switch any time.` },
];
const STAGE_LABELS = ["your-profile", "your-world", "your-plan"];
const STAGE_STATUS = ["Building your profile", "Loading your domains", "Charging your credits"];

const label = "text-[11px] font-bold uppercase tracking-[0.14em] text-[#94a3b8]";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const pointer = usePointer();
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [userId, setUserId] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [next, setNext] = React.useState("/dashboard");
  const [step, setStep] = React.useState(0);
  const [dir, setDir] = React.useState(1);
  const [busy, setBusy] = React.useState(false);
  const [launching, setLaunching] = React.useState(false);
  const [error, setError] = React.useState("");

  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [teamSize, setTeamSize] = React.useState("");
  const [useCases, setUseCases] = React.useState<string[]>([]);
  const [focusDomain, setFocusDomain] = React.useState<string | null>(null);
  const [experience, setExperience] = React.useState("");
  const [referral, setReferral] = React.useState("");
  const [plan, setPlan] = React.useState<"free" | "pro">("free");
  const [interval, setBillingInterval] = React.useState<Interval>("monthly");

  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const n = q.get("next");
    if (n && n.startsWith("/") && !n.startsWith("//")) setNext(n);
    if (q.get("plan") === "pro") setPlan("pro");
    if (q.get("billing") === "yearly") setBillingInterval("yearly");
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      setEmail(user.email || "");
      const meta = user.user_metadata as { full_name?: string; name?: string };
      // Prefill only; never clobber what the user already typed while this loaded.
      setName((typed) => typed || meta?.full_name || meta?.name || "");
    });
  }, [supabase, router]);

  // Move focus to the new question so keyboard and screen-reader users land on it.
  React.useEffect(() => { if (step > 0) headingRef.current?.focus({ preventScroll: true }); }, [step]);

  // Invited collaborators go straight to the shared project: their inviter's plan covers it.
  const invited = next.startsWith("/dashboard/project/");
  const steps = invited ? ["About you", "Launch"] : ["About you", "Your work", "Your plan", "Launch"];
  const questionCount = steps.length - 1;
  const last = step === questionCount - 1;

  const canContinue =
    step === 0 ? !!(name.trim() && role && teamSize) :
    step === 1 ? useCases.length > 0 && !!experience : true;

  const answered = [name.trim(), role, teamSize, ...(invited ? [] : [useCases.length ? "y" : "", experience, step >= 2 ? "y" : ""])];
  const progress = answered.filter(Boolean).length / answered.length;

  function go(to: number) { setDir(to > step ? 1 : -1); setError(""); setStep(to); }

  function toggleUseCase(id: string) {
    const nextCases = useCases.includes(id) ? useCases.filter((x) => x !== id) : [...useCases, id];
    setUseCases(nextCases);
    setFocusDomain(nextCases.includes(id) ? id : nextCases[nextCases.length - 1] ?? null);
  }

  async function saveProfile() {
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      display_name: name.trim(),
      job_role: role,
      company: company.trim() || null,
      team_size: teamSize,
      use_cases: useCases,
      experience: experience || null,
      referral_source: referral || null,
      ...(useCases[0] ? { default_sim_type: useCases[0] } : {}),
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }

  async function markOnboarded() {
    await supabase.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", userId);
    const { error } = await supabase.auth.updateUser({ data: { onboarded: true, full_name: name.trim() } });
    if (error) throw new Error(error.message);
  }

  async function finish(choice: "free" | "pro") {
    setBusy(true); setError("");
    try {
      await saveProfile();
      if (choice === "pro") {
        const billing = await startProCheckout(interval, { email, name: name.trim() });
        if (!billing) {
          setError("Checkout was closed. Try again, or continue on Free and upgrade later from Settings.");
          setBusy(false);
          return;
        }
      }
      setPlan(choice);
      setStep(questionCount); // route reaches "Launch"
      setLaunching(true);
      await Promise.all([markOnboarded(), sleep(2600)]); // let the launch sequence play
      router.push(next);
      router.refresh();
    } catch (e) {
      setLaunching(false);
      setStep(questionCount - 1);
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canContinue || busy || !userId) return;
    if (!last) go(step + 1);
    else finish(invited ? "free" : plan);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const copy = invited ? { ...COPY[0], title: "Join your team", accent: "in one step.", sub: "Tell us who you are, then we'll take you straight to the shared project." } : COPY[step] ?? COPY[2];
  const firstScene = sceneFor(useCases[0] ?? "human_queue");
  const launchLines = invited
    ? ["Profile saved", "Opening your shared project"]
    : [
        "Workspace created",
        `${SIM_TYPE_REGISTRY[(useCases[0] ?? "human_queue") as keyof typeof SIM_TYPE_REGISTRY]?.label ?? firstScene.name} blocks loaded`,
        plan === "pro" ? `Pro trial active · ${PLAN_CREDITS.pro} credits` : `Free plan · ${PLAN_CREDITS.free} credits ready`,
      ];

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative flex min-h-screen flex-col overflow-x-clip bg-[#fafaff] lg:h-screen lg:min-h-[720px]">
        <Backdrop tone="a" />
        <FlowField pointer={pointer} />

        {/* Top bar */}
        <header className="relative z-10 mx-auto flex w-full max-w-[1400px] shrink-0 items-center justify-between px-4 pt-4 sm:px-8">
          <div className="flex items-center gap-2.5">
            <CubeMark mode="assemble" delay={0.1} className="w-8" />
            <motion.img
              src={TEXT_SRC} alt="JustCmul8" className="h-7 w-auto" style={{ aspectRatio: TEXT_RATIO }}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.5 }}
            />
          </div>
          <div className="flex items-center gap-3 text-[12.5px] font-semibold text-[#64748b]">
            <span className="hidden max-w-[220px] truncate sm:inline">{email}</span>
            <button type="button" onClick={signOut} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 hover:bg-black/[0.04] hover:text-[#161622]">
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </header>

        <main className="relative z-10 mx-auto grid w-full max-w-[1400px] min-h-0 flex-1 gap-6 px-4 pb-6 pt-4 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] lg:gap-12 lg:pt-5">
          {/* ── Live stage ── */}
          <div className="order-first h-[320px] sm:h-[400px] lg:order-none lg:col-start-2 lg:row-start-1 lg:h-full lg:min-h-0">
            <Stage pointer={pointer} label={STAGE_LABELS[Math.min(step, 2)]} domain={focusDomain ?? useCases[0] ?? "human_queue"} progress={progress} status={STAGE_STATUS[Math.min(step, 2)]}>
              {step === 0 && <ProfileScene name={name} role={role} company={company} teamSize={teamSize} />}
              {step === 1 && <WorldScene focus={focusDomain} selected={useCases} />}
              {step >= 2 && <CreditsScene plan={plan} interval={interval} />}
            </Stage>
          </div>

          {/* ── Questions ── */}
          <form onSubmit={onSubmit} className="relative flex min-h-0 flex-col lg:col-start-1 lg:row-start-1">
            <div className="max-w-[520px]">
              <RouteProgress steps={steps} step={step} />
            </div>

            <div className="relative flex min-h-0 flex-1 flex-col">
              <div ref={scrollRef} className="no-scrollbar relative min-h-0 flex-1 pt-6 lg:overflow-y-auto lg:pr-5 lg:pt-8">
                <AnimatePresence mode="wait" initial={false} custom={dir}>
                  <motion.div
                    key={step}
                    custom={dir}
                    variants={{
                      enter: (d: number) => ({ opacity: 0, x: d * 40 }),
                      center: { opacity: 1, x: 0 },
                      exit: (d: number) => ({ opacity: 0, x: d * -40 }),
                    }}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ ...spring(13, 0.85), opacity: { duration: 0.25 } }}
                  >
                    <motion.span
                      className="inline-flex items-center gap-2 rounded-full border border-[#e7e3ff] bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5742FF]"
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                    >
                      <span className="font-mono">{String(Math.min(step, questionCount - 1) + 1).padStart(2, "0")}</span>
                      <span className="h-3 w-px bg-[#d9d3fb]" />
                      {copy.eyebrow}
                    </motion.span>
                    <h1 ref={headingRef} tabIndex={-1} className="mt-3 font-space text-[2.1rem] font-bold leading-[1.04] tracking-[-0.035em] text-[#161622] outline-none sm:text-[2.6rem]">
                      <SplitWords key={copy.title} text={copy.title} accent={copy.accent} animateNow delay={0.05} />
                    </h1>
                    <motion.p className="mt-2.5 max-w-[480px] text-[14.5px] leading-relaxed text-[#64748b]" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}>
                      {copy.sub}
                    </motion.p>

                    <motion.div className="mt-6 max-w-[560px]" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring(12, 0.85, 0.3), opacity: { duration: 0.4, delay: 0.3 } }}>
                      {step === 0 && (
                        <div className="space-y-5">
                          <div>
                            <label className={label} htmlFor="ob-name">Your name</label>
                            <LineInput id="ob-name" big value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" autoFocus autoComplete="name" />
                          </div>
                          <div>
                            <p className={label}>What best describes you?</p>
                            <PillChoice
                              id="role" options={ROLES.map((r) => r.id)} value={role} onChange={setRole}
                              render={(o) => { const Icon = ROLES.find((r) => r.id === o)!.icon; return <><Icon size={14} strokeWidth={2.3} /> {o}</>; }}
                            />
                          </div>
                          <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
                            <div>
                              <label className={label} htmlFor="ob-company">Company <span className="normal-case tracking-normal font-medium">(optional)</span></label>
                              <LineInput id="ob-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Logistics" autoComplete="organization" />
                            </div>
                            <div>
                              <p className={label}>Team size</p>
                              <PillChoice id="team" options={TEAM_SIZES} value={teamSize} onChange={setTeamSize} />
                            </div>
                          </div>
                        </div>
                      )}

                      {step === 1 && (
                        <div className="space-y-5">
                          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                            {Object.values(SIM_TYPE_REGISTRY).map((cfg, i) => {
                              const s = sceneFor(cfg.id);
                              const order = useCases.indexOf(cfg.id);
                              const on = order >= 0;
                              return (
                                <motion.button
                                  key={cfg.id}
                                  type="button"
                                  aria-pressed={on}
                                  onClick={() => toggleUseCase(cfg.id)}
                                  onMouseEnter={() => on && setFocusDomain(cfg.id)}
                                  initial={{ opacity: 0, y: 14 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  whileHover={{ y: -3 }}
                                  whileTap={{ scale: 0.97 }}
                                  transition={{ ...spring(14, 0.75, 0.35 + i * 0.04), opacity: { duration: 0.3, delay: 0.35 + i * 0.04 } }}
                                  className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border bg-white/90 p-3 text-left"
                                  style={{ borderColor: on ? s.color : "#ecebf7", boxShadow: on ? `0 0 0 3px ${s.color}22, 0 14px 30px -18px ${s.color}` : undefined }}
                                >
                                  <motion.span
                                    className="absolute inset-0 origin-left"
                                    style={{ background: `linear-gradient(90deg, ${s.tint}, transparent 80%)` }}
                                    initial={false} animate={{ scaleX: on ? 1 : 0 }} transition={spring(14, 0.9)}
                                  />
                                  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:rotate-[-6deg]" style={{ background: on ? s.color : s.tint, color: on ? "#fff" : s.color }}>
                                    <s.icon size={20} strokeWidth={2.2} />
                                  </span>
                                  <span className="relative min-w-0">
                                    <span className="block truncate text-[14px] font-bold text-[#161622]">{cfg.label}</span>
                                    <span className="block truncate text-[12px] text-[#64748b]">{s.examples.join(" · ")}</span>
                                  </span>
                                  <AnimatePresence>
                                    {on && (
                                      <motion.span
                                        className="absolute right-2.5 top-2.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                                        style={{ background: s.color }}
                                        initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={spring(18, 0.55)}
                                      >
                                        {order === 0 ? <Check size={11} strokeWidth={3.5} /> : order + 1}
                                      </motion.span>
                                    )}
                                  </AnimatePresence>
                                </motion.button>
                              );
                            })}
                          </div>
                          <div>
                            <p className={label}>Experience with simulation</p>
                            <PillChoice id="exp" options={EXPERIENCE.map((x) => x.id)} value={experience} onChange={setExperience} render={(o) => EXPERIENCE.find((x) => x.id === o)!.label} />
                          </div>
                          <div>
                            <p className={label}>How did you hear about us? <span className="normal-case tracking-normal font-medium">(optional)</span></p>
                            <PillChoice id="ref" options={REFERRALS} value={referral} onChange={(r) => setReferral(referral === r ? "" : r)} />
                          </div>
                        </div>
                      )}

                      {step === 2 && (
                        <div>
                          <LayoutGroup id="billing">
                            <div className="inline-flex rounded-full bg-black/[0.04] p-1 text-[13px] font-bold shadow-[inset_0_1px_2px_rgba(16,24,40,.06)]">
                              {(["monthly", "yearly"] as const).map((b) => (
                                <button key={b} type="button" onClick={() => setBillingInterval(b)} className="relative rounded-full px-4 py-2">
                                  {interval === b && <motion.span layoutId="bill" className="absolute inset-0 rounded-full bg-white shadow-[0_2px_8px_-2px_rgba(16,24,40,.18)]" transition={spring(20, 0.85)} />}
                                  <span className={`relative ${interval === b ? "text-[#161622]" : "text-[#64748b]"}`}>
                                    {b === "monthly" ? "Monthly" : <>Yearly <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">−20%</span></>}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </LayoutGroup>

                          <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            {/* Free */}
                            <motion.button
                              type="button" role="radio" aria-checked={plan === "free"} onClick={() => setPlan("free")}
                              whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} transition={spring(16, 0.75)}
                              className={`relative rounded-[26px] border bg-white p-5 text-left transition-shadow ${plan === "free" ? "border-[#5742FF] shadow-[0_0_0_3px_rgba(87,66,255,.15),0_24px_50px_-28px_rgba(87,66,255,.5)]" : "border-[#ecebf7]"}`}
                            >
                              <div className="flex items-center justify-between">
                                <p className="font-space text-[19px] font-bold text-[#161622]">Free</p>
                                <SelectDot on={plan === "free"} />
                              </div>
                              <p className="mt-2"><span className="font-space text-[40px] font-bold leading-none tracking-[-0.04em] text-[#161622]">$0</span></p>
                              <p className="mt-1 text-[12px] font-medium text-[#94a3b8]">Free forever, no card</p>
                              <Perks items={[`${PLAN_CREDITS.free} credits every month`, "Visual builder & live results", "Monte Carlo & JSON export"]} />
                            </motion.button>

                            {/* Pro */}
                            <motion.button
                              type="button" role="radio" aria-checked={plan === "pro"} onClick={() => setPlan("pro")}
                              whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} transition={spring(16, 0.75)}
                              className={`relative overflow-hidden rounded-[26px] bg-gradient-to-b from-[#7a67ff] via-[#5742FF] to-[#4a36e6] p-5 text-left text-white ${plan === "pro" ? "shadow-[0_0_0_3px_rgba(87,66,255,.3),0_30px_60px_-24px_rgba(87,66,255,.75)]" : "opacity-90"}`}
                            >
                              <span aria-hidden className="lp-sheen pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                              <span aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.12) 1px, transparent 1.5px)", backgroundSize: "18px 18px", maskImage: "linear-gradient(180deg,#000,transparent 60%)", WebkitMaskImage: "linear-gradient(180deg,#000,transparent 60%)" }} />
                              <div className="relative flex items-center justify-between">
                                <p className="flex items-center gap-2 font-space text-[19px] font-bold">Pro <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#5742FF]">{TRIAL_DAYS} DAYS FREE</span></p>
                                <SelectDot on={plan === "pro"} light />
                              </div>
                              <p className="relative mt-2 flex items-end gap-1">
                                <span className="font-space text-[40px] font-bold leading-none tracking-[-0.04em]">$</span>
                                <span className="relative inline-flex overflow-hidden">
                                  <motion.span key={interval} className="font-space text-[40px] font-bold leading-none tracking-[-0.04em] tabular-nums" initial={{ y: "100%", opacity: 0 }} animate={{ y: "0%", opacity: 1 }} transition={spring(16, 0.85)}>
                                    {PRO_PRICE[interval]}
                                  </motion.span>
                                </span>
                                <span className="mb-1 text-[13px] text-white/70">/ mo</span>
                              </p>
                              <p className="relative mt-1 text-[12px] font-medium text-white/70">{interval === "yearly" ? `Billed $${PRO_PRICE.yearly * 12} yearly` : "Billed monthly"} after the trial</p>
                              <Perks light items={[`${PLAN_CREDITS.pro} credits every month`, ...PRO_FEATURES.map((f) => f[0].toUpperCase() + f.slice(1))]} />
                            </motion.button>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-[#64748b]">
                            <span>
                              {plan === "pro"
                                ? "Razorpay verifies your card now. No charge until the trial ends; cancel any time in Settings."
                                : `Credits: new simulation ${CREDIT_COSTS.create_simulation} · AI optimize ${CREDIT_COSTS.ai_optimize} · AI chat ${CREDIT_COSTS.ai_chat}`}
                            </span>
                            <a href="mailto:hello@justcmul8.com?subject=Enterprise%20plan" className="inline-flex items-center gap-1.5 font-semibold text-[#5742FF] hover:underline">
                              <Building2 size={14} /> Teams & SSO? Talk to sales
                            </a>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </motion.div>
                </AnimatePresence>

                <AnimatePresence>
                  {error && (
                    <motion.p
                      role="alert"
                      className="mt-6 max-w-[560px] rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-600"
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, x: [0, -8, 8, -4, 4, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <PageScrollbar target={scrollRef} />
            </div>

            {/* Footer actions */}
            <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex max-w-[592px] shrink-0 items-center justify-between gap-3 border-t border-[#ecebf7] bg-[#fafaff]/90 px-4 py-4 backdrop-blur lg:static lg:mx-0 lg:max-w-[560px] lg:bg-transparent lg:px-0 lg:pb-0 lg:backdrop-blur-none">
              {step > 0 ? (
                <button type="button" onClick={() => go(step - 1)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[14px] font-semibold text-[#64748b] hover:bg-black/[0.04] hover:text-[#161622]">
                  <ArrowLeft size={15} /> Back
                </button>
              ) : <span className="hidden text-[12px] font-medium text-[#94a3b8] sm:inline">Press <kbd className="rounded-md border border-[#e7e5f6] bg-white px-1.5 py-0.5 font-mono text-[11px]">Enter ↵</kbd> to continue</span>}
              <div className="ml-auto flex items-center gap-3">
                {last && !invited && plan === "pro" && (
                  <button type="button" onClick={() => finish("free")} disabled={busy} className="text-[13.5px] font-semibold text-[#64748b] hover:text-[#161622]">
                    Continue on Free
                  </button>
                )}
                <motion.button
                  type="submit"
                  disabled={!canContinue || busy || !userId}
                  whileHover={canContinue ? { scale: 1.03 } : undefined}
                  whileTap={canContinue ? { scale: 0.97 } : undefined}
                  className="group relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-b from-[#6a57ff] to-[#5742FF] border border-[#8d80ff] px-7 text-[14.5px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(87,66,255,.8),inset_0_1px_0_rgba(255,255,255,.35)] disabled:opacity-45"
                >
                  {canContinue && <span aria-hidden className="lp-sheen pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/25 to-transparent" />}
                  {busy && <Loader2 size={16} className="animate-spin" />}
                  <span className="relative">{!last ? "Continue" : invited ? "Open project" : plan === "pro" ? "Start free trial" : "Launch workspace"}</span>
                  {!busy && <ArrowRight size={16} className="relative transition-transform group-hover:translate-x-0.5" />}
                </motion.button>
              </div>
            </div>
          </form>
        </main>
        <Ticker />

        <AnimatePresence>{launching && <LaunchOverlay name={name} lines={launchLines} />}</AnimatePresence>
      </div>
    </MotionConfig>
  );
}

function SelectDot({ on, light }: { on: boolean; light?: boolean }) {
  return (
    <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${light ? "border-white/60" : on ? "border-[#5742FF]" : "border-[#d9d3fb]"}`}>
      <AnimatePresence>
        {on && (
          <motion.span className={`flex h-4 w-4 items-center justify-center rounded-full ${light ? "bg-white text-[#5742FF]" : "bg-[#5742FF] text-white"}`} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring(20, 0.55)}>
            <Check size={10} strokeWidth={4} />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

function Perks({ items, light }: { items: string[]; light?: boolean }) {
  return (
    <ul className="relative mt-4 space-y-2">
      {items.map((p, i) => (
        <motion.li key={p} className={`flex items-start gap-2 text-[13px] ${light ? "text-white" : "text-[#334155]"}`} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: 0.4 + i * 0.05 }}>
          <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${light ? "bg-white/20" : "bg-[#f1eeff]"}`}>
            <Check size={10} strokeWidth={3.5} className={light ? "text-white" : "text-[#5742FF]"} />
          </span>
          {p}
        </motion.li>
      ))}
    </ul>
  );
}
