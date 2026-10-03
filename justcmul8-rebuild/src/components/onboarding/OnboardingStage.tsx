"use client";

import React, { useEffect } from "react";
import { AnimatePresence, LayoutGroup, animate, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Briefcase, Building2, Check, ClipboardList, Coins, FlaskConical, GraduationCap, LineChart, Rocket, Wrench, Maximize2, MessageSquare, Minus, Plus, Sparkles, User, Users, Wand2, Zap } from "lucide-react";
import { CubeMark, MARK_SRC, spring, EASE_OUT } from "@/components/brand/CubeMark";
import { Diorama, TYPES as SCENES } from "@/components/landing/SimTypesSection";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import { CREDIT_COSTS, PLAN_CREDITS, TRIAL_DAYS, type Interval } from "@/lib/billing/plans";

// Registry sim-type id → landing diorama scene (same mapping the dashboard uses).
export const DOMAIN_SCENE: Record<string, string> = {
  human_queue: "human", vehicle: "vehicle", liquid: "liquid", manufacturing: "mfg", logistics: "logistics", network_signal: "network",
};
export const sceneFor = (simTypeId: string) => SCENES.find((s) => s.id === DOMAIN_SCENE[simTypeId]) ?? SCENES[0];

const EASE_IO = [0.65, 0, 0.35, 1] as const;
const AVATAR_COLORS = ["#6d5bff", "#f59e0b", "#10b981", "#ef4444", "#0ea5e9", "#ec4899"];
const initialsOf = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

/* ─────────────────────────── Shared form controls ─────────────────────────── */

export const ROLES = [
  { id: "Student", icon: GraduationCap },
  { id: "Analyst", icon: LineChart },
  { id: "Engineer", icon: Wrench },
  { id: "Operations manager", icon: ClipboardList },
  { id: "Researcher", icon: FlaskConical },
  { id: "Founder", icon: Rocket },
  { id: "Other", icon: Sparkles },
];
export const TEAM_SIZES = ["Just me", "2–10", "11–50", "51+"];

/** A row of options where the selection is one pill that glides between them. */
export function PillChoice<T extends string>({ id, options, value, onChange, render }: {
  id: string; options: readonly T[]; value: string; onChange: (v: T) => void; render?: (o: T, on: boolean) => React.ReactNode;
}) {
  return (
    <LayoutGroup id={id}>
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup">
        {options.map((o) => {
          const on = value === o;
          return (
            <motion.button
              key={o}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
              transition={spring(20, 0.7)}
              className={`relative rounded-full border px-4 py-2.5 text-[13.5px] font-semibold transition-colors ${on ? "border-transparent text-white" : "border-[#ecebf7] bg-white/80 text-[#334155] hover:border-[#d9d3fb]"}`}
            >
              {on && <motion.span layoutId="pill" className="absolute inset-0 rounded-full bg-gradient-to-b from-[#6a57ff] to-[#5742FF] shadow-[0_8px_20px_-8px_rgba(87,66,255,.7)]" transition={spring(18, 0.8)} />}
              <span className="relative flex items-center gap-1.5">{render ? render(o, on) : o}</span>
            </motion.button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

/** Big, underline-style text field with a gradient line that draws in on focus. */
export function LineInput({ id, big, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { id: string; big?: boolean }) {
  return (
    <div className="group relative mt-2">
      <input
        id={id}
        {...props}
        className={`w-full border-0 border-b-2 border-[#e7e5f6] bg-transparent pb-2 pt-1 font-space font-bold text-[#161622] outline-none placeholder:text-[#cfcde0] ${big ? "text-[24px] sm:text-[28px] tracking-[-0.02em]" : "text-[17px]"}`}
      />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-gradient-to-r from-[#8b5cf6] to-[#5742FF] transition-transform duration-500 ease-out group-focus-within:scale-x-100" />
    </div>
  );
}

/* ─────────────────────────── Pointer parallax (shared) ─────────────────────────── */

/** Page-wide pointer position in -0.5..0.5, sprung so every layer glides. */
export function usePointer() {
  const x = useSpring(useMotionValue(0), { stiffness: 60, damping: 18 });
  const y = useSpring(useMotionValue(0), { stiffness: 60, damping: 18 });
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      x.set(e.clientX / window.innerWidth - 0.5);
      y.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [x, y]);
  return { x, y };
}
type Pointer = ReturnType<typeof usePointer>;

/* ─────────────────────────── Background flow field ─────────────────────────── */

// Long, faint routes sweeping across the whole page with entities travelling along them:
// the page itself reads as a running simulation. One SVG, SMIL motion, no React re-renders.
const FLOWS = [
  { d: "M-80 170 C 320 50, 620 360, 980 210 S 1560 30, 2000 250", c: "#8b5cf6", n: 4, dur: 22 },
  { d: "M-80 640 C 260 540, 520 800, 900 660 S 1500 440, 2000 620", c: "#5742FF", n: 5, dur: 26 },
  { d: "M-80 990 C 400 830, 700 1050, 1100 910 S 1600 770, 2000 950", c: "#0ea5e9", n: 3, dur: 30 },
  { d: "M260 -60 C 320 300, 120 600, 380 1200", c: "#10b981", n: 2, dur: 20 },
  { d: "M1560 -60 C 1480 280, 1760 640, 1520 1200", c: "#f97316", n: 2, dur: 24 },
];

export function FlowField({ pointer }: { pointer: Pointer }) {
  const x = useTransform(pointer.x, (v) => v * -24);
  const y = useTransform(pointer.y, (v) => v * -16);
  return (
    <motion.svg
      aria-hidden
      className="pointer-events-none fixed inset-0 h-full w-full"
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      style={{ x, y }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2, delay: 0.3 }}
    >
      {FLOWS.map((f, i) => (
        <g key={i}>
          <motion.path d={f.d} fill="none" stroke={f.c} strokeOpacity={0.12} strokeWidth={1.5} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.2, ease: EASE_OUT, delay: 0.3 + i * 0.15 }} />
          {Array.from({ length: f.n }, (_, k) => (
            <circle key={k} r={k % 2 ? 3 : 4.5} fill="#fff" stroke={f.c} strokeWidth={2} opacity={0.6}>
              <animateMotion dur={`${f.dur}s`} begin={`${(-k * f.dur) / f.n}s`} repeatCount="indefinite" path={f.d} />
            </circle>
          ))}
        </g>
      ))}
    </motion.svg>
  );
}

/** A slow ticker of real-world things people model, as the page footer. */
export function Ticker() {
  const examples = SCENES.flatMap((s) => s.examples.map((e) => ({ e, t: s })));
  return (
    <div aria-hidden className="relative z-10 hidden h-10 shrink-0 items-center overflow-hidden border-t border-[#ecebf7]/80 bg-white/40 md:flex [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
      <div className="lp-marquee flex shrink-0 gap-8 pr-8" style={{ animationDuration: "60s" }}>
        {[...examples, ...examples].map(({ e, t }, i) => (
          <span key={i} className="flex items-center gap-2 whitespace-nowrap text-[11.5px] font-semibold text-[#94a3b8]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} /> {e}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── Route progress ─────────────────────────── */

/** The steps drawn as a simulation flow: stations on a route, an entity travelling to where you are. */
export function RouteProgress({ steps, step }: { steps: string[]; step: number }) {
  const W = 600;
  const xs = steps.map((_, i) => 14 + (i * (W - 28)) / Math.max(1, steps.length - 1));
  const done = steps.length === 1 ? 1 : step / (steps.length - 1);
  return (
    <div className="relative w-full" aria-label={`Step ${step + 1} of ${steps.length}: ${steps[step]}`} role="img">
      <svg viewBox={`0 0 ${W} 28`} className="h-7 w-full overflow-visible">
        <defs>
          <linearGradient id="ob-route" x1="0" x2="1">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#5742FF" />
          </linearGradient>
        </defs>
        <line x1={xs[0]} y1={14} x2={xs[xs.length - 1]} y2={14} stroke="#e2dff3" strokeWidth={3} strokeLinecap="round" strokeDasharray="2 7" />
        <motion.line
          x1={xs[0]} y1={14} x2={xs[xs.length - 1]} y2={14}
          stroke="url(#ob-route)" strokeWidth={3} strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: done }} transition={{ duration: 0.9, ease: EASE_IO }}
        />
        {step > 0 && (
          <circle key={step} r={4} fill="#fff" stroke="#5742FF" strokeWidth={2.5}>
            <animateMotion dur="1.8s" repeatCount="indefinite" path={`M${xs[0]} 14 H${xs[step]}`} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".45 0 .55 1" />
          </circle>
        )}
        {xs.map((x, i) => (
          <g key={i}>
            {i === step && (
              <circle cx={x} cy={14} r={9} fill="none" stroke="#5742FF" strokeWidth={2}>
                <animate attributeName="r" values="9;18" dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" values=".6;0" dur="1.6s" repeatCount="indefinite" />
              </circle>
            )}
            <motion.circle
              cx={x} cy={14}
              initial={false}
              animate={{ r: i === step ? 9 : 7, fill: i <= step ? "#5742FF" : "#ffffff" }}
              stroke={i <= step ? "#5742FF" : "#d9d3fb"} strokeWidth={2.5}
              transition={spring(16, 0.6)}
            />
          </g>
        ))}
      </svg>
      <div className="relative mt-1.5 h-4">
        {steps.map((s, i) => (
          <span
            key={s}
            className={`absolute whitespace-nowrap text-[11px] font-bold tracking-wide transition-colors duration-300 ${i <= step ? "text-[#5742FF]" : "text-[#94a3b8]"}`}
            style={{ left: `${(xs[i] / W) * 100}%`, transform: i === 0 ? "none" : i === steps.length - 1 ? "translateX(-100%)" : "translateX(-50%)" }}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── Stage shell ─────────────────────────── */

/**
 * The live preview, dressed as the real workspace canvas (palette, zoom, minimap, status bar)
 * so it reads as the product, not a picture. Tilts gently toward the pointer.
 */
export function Stage({ pointer, label, domain, progress, status, children }: {
  pointer: Pointer; label: string; domain: string; progress: number; status: string; children: React.ReactNode;
}) {
  const rx = useTransform(pointer.y, (v) => v * -5);
  const ry = useTransform(pointer.x, (v) => v * 7);
  const scene = sceneFor(domain);
  const palette = (SIM_TYPE_REGISTRY[domain as keyof typeof SIM_TYPE_REGISTRY] ?? SIM_TYPE_REGISTRY.human_queue).paletteNodes.slice(0, 6);
  return (
    <div className="relative h-full w-full" style={{ perspective: 1600 }}>
      <motion.div
        className="relative flex h-full w-full flex-col overflow-hidden rounded-[30px] border border-[#ecebf7] bg-white shadow-[0_50px_100px_-40px_rgba(87,66,255,.4),0_12px_30px_-16px_rgba(22,22,34,.12)]"
        style={{ rotateX: rx, rotateY: ry }}
        initial={{ opacity: 0, y: 40, rotate: -2, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
        transition={{ ...spring(9, 0.75, 0.25), opacity: { duration: 0.4, delay: 0.25 } }}
      >
        {/* Title bar */}
        <div className="relative z-10 flex items-center justify-between border-b border-[#f1f0fa] px-5 py-3">
          <div className="flex min-w-0 items-center gap-1.5">
            {["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c }} />)}
            <span className="ml-3 shrink-0 text-[12px] font-semibold text-[#94a3b8]">workspace /</span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={label} className="ml-1 truncate font-space text-[13px] font-bold text-[#161622]" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
                {label}
              </motion.span>
            </AnimatePresence>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10.5px] font-bold text-emerald-600">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400" />
              <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            LIVE
          </div>
        </div>

        {/* Canvas */}
        <div className="relative min-h-0 flex-1 bg-[#fcfcff]">
          <div aria-hidden className="absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(99,102,241,.18) 1.2px, transparent 1.7px)", backgroundSize: "22px 22px" }} />

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={label}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
            >
              {children}
            </motion.div>
          </AnimatePresence>

          {/* Block palette (follows the chosen domain) */}
          <div className="absolute left-3 top-1/2 hidden -translate-y-1/2 flex-col gap-1 rounded-2xl border border-[#ecebf7] bg-white p-1.5 shadow-[0_10px_28px_-12px_rgba(16,24,40,.22)] sm:flex">
            <AnimatePresence mode="popLayout" initial={false}>
              {palette.map((p, i) => (
                <motion.span
                  key={`${domain}-${p.type}`}
                  title={p.label}
                  className="flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{ color: scene.color, background: i === 0 ? scene.tint : "transparent" }}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={spring(16, 0.75, i * 0.04)}
                >
                  <p.icon size={15} strokeWidth={2.2} />
                </motion.span>
              ))}
            </AnimatePresence>
          </div>

          {/* Zoom controls */}
          <div className="absolute bottom-3 left-3 hidden flex-col overflow-hidden rounded-2xl border border-[#ecebf7] bg-white shadow-[0_10px_28px_-12px_rgba(16,24,40,.22)] sm:flex">
            {[Plus, Minus, Maximize2].map((I, i) => <span key={i} className="flex h-7 w-7 items-center justify-center text-[#64748b]"><I size={13} /></span>)}
          </div>

          {/* Minimap */}
          <div className="absolute bottom-3 right-3 hidden h-[64px] w-[104px] overflow-hidden rounded-xl border border-[#ecebf7] bg-white shadow-[0_10px_28px_-12px_rgba(16,24,40,.22)] md:block">
            <AnimatePresence mode="wait" initial={false}>
              <motion.svg key={label} viewBox="0 0 104 64" className="h-full w-full" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.15 }} transition={{ duration: 0.3, ease: EASE_OUT }}>
                <Minimap label={label} color={scene.color} />
                <motion.rect y={6} width={56} height={52} rx={4} fill="none" stroke="#5742FF" strokeWidth={1.2} animate={{ x: [6, 42, 6] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} />
              </motion.svg>
            </AnimatePresence>
          </div>
        </div>

        {/* Status bar: fills as the user answers */}
        <div className="relative z-10 flex items-center gap-3 border-t border-[#f1f0fa] px-5 py-2.5">
          <span className="whitespace-nowrap text-[11px] font-bold text-[#94a3b8]">{status}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#f1f0fa]">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#5742FF]" initial={false} animate={{ width: `${Math.round(progress * 100)}%` }} transition={spring(12, 0.9)} />
          </div>
          <span className="w-9 text-right font-mono text-[11px] font-bold tabular-nums text-[#5742FF]">{Math.round(progress * 100)}%</span>
        </div>
      </motion.div>
    </div>
  );
}

/** A thumbnail of whichever scene the stage is showing, keyed by the stage label. */
function Minimap({ label, color }: { label: string; color: string }) {
  const line = { stroke: "#c4bdfb", strokeWidth: 1.5, fill: "none" };
  if (label === "your-profile") return (
    <>
      {[20, 32, 44].map((y) => <circle key={y} cx={14} cy={y} r={3.5} fill={color} opacity={0.5} />)}
      <path d="M18 20 C 30 20, 34 32, 42 32 M18 32 H42 M18 44 C 30 44, 34 32, 42 32 M62 32 H82" {...line} />
      <rect x={42} y={20} width={20} height={24} rx={3} fill="#5742FF" opacity={0.9} />
      <rect x={82} y={26} width={14} height={12} rx={2.5} fill={color} opacity={0.45} />
    </>
  );
  if (label === "your-world" || label === "preferences") return (
    <>
      {[0, 1, 2].flatMap((c) => [0, 1].map((r) => (
        <rect key={`${c}${r}`} x={14 + c * 28} y={14 + r * 22} width={20} height={14} rx={3} fill={c === 0 && r === 0 ? "#5742FF" : color} opacity={c === 0 && r === 0 ? 0.9 : 0.4} />
      )))}
    </>
  );
  if (label === "your-plan" || label === "plan-and-credits") return (
    <>
      <circle cx={52} cy={32} r={18} {...line} strokeWidth={4} stroke="#ecebf7" />
      <circle cx={52} cy={32} r={18} fill="none" stroke="#5742FF" strokeWidth={4} strokeDasharray="80 113" transform="rotate(-90 52 32)" strokeLinecap="round" />
      {[[16, 14], [88, 14], [16, 50], [88, 50]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={3} fill={color} opacity={0.5} />)}
    </>
  );
  if (label === "support") return (
    <>
      <path d="M28 32 C 42 14, 62 14, 76 32" {...line} />
      <path d="M76 32 C 62 50, 42 50, 28 32" {...line} stroke="#a7f3d0" />
      <rect x={14} y={25} width={14} height={14} rx={3} fill="#5742FF" opacity={0.9} />
      <rect x={76} y={25} width={14} height={14} rx={3} fill="#10b981" opacity={0.7} />
    </>
  );
  return (
    <>
      {[16, 52, 88].map((x, i) => <rect key={x} x={x - 8} y={27} width={16} height={10} rx={2.5} fill={i === 1 ? "#5742FF" : color} opacity={i === 1 ? 0.9 : 0.45} />)}
      <path d="M24 32 H44 M60 32 H80" {...line} />
    </>
  );
}

/* ─────────────────────────── Step 1: team → you → workspace ─────────────────────────── */

const TEAM_SHOWN: Record<string, number> = { "Just me": 0, "2–10": 3, "11–50": 4, "51+": 5 };
const TEAM_EXTRA: Record<string, string> = { "11–50": "+40", "51+": "+50" };

/** A field row on the profile block that checks itself off once filled. */
function FieldRow({ icon: Icon, label, value, delay }: { icon: React.ElementType; label: string; value: string; delay: number }) {
  const filled = !!value;
  return (
    <motion.div className="flex items-center gap-2.5" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, delay }}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-300 ${filled ? "bg-[#f5f3ff] text-[#5742FF]" : "bg-[#f6f6fb] text-[#c4c2d6]"}`}>
        <Icon size={13} strokeWidth={2.3} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-[#a1a1b5]">{label}</p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={value || "empty"}
            className={`truncate text-[12.5px] font-semibold ${filled ? "text-[#161622]" : "text-[#cfcde0]"}`}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}
          >
            {value || "Not set yet"}
          </motion.p>
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {filled && (
          <motion.span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={spring(18, 0.55)}>
            <Check size={9} strokeWidth={4} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** The user's block: avatar, live name, and fields that tick off as they're answered. */
function ProfileCard({ name, role, company, teamSize }: { name: string; role: string; company: string; teamSize: string }) {
  return (
    <motion.div
      className="relative rounded-[20px] border border-[#e6e2fb] bg-white p-3.5 shadow-[0_30px_60px_-24px_rgba(87,66,255,.5)]"
      initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring(12, 0.7, 0.05)}
    >
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#5742FF] font-space text-[14px] font-bold text-white">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={initialsOf(name)} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -16, opacity: 0 }} transition={spring(16, 0.7)}>
              {initialsOf(name)}
            </motion.span>
          </AnimatePresence>
        </span>
        <div className="min-w-0">
          <p className={`truncate font-space text-[14.5px] font-bold leading-tight ${name.trim() ? "text-[#161622]" : "text-[#c4c2d6]"}`}>
            {name.trim() || "Your name"}<span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-[#5742FF]" />
          </p>
          <p className="text-[10.5px] font-semibold text-[#94a3b8]">Builder · just joined</p>
        </div>
      </div>
      <div className="my-3 h-px bg-[#f1f0fa]" />
      <div className="space-y-2.5">
        <FieldRow icon={Briefcase} label="Role" value={role} delay={0.25} />
        <FieldRow icon={Building2} label="Company" value={company.trim()} delay={0.3} />
        <FieldRow icon={Users} label="Team" value={teamSize} delay={0.35} />
      </div>
      {/* Ports, exactly like a canvas block */}
      <span className="absolute -left-[7px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-[3px] border-white bg-[#8b5cf6] shadow" />
      <span className="absolute -right-[7px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-[3px] border-white bg-[#5742FF] shadow" />
    </motion.div>
  );
}

/**
 * The user's profile as a block in a flow: their team feeds in on the left, entities
 * stream out of the right port into their new workspace. Same grammar as the canvas.
 */
export function ProfileScene({ name, role, company, teamSize }: { name: string; role: string; company: string; teamSize: string }) {
  const n = TEAM_SHOWN[teamSize] ?? 0;
  const VW = 640, VH = 400;
  const card = { x: 215, y: 92, w: 220, h: 216 }; // in viewBox units
  const inPort = { x: card.x, y: card.y + card.h / 2 };
  const outPort = { x: card.x + card.w, y: card.y + card.h / 2 };
  const ws = { x: 560, y: 200 };
  const team = n === 0
    ? [{ x: 92, y: 200 }]
    : Array.from({ length: n }, (_, i) => ({ x: 92 - (i % 2) * 22, y: 200 + (i - (n - 1) / 2) * 62 }));
  const inPaths = team.map((m) => `M${m.x + 18} ${m.y} C ${m.x + 80} ${m.y}, ${inPort.x - 70} ${inPort.y}, ${inPort.x} ${inPort.y}`);
  const outPath = `M${outPort.x} ${outPort.y} C ${outPort.x + 50} ${outPort.y}, ${ws.x - 80} ${ws.y}, ${ws.x - 30} ${ws.y}`;
  const pct = (x: number, y: number) => ({ left: `${(x / VW) * 100}%`, top: `${(y / VH) * 100}%` });

  // Run-log lines, newest first, like the workspace's Logs tab.
  const events = [
    name.trim() && { k: "name", t: "00:01", text: <>Block created for <b>{name.trim()}</b></> },
    role && { k: `role-${role}`, t: "00:02", text: <>Role set to <b>{role}</b></> },
    company.trim() && { k: "company", t: "00:03", text: <>Linked to <b>{company.trim()}</b></> },
    teamSize && { k: `team-${teamSize}`, t: "00:04", text: n === 0 ? <>Running <b>solo</b></> : <>Connected a team of <b>{teamSize}</b></> },
  ].filter(Boolean).reverse() as { k: string; t: string; text: React.ReactNode }[];

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4 pb-4 pt-4 sm:pb-20 sm:pl-16 sm:pr-6">
      <div className="w-[230px] sm:hidden">
        <ProfileCard name={name} role={role} company={company} teamSize={teamSize} />
      </div>
      <div className="relative hidden w-full max-w-[720px] sm:block" style={{ aspectRatio: `${VW} / ${VH}` }}>
        <svg viewBox={`0 0 ${VW} ${VH}`} className="absolute inset-0 h-full w-full overflow-visible">
          {inPaths.map((d, i) => (
            <g key={`${teamSize}-${i}`}>
              <motion.path d={d} fill="none" stroke="#c4bdfb" strokeWidth={2} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.1 + i * 0.07 }} />
              <circle r={3.5} fill={n === 0 ? "#8b5cf6" : AVATAR_COLORS[i % AVATAR_COLORS.length]} stroke="#fff" strokeWidth={1.5}>
                <animateMotion dur={`${1.8 + (i % 3) * 0.35}s`} begin={`${i * 0.25}s`} repeatCount="indefinite" path={d} />
              </circle>
            </g>
          ))}
          <motion.path d={outPath} fill="none" stroke="#5742FF" strokeOpacity={0.45} strokeWidth={2.5} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.4 }} />
          {[0, 1, 2].map((k) => (
            <rect key={k} x={-4} y={-4} width={8} height={8} rx={2} fill="#5742FF">
              <animateMotion dur="1.6s" begin={`${k * 0.53}s`} repeatCount="indefinite" path={outPath} />
            </rect>
          ))}
        </svg>

        {/* Team (or just you) on the left */}
        {team.map((m, i) => (
          <motion.div
            key={`${teamSize}-m-${i}`}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={pct(m.x, m.y)}
            initial={{ opacity: 0, scale: 0.3, x: -20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ ...spring(15, 0.6, 0.05 + i * 0.06), opacity: { duration: 0.2, delay: 0.05 + i * 0.06 } }}
          >
            {n === 0 ? (
              <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-[#c4bdfb] bg-white text-[#8b5cf6]"><User size={18} /></span>
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-white text-white shadow-[0_8px_18px_-8px_rgba(60,50,160,.5)]" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                <User size={16} strokeWidth={2.5} />
              </span>
            )}
          </motion.div>
        ))}
        <span className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.14em] text-[#a1a1b5]" style={pct(84, 200 + Math.max(1, n) * 31 + 22)}>
          {n === 0 ? (teamSize ? "Solo" : "Team") : <>Team{TEAM_EXTRA[teamSize] && <span className="ml-1 rounded-full bg-[#f5f3ff] px-1.5 py-0.5 text-[#5742FF]">{TEAM_EXTRA[teamSize]}</span>}</>}
        </span>

        {/* The user's own block */}
        <div className="absolute" style={{ ...pct(card.x, card.y), width: `${(card.w / VW) * 100}%` }}>
          <ProfileCard name={name} role={role} company={company} teamSize={teamSize} />
        </div>

        {/* Where it all flows: their workspace */}
        <motion.div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={pct(ws.x, ws.y)}
          initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={spring(14, 0.6, 0.45)}
        >
          <div className="lp-float-slow flex flex-col items-center">
            <span className="relative flex h-16 w-16 items-center justify-center rounded-[20px] border border-[#e6e2fb] bg-white shadow-[0_20px_40px_-18px_rgba(87,66,255,.55)]">
              <span className="lp-pulse absolute inset-0 rounded-[20px] border-2 border-[#5742FF]/30" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={MARK_SRC} alt="" className="h-9 w-auto" />
            </span>
            <span className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a1a1b5]">Workspace</span>
          </div>
        </motion.div>
      </div>

      {/* Live run log */}
      <motion.div
        className="hidden w-full max-w-[340px] rounded-2xl border border-[#ecebf7] bg-white/95 p-3 shadow-[0_14px_34px_-18px_rgba(60,50,160,.35)] sm:block"
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={spring(12, 0.85, 0.5)}
      >
        <p className="mb-2 flex items-center justify-between text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#a1a1b5]">
          Event log <span className="font-mono normal-case tracking-normal text-[#c4c2d6]">{events.length} events</span>
        </p>
        <div className="space-y-1.5">
          <AnimatePresence initial={false}>
            {events.length === 0 && (
              <motion.p key="idle" className="text-[11.5px] font-medium text-[#c4c2d6]" exit={{ opacity: 0 }}>Waiting for your first answer…</motion.p>
            )}
            {events.map((e, i) => (
              <motion.div
                key={e.k}
                layout
                className="flex items-center gap-2 text-[11.5px] text-[#475569] [&_b]:font-bold [&_b]:text-[#161622]"
                initial={{ opacity: 0, y: -10, scale: 0.96 }}
                animate={{ opacity: i === 0 ? 1 : 0.6, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 10 }}
                transition={spring(16, 0.8)}
              >
                <span className="font-mono text-[10px] text-[#a1a1b5]">{e.t}</span>
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${i === 0 ? "bg-[#5742FF]" : "bg-[#d9d3fb]"}`} />
                <span className="truncate">{e.text}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────── Step 2: the user's world ─────────────────────────── */

/** The domain they just picked, as the landing page's living isometric world. */
export function WorldScene({ focus, selected }: { focus: string | null; selected: string[] }) {
  const t = sceneFor(focus ?? "human_queue");
  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={t.id}
          className="absolute inset-x-2 bottom-16 top-2 sm:inset-x-14"
          initial={{ opacity: 0, y: 30, scale: 0.92 }}
          animate={{ opacity: focus ? 1 : 0.3, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 1.04 }}
          transition={spring(11, 0.8)}
        >
          <div className="lp-float-slow absolute inset-0">
            <Diorama t={t} live={!!focus} />
          </div>
        </motion.div>
      </AnimatePresence>

      {!focus && (
        <motion.div className="absolute inset-0 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="rounded-full border border-[#ecebf7] bg-white px-4 py-2 text-[13px] font-bold text-[#5742FF] shadow-lg">
            <Sparkles size={14} className="mr-1.5 inline" /> Pick a domain to bring it to life
          </div>
        </motion.div>
      )}

      {/* Picked domains stack up as a dock */}
      <div className="absolute inset-x-0 bottom-3 flex justify-center">
        <motion.div layout className="flex items-center gap-1.5 rounded-2xl border border-[#ecebf7] bg-white p-1.5 shadow-[0_12px_30px_-14px_rgba(60,50,160,.35)]">
          <AnimatePresence initial={false}>
            {selected.map((id, i) => {
              const s = sceneFor(id);
              return (
                <motion.span
                  key={id}
                  layout
                  initial={{ opacity: 0, scale: 0.4, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.4 }}
                  transition={spring(16, 0.6)}
                  className="relative flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[11px] font-bold"
                  style={{ background: id === focus ? s.color : s.tint, color: id === focus ? "#fff" : s.color }}
                >
                  <s.icon size={15} strokeWidth={2.3} />
                  {i === 0 && <span className="hidden sm:inline">Default</span>}
                </motion.span>
              );
            })}
          </AnimatePresence>
          {selected.length === 0 && <span className="px-3 py-2 text-[11px] font-bold text-[#b4b2c8]">Your domains appear here</span>}
        </motion.div>
      </div>
    </>
  );
}

/* ─────────────────────────── Step 3: credits gauge ─────────────────────────── */

function useCountTo(to: number) {
  const v = useMotionValue(0);
  useEffect(() => {
    const c = animate(v, to, { duration: 1.1, ease: EASE_OUT });
    return () => c.stop();
  }, [to, v]);
  return useTransform(v, (n) => Math.round(n).toLocaleString());
}

const ORBIT = [
  { icon: Plus, label: "New sim", cost: CREDIT_COSTS.create_simulation },
  { icon: Zap, label: "Optimize", cost: CREDIT_COSTS.ai_optimize },
  { icon: Wand2, label: "AI build", cost: CREDIT_COSTS.ai_generate },
  { icon: MessageSquare, label: "AI chat", cost: CREDIT_COSTS.ai_chat },
];

/** Monthly credits as a charging gauge, with what each action costs orbiting it. */
export function CreditsScene({ plan, interval }: { plan: "free" | "pro"; interval: Interval }) {
  const credits = PLAN_CREDITS[plan];
  const text = useCountTo(credits);
  const pro = plan === "pro";
  const R = 96, C = 2 * Math.PI * R;
  const fill = credits / PLAN_CREDITS.pro;
  const TICKS = 60;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-10 px-4 pb-16 pt-4">
      <div className="relative aspect-square w-[min(340px,100%)] max-h-full">
        {/* Soft glow that brightens on Pro */}
        <motion.div
          aria-hidden
          className="absolute inset-[22%] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(87,66,255,.28), transparent 70%)" }}
          animate={{ scale: pro ? 1.25 : 0.9, opacity: pro ? 1 : 0.55 }}
          transition={spring(8, 0.8)}
        />

        {/* Dial: ticks light up to the allowance, then the arc */}
        <svg viewBox="0 0 300 300" className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <linearGradient id="ob-gauge" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={pro ? "#c084fc" : "#8b5cf6"} />
              <stop offset="100%" stopColor="#5742FF" />
            </linearGradient>
          </defs>
          {Array.from({ length: TICKS }, (_, i) => {
            const a = (i / TICKS) * 2 * Math.PI - Math.PI / 2;
            const on = i / TICKS < fill;
            const long = i % 5 === 0;
            return (
              <motion.line
                key={i}
                x1={150 + Math.cos(a) * 128} y1={150 + Math.sin(a) * 128}
                x2={150 + Math.cos(a) * (long ? 118 : 122)} y2={150 + Math.sin(a) * (long ? 118 : 122)}
                strokeWidth={long ? 2.5 : 1.5} strokeLinecap="round"
                initial={false}
                animate={{ stroke: on ? "#5742FF" : "#e4e1f3" }}
                transition={{ duration: 0.25, delay: on ? (i / TICKS) * 0.9 : 0 }}
              />
            );
          })}
          <circle cx={150} cy={150} r={R} fill="#fff" stroke="#f1f0fa" strokeWidth={14} />
          <motion.circle
            cx={150} cy={150} r={R} fill="none" stroke="url(#ob-gauge)" strokeWidth={14} strokeLinecap="round"
            strokeDasharray={C} transform="rotate(-90 150 150)"
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: C * (1 - fill) }}
            transition={{ duration: 1.1, ease: EASE_OUT }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="flex items-center gap-1 text-[10px] font-bold tracking-[0.14em] text-[#94a3b8]"><Coins size={11} /> CREDITS</span>
          <motion.span className="mt-1 font-space text-[56px] font-bold leading-none tracking-[-0.04em] tabular-nums text-[#161622]">{text}</motion.span>
          <span className="mt-1 text-[11px] font-semibold text-[#94a3b8]">every month</span>
        </div>

        {/* What things cost, slowly orbiting outside the dial (chips counter-spin to stay upright) */}
        <div className="lp-spin pointer-events-none absolute -inset-[3%]" style={{ animationDuration: "60s" }}>
          {ORBIT.map((o, i) => {
            const a = (i * Math.PI) / 2 - Math.PI / 4;
            return (
              <div key={o.label} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${50 + Math.cos(a) * 50}%`, top: `${50 + Math.sin(a) * 50}%` }}>
                <div className="lp-spin" style={{ animationDuration: "60s", animationDirection: "reverse" }}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={spring(14, 0.6, 0.3 + i * 0.08)}
                    className="flex items-center gap-1.5 rounded-full border border-[#ecebf7] bg-white py-1 pl-1 pr-2.5 shadow-[0_10px_24px_-12px_rgba(60,50,160,.4)]"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f5f3ff] text-[#5742FF]"><o.icon size={12} strokeWidth={2.5} /></span>
                    <span className="whitespace-nowrap text-[10.5px] font-bold text-[#334155]">{o.label}</span>
                    <span className="text-[10.5px] font-bold text-[#5742FF]">{o.cost}</span>
                  </motion.div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={`${plan}-${interval}`}
            className={`rounded-full px-3 py-1 text-[11px] font-bold ${pro ? "bg-[#5742FF] text-white shadow-[0_8px_20px_-8px_rgba(87,66,255,.7)]" : "bg-[#f5f3ff] text-[#5742FF]"}`}
            initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={spring(16, 0.7)}
          >
            {pro ? `Pro · ${TRIAL_DAYS}-day free trial · billed ${interval}` : "Free plan · free forever"}
          </motion.span>
        </AnimatePresence>
        <p className="text-center text-[12.5px] font-medium text-[#64748b]">
          Enough for <b className="text-[#161622]">{Math.floor(credits / CREDIT_COSTS.create_simulation)} new simulations</b> or{" "}
          <b className="text-[#161622]">{Math.floor(credits / CREDIT_COSTS.ai_optimize)} AI optimizations</b> a month. Running them is always free.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────── Launch sequence ─────────────────────────── */

/** Full-screen hand-off: a lilac wipe, the cube assembles, the workspace "boots" line by line. */
export function LaunchOverlay({ name, lines }: { name: string; lines: string[] }) {
  const first = name.trim().split(/\s+/)[0] || "there";
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#7a67ff] via-[#5742FF] to-[#3b2bd1]"
      initial={{ clipPath: "circle(0% at 50% 60%)" }}
      animate={{ clipPath: "circle(150% at 50% 60%)" }}
      transition={{ duration: 0.9, ease: EASE_IO }}
      role="status"
      aria-live="polite"
    >
      <div aria-hidden className="absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.14) 1.2px, transparent 1.7px)", backgroundSize: "26px 26px" }} />
      {/* Light streaks, like entities leaving the system */}
      {Array.from({ length: 14 }, (_, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="absolute h-[2px] rounded-full bg-gradient-to-r from-transparent via-white/70 to-transparent"
          style={{ top: `${6 + i * 6.5}%`, width: `${18 + (i % 4) * 8}%`, left: "-30%" }}
          animate={{ x: ["0vw", "160vw"] }}
          transition={{ duration: 1.4 + (i % 5) * 0.25, delay: 0.4 + (i % 7) * 0.12, repeat: Infinity, ease: "easeIn" }}
        />
      ))}
      <div className="relative flex flex-col items-center px-6 text-center text-white">
        <motion.div className="rounded-[26px] bg-white p-4 shadow-[0_30px_60px_-20px_rgba(0,0,0,.45)]" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring(12, 0.6, 0.45)}>
          <CubeMark mode="breathe" delay={0.5} className="w-14" />
        </motion.div>
        <h1 className="mt-7 font-space text-[2.4rem] font-bold leading-[1.05] tracking-[-0.035em] sm:text-[3.4rem]">
          {["Welcome", "aboard,", `${first}.`].map((w, i) => (
            <span key={i} className="inline-block overflow-hidden px-[0.08em] pb-[0.12em] -mb-[0.12em] align-bottom">
              <motion.span className="inline-block" initial={{ y: "110%", rotate: 6 }} animate={{ y: "0%", rotate: 0 }} transition={spring(13, 0.7, 0.75 + i * 0.08)}>
                {w}
              </motion.span>
            </span>
          ))}
        </h1>
        <ul className="mt-7 space-y-2.5 text-left">
          {lines.map((l, i) => (
            <motion.li key={l} className="flex items-center gap-2.5 text-[14.5px] font-semibold text-white/90" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, delay: 1.05 + i * 0.32 }}>
              <motion.span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#5742FF]" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring(18, 0.5, 1.2 + i * 0.32)}>
                <Check size={12} strokeWidth={3.5} />
              </motion.span>
              {l}
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
