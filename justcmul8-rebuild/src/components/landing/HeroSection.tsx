"use client";

import React, { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { Sparkles, ArrowRight, BarChart3 } from "lucide-react";
import { splashRevealDelay } from "@/components/SplashScreen";
import { ScrollCue, SplitWords, VIEW, spring, EASE_OUT } from "@/components/landing/motionKit";

const PROMPTS = [
  "A hospital ER with 2 nurses and 3 doctors…",
  "A coffee shop with a morning rush…",
  "A car wash with two bays and a single queue…",
  "A warehouse dock loading 40 trucks a day…",
];

// "Trusted by" row (college demo). Logos: Simple Icons. Brand colour shows on hover.
// wordmark: the logo already spells the name, so it's shown wide and alone.
const COMPANIES: { name: string; logo: string; color: string; wordmark?: boolean }[] = [
  { name: "Google", logo: "google", color: "#4285f4" },
  { name: "Siemens", logo: "siemens", color: "#009999", wordmark: true },
  { name: "Amazon", logo: "amazon", color: "#ff9900" },
  { name: "DHL", logo: "dhl", color: "#d40511", wordmark: true },
  { name: "Tesla", logo: "tesla", color: "#cc0000" },
  { name: "FedEx", logo: "fedex", color: "#4d148c", wordmark: true },
  { name: "Shopify", logo: "shopify", color: "#5e8e3e" },
  { name: "Samsung", logo: "samsung", color: "#1428a0", wordmark: true },
  { name: "Stripe", logo: "stripe", color: "#635bff" },
  { name: "Uber", logo: "uber", color: "#000000", wordmark: true },
];

function CompanyChip({ name, logo, color, wordmark }: (typeof COMPANIES)[number]) {
  const src = `url(/logos/${logo}.svg) center / ${wordmark ? "cover" : "contain"} no-repeat`;
  return (
    <span
      className="group/chip mr-3 md:mr-4 inline-flex h-14 shrink-0 items-center gap-2.5 rounded-2xl border border-[#ecebf7] bg-white px-5 text-[#64748b] shadow-[0_1px_2px_rgba(16,24,40,.04)] transition-[color,transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:text-[var(--brand)] hover:shadow-[0_10px_24px_-12px_rgba(16,24,40,.25)]"
      style={{ ["--brand" as string]: color }}
      title={name}
    >
      {/* SVG used as a mask so it takes the text colour. Wordmarks: wide box + cover crops the empty viewBox space. */}
      <span aria-hidden className={`bg-current ${wordmark ? "h-6 w-[88px]" : "h-6 w-6"}`} style={{ WebkitMask: src, mask: src }} />
      {wordmark ? (
        <span className="sr-only">{name}</span>
      ) : (
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-[#334155] transition-colors group-hover/chip:text-[var(--brand)]">{name}</span>
      )}
    </span>
  );
}

// --- LEFT CARD: drag the nodes, the wires follow ---
function MiniCanvas() {
  const blueX = useMotionValue(20);
  const blueY = useMotionValue(30);
  const greenX = useMotionValue(90);
  const greenY = useMotionValue(68);
  const purpleX = useMotionValue(130);
  const purpleY = useMotionValue(38);
  const line1 = useTransform([blueX, blueY, purpleX, purpleY], ([bx, by, px, py]: number[]) => `M ${bx + 45} ${by + 12} Q 100 55 ${px} ${py + 12}`);
  const line2 = useTransform([blueX, blueY, greenX, greenY], ([bx, by, gx, gy]: number[]) => `M ${bx + 45} ${by + 12} Q 75 75 ${gx} ${gy + 10}`);

  const nodes = [
    { x: blueX, y: blueY, w: 45, h: 24, fill: "#dce5ff", c: { right: 150, bottom: 110 } },
    { x: greenX, y: greenY, w: 40, h: 20, fill: "#bcf5d6", c: { right: 155, bottom: 115 } },
    { x: purpleX, y: purpleY, w: 50, h: 24, fill: "#ebdfff", c: { right: 145, bottom: 110 } },
  ];

  return (
    <svg className="w-full h-full relative z-10" viewBox="0 0 200 140" fill="none">
      <defs>
        <filter id="shadowLeft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#8b5cf6" floodOpacity="0.15" />
        </filter>
      </defs>
      <motion.path d={line1} stroke="#b2bdf9" strokeWidth="1.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 1.2, ease: EASE_OUT }} />
      <motion.path d={line2} stroke="#b2bdf9" strokeWidth="1.5" strokeDasharray="3 3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} />
      {nodes.map((n, i) => (
        <motion.g key={i} style={{ x: n.x, y: n.y }} drag dragMomentum={false} dragConstraints={{ top: 0, left: 0, ...n.c }}>
          <motion.rect
            width={n.w} height={n.h} rx={n.h / 2} fill={n.fill} stroke="#fff" strokeWidth="4" filter="url(#shadowLeft)"
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring(14, 0.6, 0.9 + i * 0.1)}
            whileHover={{ scale: 1.08 }} whileDrag={{ scale: 1.15 }}
            style={{ originX: `${n.w / 2}px`, originY: `${n.h / 2}px` }}
            className="cursor-grab active:cursor-grabbing"
          />
        </motion.g>
      ))}
    </svg>
  );
}

// --- RIGHT CARD: live-ish stats with a pointer tilt ---
function LiveResultsCard() {
  const [stats, setStats] = useState({ t: 120, u: 78, w: 2.4 });
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStats({
        t: 120 + Math.floor(Math.random() * 8) - 4,
        u: 78 + Math.floor(Math.random() * 6) - 3,
        w: Number((2.4 + (Math.random() * 0.4 - 0.2)).toFixed(1)),
      });
    }, 2500);
    return () => clearInterval(id);
  }, []);

  const cells = [
    { k: "Throughput", v: `${stats.t}/h` },
    { k: "Utilization", v: `${stats.u}%` },
    { k: "Wait Time", v: `${stats.w} min` },
  ];

  return (
    <div className="relative">
      <motion.div
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          rx.set(((e.clientY - r.top) / r.height - 0.5) * -16);
          ry.set(((e.clientX - r.left) / r.width - 0.5) * 16);
        }}
        onPointerLeave={() => { rx.set(0); ry.set(0); }}
        style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
        className="bg-white rounded-[2rem] p-6 w-[340px] shadow-[0_25px_50px_rgba(16,24,40,0.056)] border border-white"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-[14px] bg-[#f5f3ff] text-[#8b5cf6] flex items-center justify-center border border-violet-100/50">
            <BarChart3 size={20} strokeWidth={2.5} />
          </div>
          <span className="font-bold text-[#1e293b] text-[17px] tracking-tight">Live Results</span>
          <span className="ml-auto flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-[#12a150] uppercase">
            <span className="relative flex w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-[#12a150] animate-ping opacity-60" />
              <span className="relative w-2 h-2 rounded-full bg-[#12a150]" />
            </span>
            Live
          </span>
        </div>

        <div className="h-24 w-full mb-6 relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#f8faff] to-white border border-indigo-50/50">
          <svg className="absolute bottom-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 300 80">
            <defs>
              <linearGradient id="heroChartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(139, 92, 246, 0.25)" />
                <stop offset="100%" stopColor="rgba(139, 92, 246, 0)" />
              </linearGradient>
            </defs>
            <motion.path d="M0,80 L0,50 C100,20 200,80 300,45 L300,80 Z" fill="url(#heroChartGradient)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6, duration: 0.6 }} />
            <motion.path d="M0,50 C100,20 200,80 300,45" fill="none" stroke="#8b5cf6" strokeWidth="2.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.1, duration: 1, ease: EASE_OUT }} />
            <circle r="4" fill="#fff" stroke="#8b5cf6" strokeWidth="2">
              <animateMotion dur="4s" repeatCount="indefinite" path="M0,50 C100,20 200,80 300,45" />
            </circle>
          </svg>
        </div>

        <div className="flex gap-3 justify-between">
          {cells.map((c) => (
            <motion.div key={c.k} whileHover={{ y: -4 }} transition={spring(20, 0.8)} className="bg-white rounded-2xl p-3 flex-1 text-center border border-[#f1f5f9] shadow-[0_4px_15px_rgba(0,0,0,0.03)]">
              <div className="text-[9px] text-[#94a3b8] font-bold tracking-wider mb-1.5 uppercase">{c.k}</div>
              <div className="relative h-[22px] overflow-hidden">
                <motion.div
                  key={c.v}
                  className="text-[15px] font-black text-[#1e293b] tabular-nums whitespace-nowrap"
                  initial={{ y: 18, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={spring(16, 0.9)}
                >
                  {c.v}
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <div className="absolute -bottom-8 right-0 flex items-center gap-2 text-[#7c3aed] font-semibold text-[14px] rotate-[-6deg] pointer-events-none">
        <div className="bg-[#f5f3ff] px-4 py-2 rounded-full shadow-sm border border-violet-100 flex items-center gap-2">
          <BarChart3 size={14} strokeWidth={2.5} />
          Track & Optimize
        </div>
      </div>
    </div>
  );
}

// Placeholder that types each example prompt, holds, then deletes it.
function useTypewriter(lines: string[], paused: boolean) {
  const [text, setText] = useState("");
  const state = useRef({ line: 0, char: 0, dir: 1 as 1 | -1 });
  useEffect(() => {
    if (paused) return;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const s = state.current;
      const full = lines[s.line];
      s.char += s.dir;
      setText(full.slice(0, s.char));
      let wait = s.dir === 1 ? 38 : 16;
      if (s.dir === 1 && s.char >= full.length) { s.dir = -1; wait = 1800; }
      else if (s.dir === -1 && s.char <= 0) { s.dir = 1; s.line = (s.line + 1) % lines.length; wait = 350; }
      t = setTimeout(tick, wait);
    };
    t = setTimeout(tick, 900);
    return () => clearTimeout(t);
  }, [lines, paused]);
  return text;
}

function PromptBar({ delay }: { delay: number }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const typed = useTypewriter(PROMPTS, focused || value.length > 0);

  return (
    <motion.form
      onSubmit={(e) => { e.preventDefault(); router.push("/signup"); }}
      initial={{ opacity: 0, y: 30, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...spring(11, 0.8, delay) }}
      className="w-full max-w-2xl 2xl:max-w-3xl relative mb-14 md:mb-20 z-30"
    >
      <div className={`relative flex flex-col sm:flex-row items-center bg-white/95 border rounded-[1.75rem] sm:rounded-full p-2 sm:pl-6 gap-2 sm:gap-0 transition-[border-color,box-shadow] duration-300 ${focused ? "border-[#c4b5fd] shadow-[0_0_0_4px_rgba(139,92,246,.12),0_12px_32px_-12px_rgba(16,24,40,.18)]" : "border-[#ecebf7] shadow-[0_1px_2px_rgba(16,24,40,.04),0_12px_32px_-16px_rgba(16,24,40,.14)]"}`}>
        <label className="relative flex items-center w-full px-3 sm:px-0 py-2 sm:py-0 cursor-text">
          <motion.span animate={{ rotate: focused ? 90 : 0 }} transition={spring(12, 0.7)} className="mr-3 shrink-0 text-[#8b5cf6]">
            <Sparkles size={20} />
          </motion.span>
          <span className="sr-only">Describe your simulation</span>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={focused ? "Describe your simulation…" : ""}
            className="flex-1 min-w-0 bg-transparent outline-none text-[#334155] placeholder:text-[#94a3b8] font-medium text-[15px]"
          />
          {!focused && !value && (
            <span aria-hidden className="pointer-events-none absolute left-[44px] sm:left-8 right-2 truncate text-[15px] font-medium text-[#94a3b8]">
              {typed}
              <span className="inline-block w-[2px] h-[1.05em] -mb-[2px] ml-0.5 bg-[#8b5cf6] animate-pulse" />
            </span>
          )}
        </label>
        <motion.button
          type="submit"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          transition={spring(22, 0.7)}
          className="group relative overflow-hidden w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-[#8b5cf6] to-[#5742FF] border border-[#8d80ff] text-white px-7 py-3.5 rounded-full font-bold shadow-[0_10px_24px_-8px_rgba(87,66,255,.6)] shrink-0 text-sm"
        >
          <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/4 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/45 to-transparent group-hover:translate-x-[620%] transition-transform duration-700 ease-out" />
          Generate with AI
          <ArrowRight size={16} strokeWidth={2.5} className="transition-transform group-hover:translate-x-1" />
        </motion.button>
      </div>
    </motion.form>
  );
}

export default function HeroSection() {
  // Start the entrance as the boot splash opens, not underneath it.
  const [d] = useState(() => splashRevealDelay());
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const reelRef = useRef<HTMLDivElement>(null);

  // Flanking cards drift apart and up as the hero scrolls away.
  const { scrollYProgress: heroP } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const leftY = useTransform(heroP, [0, 1], [0, reduce ? 0 : -160]);
  const rightY = useTransform(heroP, [0, 1], [0, reduce ? 0 : -260]);
  const copyY = useTransform(heroP, [0, 0.5], [0, reduce ? 0 : 60]);
  const copyO = useTransform(heroP, [0, 0.45], [1, reduce ? 1 : 0.3]);

  // Showreel grows into place as it scrolls toward the centre of the screen.
  const { scrollYProgress: reelP } = useScroll({ target: reelRef, offset: ["start end", "center center"] });
  const reelScale = useTransform(reelP, [0, 1], [reduce ? 1 : 0.86, 1]);
  const reelRotX = useTransform(reelP, [0, 1], [reduce ? 0 : 14, 0]);

  return (
    <section ref={sectionRef} className="relative flex flex-col items-center pt-32 md:pt-40 pb-16 md:pb-24 overflow-hidden bg-[#fafaff] font-sans">
      {/* Backdrop: lilac wash + dot grid. Plain gradients: blurred orbs repainted every frame and were the main source of lag */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 50% 45% at 0% 0%, rgba(214,204,255,.55), transparent 70%), radial-gradient(ellipse 45% 45% at 100% 10%, rgba(224,214,255,.6), transparent 70%), radial-gradient(ellipse 60% 40% at 70% 100%, rgba(216,180,254,.18), transparent 70%)",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(rgba(99,102,241,.15) 1.2px, transparent 1.7px)",
            backgroundSize: "32px 32px",
            maskImage: "radial-gradient(ellipse 60% 45% at 50% 30%, #000 10%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse 60% 45% at 50% 30%, #000 10%, transparent 80%)",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 flex flex-col items-center">
        <div className="relative w-full flex flex-col items-center">
          {/* Floating cards: only where there's room beside the copy (≥1280px) so they never clip */}
          <motion.div style={{ y: leftY }} className="hidden xl:block absolute top-[250px] right-[calc(50%+360px)] 2xl:right-[calc(50%+400px)] z-40">
            <motion.div
              initial={{ opacity: 0, x: -70, rotate: -10 }}
              animate={{ opacity: 1, x: 0, rotate: -3 }}
              transition={{ ...spring(9, 0.75, d + 0.6) }}
              className="relative scale-[.8] 2xl:scale-100 origin-right"
            >
              <div className="lp-float">
                <div className="absolute -top-4 -right-4 text-violet-400 opacity-60 pointer-events-none">✦</div>
                <div className="bg-white rounded-[2rem] p-6 w-[280px] h-[210px] shadow-[0_25px_50px_rgba(16,24,40,0.056)] flex items-center justify-center border border-white">
                  <MiniCanvas />
                </div>
                <div className="absolute -bottom-8 -left-4 flex items-center gap-2 text-[#8b5cf6] rotate-[4deg] pointer-events-none">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="-scale-y-100 opacity-80">
                    <path d="M4 12S8 4 20 4M20 4L14 10M20 4L16 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-base font-bold">Drag & Connect</span>
                </div>
              </div>
            </motion.div>
          </motion.div>

          <motion.div style={{ y: rightY }} className="hidden xl:block absolute top-[330px] left-[calc(50%+360px)] 2xl:left-[calc(50%+400px)] z-40">
            <motion.div
              initial={{ opacity: 0, x: 70, rotate: 10 }}
              animate={{ opacity: 1, x: 0, rotate: 3 }}
              transition={{ ...spring(9, 0.75, d + 0.75) }}
              className="scale-[.8] 2xl:scale-100 origin-left"
            >
              <div className="lp-float-slow">
                <LiveResultsCard />
              </div>
            </motion.div>
          </motion.div>

          <motion.div style={{ y: copyY, opacity: copyO }} className="flex flex-col items-center w-full">
            <h1 className="text-center max-w-4xl mx-auto mb-5 md:mb-6 relative z-30 text-[2.75rem] leading-[1.03] sm:text-[4rem] lg:text-[5rem] 2xl:text-[6rem] font-space font-bold text-[#161622] tracking-[-0.04em]">
              <SplitWords text="Build Simulations." accent="No Limits." delay={d + 0.1} animateNow />
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: d + 0.45, ease: EASE_OUT }}
              className="text-center text-[1rem] sm:text-[1.1rem] md:text-[1.25rem] text-[#64748b] max-w-2xl mx-auto mb-8 md:mb-12 font-medium leading-relaxed relative z-30 px-2"
            >
              Create, run and analyze discrete event simulations — visually, with no code, and right in your browser.
            </motion.p>

            <PromptBar delay={d + 0.55} />
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: d + 1.1, duration: 0.6 }} className="-mt-8 md:-mt-12 mb-10 md:mb-14">
              <ScrollCue />
            </motion.div>
          </motion.div>
        </div>

        {/* Showreel: tilts up and grows into place on scroll */}
        <div ref={reelRef} className="relative w-full max-w-6xl mb-14 md:mb-20 z-20 [perspective:1400px]">
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring(8, 0.9, d + 0.7), opacity: { duration: 0.6, delay: d + 0.7 } }}
            style={{ scale: reelScale, rotateX: reelRotX, transformOrigin: "50% 100%" }}
            className="relative"
          >
            <div className="relative rounded-[1.25rem] md:rounded-[2rem] p-1.5 md:p-2 bg-white border border-[#ecebf7] shadow-[0_1px_2px_rgba(16,24,40,.04),0_40px_80px_-40px_rgba(16,24,40,.25)]">
              <video
                className="w-full aspect-video rounded-[1rem] md:rounded-[1.6rem] bg-[#fafaff]"
                poster="/videos/justcmul8-showreel-poster.jpg"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-label="JustCmul8 showreel: describe a system, AI builds the model, run it and analyze the results"
              >
                <source src="/videos/justcmul8-showreel-4k.mp4" type="video/mp4" media="(min-width: 1800px) and (min-resolution: 2dppx)" />
                <source src="/videos/justcmul8-showreel-1080p.mp4" type="video/mp4" />
              </video>
            </div>
          </motion.div>
        </div>

        {/* Trusted by: slow marquee of logo chips (pauses on hover) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEW}
          transition={{ duration: 0.7, ease: EASE_OUT }}
          className="w-full"
        >
          <div className="mb-6 md:mb-8 flex items-center justify-center gap-4">
            <span className="h-px w-10 md:w-20 bg-gradient-to-r from-transparent to-[#dcd9ef]" />
            <p className="text-[13px] md:text-[14px] font-medium text-[#64748b]">
              Trusted by teams at <span className="text-[#161622]">world-class companies</span>
            </p>
            <span className="h-px w-10 md:w-20 bg-gradient-to-l from-transparent to-[#dcd9ef]" />
          </div>
          <div
            className="lp-pause relative overflow-hidden py-2"
            style={{ maskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)" }}
          >
            {/* Margin (not gap) so both halves are identical and -50% loops seamlessly */}
            <div className="lp-marquee flex w-max items-center">
              {[...COMPANIES, ...COMPANIES].map((c, i) => (
                <CompanyChip key={i} {...c} />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
