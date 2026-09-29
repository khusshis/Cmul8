"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, ListOrdered, Coffee, Armchair, LogOut, Sparkles } from "lucide-react";
import { spring, EASE_OUT } from "@/components/brand/CubeMark";

// Canvas is drawn in a 460 × 190 space; nodes are positioned in % of it so HTML and SVG line up at any width.
const VW = 460;
const VH = 190;
const NODES = [
  { x: 48, y: 95, label: "Customers", icon: Users, color: "#2f6fed" },
  { x: 168, y: 95, label: "Order line", icon: ListOrdered, color: "#8b5cf6" },
  { x: 288, y: 95, label: "Baristas", icon: Coffee, color: "#0ea5a5" },
  { x: 412, y: 42, label: "Tables", icon: Armchair, color: "#12a150" },
  { x: 412, y: 148, label: "Exit", icon: LogOut, color: "#6b6b7b" },
];
const EDGES = [
  "M70,95 L146,95",
  "M190,95 L266,95",
  "M310,95 C356,95 350,42 390,42",
  "M310,95 C356,95 350,148 390,148",
];
// Full journeys the entities take (dine-in vs take-away).
const ROUTES = ["M48,95 L288,95 C356,95 350,42 412,42", "M48,95 L288,95 C356,95 350,148 412,148"];

function useTicker<T>(initial: T, next: (v: T) => T, ms: number) {
  const [v, setV] = useState(initial);
  useEffect(() => {
    const t = setInterval(() => setV(next), ms);
    return () => clearInterval(t);
  }, [ms, next]);
  return v;
}

const walk = (base: number, spread: number) => (v: number) =>
  Math.round(Math.min(base + spread, Math.max(base - spread, v + (Math.random() - 0.5) * spread)) * 10) / 10;
const nextThroughput = walk(128, 8);
const nextUtil = walk(82, 6);
const nextWait = walk(2.4, 0.6);
const nextQueue = (q: number) => Math.max(1, Math.min(7, q + (Math.random() < 0.5 ? -1 : 1)));
const nextClock = (s: number) => s + 37;

// A number that rolls up into place whenever it changes (remount on key; nothing can get stuck hidden).
function Rolling({ value }: { value: string }) {
  return (
    <span className="inline-flex overflow-hidden align-bottom">
      <motion.span key={value} className="inline-block" initial={{ y: "70%", opacity: 0 }} animate={{ y: "0%", opacity: 1 }} transition={spring(16, 0.8)}>
        {value}
      </motion.span>
    </span>
  );
}

/** Landing-style live simulation card: nodes pop in, edges draw, entities flow, KPIs tick. */
export default function LiveSimShowcase({ delay = 0 }: { delay?: number }) {
  const throughput = useTicker(128, nextThroughput, 2200);
  const util = useTicker(82, nextUtil, 2600);
  const wait = useTicker(2.4, nextWait, 3000);
  const queue = useTicker(3, nextQueue, 1400);
  const clock = useTicker(12 * 60 + 5, nextClock, 1000);
  const hh = String(Math.floor(clock / 3600) % 24).padStart(2, "0");
  const mm = String(Math.floor(clock / 60) % 60).padStart(2, "0");

  return (
    <motion.div
      className="relative w-full max-w-[500px] bg-white rounded-[28px] border border-[#ecebf7] shadow-[0_40px_80px_-30px_rgba(87,66,255,.28),0_10px_24px_-12px_rgba(22,22,34,.10)] p-5"
      initial={{ opacity: 0, y: 40, rotate: -2, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      transition={{ ...spring(9, 0.75, delay + 0.25), opacity: { duration: 0.4, delay: delay + 0.25 } }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-space font-bold text-[15px] text-[#161622] truncate">Coffee Shop · Rush Hour</span>
          <span className="hidden sm:flex items-center gap-1 text-[10px] font-bold tracking-wider text-[#7c3aed] bg-[#f5f3ff] rounded-md px-2 py-1 shrink-0">
            <Sparkles size={11} /> AI GENERATED
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-1 shrink-0">
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping" />
            <span className="relative w-2 h-2 rounded-full bg-emerald-500" />
          </span>
          LIVE <span className="font-mono text-emerald-700/80 tabular-nums">{hh}:{mm}</span>
        </div>
      </div>

      {/* Canvas */}
      <div
        className="relative w-full rounded-2xl bg-[#fbfbff] border border-[#f0eefb] overflow-hidden"
        style={{
          aspectRatio: `${VW} / ${VH}`,
          backgroundImage: "radial-gradient(rgba(99,102,241,.2) 1.2px, transparent 1.7px)",
          backgroundSize: "20px 20px",
        }}
      >
        <svg viewBox={`0 0 ${VW} ${VH}`} className="absolute inset-0 w-full h-full">
          {EDGES.map((d, i) => (
            <motion.path
              key={d}
              d={d}
              fill="none"
              stroke="#c4bdfb"
              strokeWidth={2.5}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, ease: EASE_OUT, delay: delay + 0.75 + i * 0.12 }}
            />
          ))}
          {/* Entities: native SMIL motion is cheap and never blocks React */}
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay + 1.3 }}>
            {Array.from({ length: 6 }, (_, i) => (
              <circle key={i} r={5} fill={i % 3 === 2 ? "#12a150" : "#8b5cf6"} stroke="#fff" strokeWidth={2}>
                <animateMotion dur="3.6s" begin={`${i * 0.6}s`} repeatCount="indefinite" path={ROUTES[i % 2]} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".45 0 .55 1" />
              </circle>
            ))}
          </motion.g>
        </svg>

        {NODES.map((n, i) => (
          <motion.div
            key={n.label}
            className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${(n.x / VW) * 100}%`, top: `${(n.y / VH) * 100}%` }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...spring(15, 0.55, delay + 0.45 + i * 0.08), opacity: { duration: 0.2, delay: delay + 0.45 + i * 0.08 } }}
          >
            <div className="relative w-10 h-10 rounded-[13px] bg-white border border-[#ebe8fb] shadow-[0_8px_18px_-8px_rgba(60,50,160,.35)] flex items-center justify-center">
              <n.icon size={17} strokeWidth={2.3} style={{ color: n.color }} />
              {i === 1 && (
                <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full bg-[#8b5cf6] text-white text-[10px] font-bold flex items-center justify-center shadow">
                  <Rolling value={String(queue)} />
                </span>
              )}
            </div>
            <span className="mt-1 text-[10px] font-bold text-[#475569] whitespace-nowrap">{n.label}</span>
          </motion.div>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2.5 mt-4">
        {[
          { label: "THROUGHPUT", value: `${Math.round(throughput)}`, unit: "/h" },
          { label: "UTILIZATION", value: `${Math.round(util)}`, unit: "%" },
          { label: "AVG WAIT", value: wait.toFixed(1), unit: "min" },
        ].map((k, i) => (
          <motion.div
            key={k.label}
            className="rounded-2xl border border-[#f1f0fa] bg-white px-3 py-2.5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT, delay: delay + 1.1 + i * 0.08 }}
          >
            <div className="text-[9.5px] font-bold tracking-[0.12em] text-[#94a3b8]">{k.label}</div>
            <div className="font-space text-[20px] font-bold text-[#161622] tabular-nums leading-tight mt-0.5">
              <Rolling value={k.value} />
              <span className="text-[12px] text-[#94a3b8] font-semibold ml-0.5">{k.unit}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
