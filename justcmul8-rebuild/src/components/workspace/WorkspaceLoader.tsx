"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Users, ListOrdered, Cpu, Flag } from "lucide-react";
import { CubeMark, EASE_OUT, spring } from "@/components/brand/CubeMark";

const STEPS = ["Loading your model", "Warming up the SimPy engine", "Connecting collaborators", "Arranging the canvas"];

// A tiny live pipeline: Source → Queue → Resource → Sink, with entities flowing through it.
const PIPE = [
  { icon: Users, color: "#2f6fed" },
  { icon: ListOrdered, color: "#8b5cf6" },
  { icon: Cpu, color: "#0ea5a5" },
  { icon: Flag, color: "#12a150" },
];
const GAP = 76; // px between node centres
const TRACK = GAP * (PIPE.length - 1);

/**
 * Full-screen "Preparing workspace" state. Render it inside <AnimatePresence> and unmount it
 * when data is ready: the exit lifts the brand away and dissolves the curtain into the canvas.
 */
export default function WorkspaceLoader() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 900);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-label="Preparing workspace"
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center overflow-hidden bg-[#F8F9FE]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.45, ease: EASE_OUT, delay: 0.15 } }}
    >
      {/* Canvas-style dot grid, like the editor underneath */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(99,102,241,.18) 1.2px, transparent 1.7px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse 60% 55% at 50% 50%, #000 10%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 60% 55% at 50% 50%, #000 10%, transparent 80%)",
        }}
      />

      <motion.div
        className="relative flex flex-col items-center"
        exit={{ scale: 1.08, opacity: 0, filter: "blur(6px)", transition: { duration: 0.35, ease: EASE_OUT } }}
      >
        {/* Brand: the cube assembles, then breathes while we load */}
        <div className="relative mb-9">
          <motion.div
            className="absolute left-1/2 top-1/2 w-[240%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(87,66,255,.28), rgba(139,92,246,.1) 45%, transparent 70%)" }}
            animate={{ scale: [0.9, 1.08, 0.9], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity }}
          />
          <CubeMark mode="breathe" delay={0.05} style={{ height: 76 }} />
        </div>

        {/* Mini simulation */}
        <div className="relative mb-9" style={{ width: TRACK + 44, height: 44 }}>
          <svg className="absolute inset-0 overflow-visible" width={TRACK + 44} height={44}>
            <motion.line
              x1={22}
              y1={22}
              x2={22 + TRACK}
              y2={22}
              stroke="#d9d4fb"
              strokeWidth={2.5}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.25 }}
            />
            {[0, 1, 2, 3].map((i) => (
              <motion.circle
                key={i}
                r={4.5}
                cy={22}
                fill="#8b5cf6"
                initial={{ cx: 22, opacity: 0 }}
                animate={{ cx: [22, 22 + TRACK], opacity: [0, 1, 1, 0] }}
                transition={{
                  cx: { duration: 1.6, ease: [0.45, 0, 0.55, 1], repeat: Infinity, delay: 0.8 + i * 0.4 },
                  opacity: { duration: 1.6, times: [0, 0.1, 0.9, 1], repeat: Infinity, delay: 0.8 + i * 0.4 },
                }}
              />
            ))}
          </svg>
          {PIPE.map(({ icon: Icon, color }, i) => (
            <motion.div
              key={i}
              className="absolute top-0 w-11 h-11 rounded-[13px] bg-white border border-[#ebe8fb] shadow-[0_8px_20px_-10px_rgba(60,50,160,.35)] flex items-center justify-center"
              style={{ left: i * GAP }}
              initial={{ scale: 0, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={spring(16, 0.55, 0.3 + i * 0.09)}
            >
              <Icon size={18} strokeWidth={2.3} style={{ color }} />
            </motion.div>
          ))}
        </div>

        <h3 className="text-[#111827] font-extrabold tracking-tight text-xl mb-2">Preparing workspace</h3>

        {/* Rolling status line */}
        <div className="relative h-5 w-72 overflow-hidden text-center">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={step}
              className="absolute inset-x-0 text-gray-500 text-[13px]"
              initial={{ y: "110%", opacity: 0, filter: "blur(4px)" }}
              animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
              exit={{ y: "-110%", opacity: 0, filter: "blur(4px)" }}
              transition={spring(14, 0.85)}
            >
              {STEPS[step]}…
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Progress: eases towards the end but never claims to finish before data arrives */}
        <div className="mt-5 w-44 h-[3px] rounded-full bg-[#ebe8fb] overflow-hidden">
          <motion.div
            className="h-full rounded-full origin-left"
            style={{ background: "linear-gradient(90deg, #8b5cf6, #5742FF)" }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 0.92 }}
            transition={{ duration: 3.2, ease: [0.1, 0.8, 0.2, 1] }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
