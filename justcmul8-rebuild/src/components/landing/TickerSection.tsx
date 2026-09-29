"use client";

import React, { useRef } from "react";
import { motion, useAnimationFrame, useInView, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, useVelocity, wrap } from "framer-motion";

// Status rail: what the engine is made of (true statements, no invented figures).
const tickerItems: { k: string; v: string; dot: string }[] = [
  { k: "Engine", v: "SimPy discrete-event core", dot: "#22c55e" },
  { k: "Runtime", v: "Python in-browser · Pyodide / WASM", dot: "#654ff0" },
  { k: "AI", v: "Gemini model builder", dot: "#8e75b2" },
  { k: "Canvas", v: "React Flow editor", dot: "#149eca" },
  { k: "Viewport", v: "PixiJS 2D rendering", dot: "#e91e63" },
  { k: "Results", v: "Live KPIs & charts", dot: "#f59e0b" },
  { k: "Data", v: "Supabase · row-level security", dot: "#3ecf8e" },
  { k: "Setup", v: "Nothing to install", dot: "#5742ff" },
];

// A row that drifts on its own and speeds up (or reverses) with scroll velocity.
function VelocityRow({ base, children }: { base: number; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const onScreen = useInView(ref);
  const x = useMotionValue(0);
  const { scrollY } = useScroll();
  const vel = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 400 });
  const factor = useTransform(vel, [-1000, 0, 1000], [-4, 0, 4], { clamp: false });
  const dir = useRef(1);
  // Two identical halves, so wrapping at -50% is seamless.
  const tx = useTransform(x, (v) => `${wrap(-50, 0, v)}%`);

  useAnimationFrame((_, delta) => {
    if (reduce || !onScreen) return;
    const f = factor.get();
    if (f < 0) dir.current = -1;
    else if (f > 0) dir.current = 1;
    x.set(x.get() + dir.current * base * (delta / 1000) * (1 + Math.abs(f)));
  });

  return (
    <motion.div ref={ref} className="flex whitespace-nowrap w-max" style={{ x: tx }}>
      {children}
      {children}
    </motion.div>
  );
}

export default function TickerSection() {
  // Each item is a pill: live dot · small label · value. Margin (not gap) keeps both halves identical.
  const items = tickerItems.map((it) => (
    <span
      key={it.k}
      className="mr-3 inline-flex h-10 items-center gap-2.5 rounded-full border border-[#ecebf7] bg-white pl-3 pr-4 shadow-[0_1px_2px_rgba(16,24,40,.04)]"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inset-0 rounded-full opacity-50 animate-ping" style={{ background: it.dot, animationDuration: "2.4s" }} />
        <span className="relative h-2 w-2 rounded-full" style={{ background: it.dot }} />
      </span>
      <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#94a3b8]">{it.k}</span>
      <span className="font-mono text-[12.5px] font-medium text-[#334155]">{it.v}</span>
    </span>
  ));

  return (
    <div
      aria-hidden="true"
      className="relative overflow-hidden border-y border-[#ecebf7] bg-gradient-to-b from-[#f7f6fe] to-white py-3.5"
      style={{
        WebkitMaskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
        maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
      }}
    >
      <VelocityRow base={-1.2}>{items}</VelocityRow>
    </div>
  );
}
