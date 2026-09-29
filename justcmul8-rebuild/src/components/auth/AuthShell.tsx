"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { CodeXml, Zap, Cloud } from "lucide-react";
import LiveSimShowcase from "@/components/auth/LiveSimShowcase";
import { CubeMark, spring, EASE_OUT } from "@/components/brand/CubeMark";
import { splashRevealDelay } from "@/components/SplashScreen";

const COPY = {
  login: { lead: "Welcome back.", accent: "Pick up where you left off.", sub: "Your models, runs and teammates are right where you left them." },
  signup: { lead: "Build your first", accent: "simulation in minutes.", sub: "No code, no setup. Model, simulate and optimize any system, right in your browser." },
  forgot: { lead: "Locked out?", accent: "We'll get you back in.", sub: "Enter your email and we'll send you a secure link to reset your password." },
  update: { lead: "Almost there.", accent: "Choose a new password.", sub: "Pick something strong. You'll go straight back to your simulations." },
};
type Mode = keyof typeof COPY;

// Headline words rise out of a mask with a small tilt and blur, like the landing showreel.
function Headline({ mode, delay }: { mode: Mode; delay: number }) {
  const c = COPY[mode];
  const words = [...c.lead.split(" ").map((w) => ({ w, accent: false })), ...c.accent.split(" ").map((w) => ({ w, accent: true }))];
  const breakAt = c.lead.split(" ").length;
  return (
    <AnimatePresence mode="wait" initial={true}>
      <motion.div key={mode} exit={{ opacity: 0, y: -12, filter: "blur(6px)", transition: { duration: 0.22 } }}>
        <h1 className="font-space font-bold text-[40px] xl:text-[52px] leading-[1.04] tracking-[-0.035em] text-[#161622]">
          {words.map(({ w, accent }, i) => (
            <span key={i}>
              {i === breakAt && <br />}
              <span className="inline-block overflow-hidden align-bottom pb-[0.12em] -mb-[0.12em] pr-[0.02em]">
                <motion.span
                  className={`inline-block ${accent ? "bg-clip-text text-transparent bg-gradient-to-r from-[#8b5cf6] via-[#5742FF] to-[#6366f1]" : ""}`}
                  initial={{ y: "110%", rotate: 6, filter: "blur(8px)" }}
                  animate={{ y: "0%", rotate: 0, filter: "blur(0px)" }}
                  transition={{ ...spring(13, 0.62, delay + i * 0.06), filter: { duration: 0.5, delay: delay + i * 0.06 } }}
                >
                  {w}
                </motion.span>
              </span>
              {i < words.length - 1 && i !== breakAt - 1 && " "}
            </span>
          ))}
        </h1>
        <motion.p
          className="mt-4 text-[15px] leading-relaxed text-[#64748b] max-w-[440px]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: delay + 0.35 }}
        >
          {c.sub}
        </motion.p>
      </motion.div>
    </AnimatePresence>
  );
}

// Login / Sign up switch. One pill slides between the two, keeping ?redirect= intact.
function ModeSwitch({ mode }: { mode: "login" | "signup" }) {
  const params = useSearchParams();
  const redirect = params.get("redirect");
  const q = redirect ? `?redirect=${encodeURIComponent(redirect)}` : "";
  return (
    <div className="relative grid grid-cols-2 p-1 rounded-full bg-[#f3f2fb] border border-[#ecebf7] mb-7" role="tablist">
      {(["login", "signup"] as const).map((m) => (
        <Link
          key={m}
          href={`/${m}${q}`}
          role="tab"
          aria-selected={mode === m}
          replace
          className={`relative z-10 py-2 text-center text-[13.5px] font-bold rounded-full transition-colors duration-200 ${mode === m ? "text-[#161622]" : "text-[#64748b] hover:text-[#161622]"}`}
        >
          {mode === m && (
            <motion.span
              layoutId="auth-mode-pill"
              className="absolute inset-0 -z-10 rounded-full bg-white shadow-[0_2px_10px_rgba(87,66,255,.14)]"
              transition={spring(20, 0.8)}
            />
          )}
          {m === "login" ? "Log in" : "Sign up"}
        </Link>
      ))}
    </div>
  );
}

export default function AuthShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mode: Mode = pathname?.startsWith("/signup")
    ? "signup"
    : pathname?.startsWith("/forgot-password")
      ? "forgot"
      : pathname?.startsWith("/update-password")
        ? "update"
        : "login";
  // Start the entrance as the boot splash's iris opens, not underneath it.
  const [delay] = useState(() => splashRevealDelay());
  // Only the very first headline waits for the splash; switching tabs later animates immediately.
  const firstMode = useRef(mode);
  const [switched, setSwitched] = useState(false);
  useEffect(() => {
    if (mode !== firstMode.current) setSwitched(true);
  }, [mode]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#fafaff] text-[#161622] font-sans">
      {/* Landing background: soft lilac orbs, noise, dot grid */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-[18%] -left-[12%] w-[60vw] max-w-[860px] aspect-square rounded-full bg-[#d6ccff]/45 blur-[130px]"
          animate={{ x: [0, 50, 0], y: [0, 30, 0] }}
          transition={{ duration: 14, ease: "easeInOut", repeat: Infinity }}
        />
        <motion.div
          className="absolute top-[10%] -right-[15%] w-[50vw] max-w-[720px] aspect-square rounded-full bg-[#e0d6ff]/55 blur-[130px]"
          animate={{ x: [0, -40, 0], y: [0, 40, 0] }}
          transition={{ duration: 16, ease: "easeInOut", repeat: Infinity }}
        />
        <div className="absolute -bottom-[25%] left-[20%] w-[60vw] max-w-[900px] aspect-square rounded-full bg-[#d8b4fe]/20 blur-[120px]" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(rgba(99,102,241,.16) 1.2px, transparent 1.7px)",
            backgroundSize: "30px 30px",
            maskImage: "radial-gradient(ellipse 75% 70% at 30% 50%, #000 20%, transparent 85%)",
            WebkitMaskImage: "radial-gradient(ellipse 75% 70% at 30% 50%, #000 20%, transparent 85%)",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1320px] grid-cols-1 lg:grid-cols-[1.08fr_1fr] gap-10 px-4 sm:px-8 lg:px-12">
        {/* Showcase (desktop) */}
        <section className="hidden lg:flex flex-col justify-center py-12">
          <Link href="/" aria-label="JustCmul8 home" className="flex items-center gap-2.5 mb-10 w-max group">
            <CubeMark mode="assemble" delay={delay} style={{ height: 38 }} />
            <motion.span
              className="flex flex-col"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT, delay: delay + 0.5 }}
            >
              <span className="font-space font-bold text-[18px] leading-none tracking-tight group-hover:text-[#5742FF] transition-colors">JustCmul8</span>
              <span className="text-[11px] font-medium text-[#5742FF] mt-1">Model. Simulate. Optimize.</span>
            </motion.span>
          </Link>

          <Headline mode={mode} delay={switched ? 0 : delay + 0.15} />

          <div className="mt-10">
            <LiveSimShowcase delay={delay} />
          </div>

          <motion.ul
            className="mt-8 flex flex-wrap gap-2.5"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: delay + 1.4 } } }}
          >
            {[
              { icon: CodeXml, label: "No code" },
              { icon: Zap, label: "Real-time results" },
              { icon: Cloud, label: "Runs in your browser" },
            ].map(({ icon: Icon, label }) => (
              <motion.li
                key={label}
                variants={{ hidden: { opacity: 0, y: 10, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1, transition: spring(14, 0.7) } }}
                className="flex items-center gap-2 h-9 px-3.5 rounded-full bg-white/80 backdrop-blur border border-[#e4defd] shadow-[0_8px_24px_-10px_rgba(139,92,246,.35)] text-[12px] font-bold tracking-wide text-[#6366f1]"
              >
                <Icon size={14} strokeWidth={2.4} /> {label}
              </motion.li>
            ))}
          </motion.ul>
        </section>

        {/* Form */}
        <section className="flex flex-col items-center justify-center py-10 lg:py-12">
          {/* Mobile brand */}
          <Link href="/" aria-label="JustCmul8 home" className="lg:hidden flex flex-col items-center mb-7">
            <CubeMark mode="assemble" delay={delay} style={{ height: 56 }} />
            <span className="font-space font-bold text-[20px] mt-3 tracking-tight">JustCmul8</span>
          </Link>

          <LayoutGroup>
            <motion.div
              layout
              className="relative w-full max-w-[440px] rounded-[28px] bg-white/90 backdrop-blur-xl border border-[#ecebf7] shadow-[0_40px_80px_-30px_rgba(87,66,255,.30),0_10px_24px_-12px_rgba(22,22,34,.10)] p-6 sm:p-8"
              initial={{ opacity: 0, y: 36, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...spring(10, 0.8, delay + 0.1), opacity: { duration: 0.35, delay: delay + 0.1 }, layout: spring(14, 0.9) }}
            >
              {/* Card top glow line */}
              <div className="pointer-events-none absolute inset-x-10 -top-px h-px bg-gradient-to-r from-transparent via-[#8b5cf6]/60 to-transparent" />
              {(mode === "login" || mode === "signup") && (
                <Suspense fallback={<div className="h-[46px] mb-7" />}>
                  <ModeSwitch mode={mode} />
                </Suspense>
              )}
              <motion.div layout="position">{children}</motion.div>
            </motion.div>
          </LayoutGroup>
        </section>
      </div>
    </div>
  );
}
