"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function SplashScreen() {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"in" | "hold" | "fade-out" | "done">("in");

  useEffect(() => {
    setMounted(true);

    // Sequence:
    // 0ms   : Logo fades in & scales gently with soft blur dissolve
    // 800ms : Tagline and subtle shimmer line settle
    // 1600ms: Smooth cinematic fade and scale-out to reveal the screen underneath
    // 2300ms: Completely unmounted
    const t1 = setTimeout(() => setPhase("hold"), 800);
    const t2 = setTimeout(() => setPhase("fade-out"), 1600);
    const t3 = setTimeout(() => setPhase("done"), 2300);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  if (!mounted || phase === "done") return null;

  return (
    <AnimatePresence>
      <motion.div
        key="uber-splash-container"
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-white select-none pointer-events-none"
          initial={{ opacity: 1 }}
          animate={
            phase === "fade-out"
              ? { opacity: 0, scale: 1.02 }
              : { opacity: 1, scale: 1 }
          }
          transition={{
            duration: 0.65,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {/* Subtle warm/indigo ambient glow in background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 65% 55% at 50% 50%, rgba(99,102,241,0.06) 0%, rgba(249,115,22,0.02) 60%, transparent 80%)",
            }}
          />

          {/* Center brand presentation */}
          <motion.div
            className="relative flex flex-col items-center gap-3"
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={
              phase === "fade-out"
                ? { opacity: 0, scale: 1.08, y: -6, filter: "blur(4px)" }
                : { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }
            }
            transition={{
              opacity: { duration: phase === "fade-out" ? 0.45 : 0.6, ease: "easeOut" },
              scale: { duration: phase === "fade-out" ? 0.6 : 0.7, ease: [0.22, 1, 0.36, 1] },
              y: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
              filter: { duration: 0.5, ease: "easeOut" },
            }}
          >
            {/* Logo Image */}
            <div className="relative">
              <motion.img
                src="/logo-full-transparent.png"
                alt="JustCmul8"
                className="w-[260px] sm:w-[320px] md:w-[360px] h-auto object-contain"
                style={{
                  filter: "drop-shadow(0 10px 25px rgba(99,102,241,0.12))",
                }}
              />
            </div>

            {/* Tagline — Uber/Swiggy micro typography */}
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: phase === "fade-out" ? 0 : 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: phase === "fade-out" ? 0 : 0.3,
                ease: "easeOut",
              }}
            >
              <span className="w-4 h-[1px] bg-gradient-to-r from-transparent to-indigo-400" />
              <span className="text-[12px] md:text-[13px] font-semibold tracking-[0.22em] text-[#6366f1] uppercase">
                Build Simulations
              </span>
              <span className="w-4 h-[1px] bg-gradient-to-l from-transparent to-indigo-400" />
            </motion.div>
          </motion.div>

          {/* Minimalist sleek progress bar at the bottom */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-44 md:w-56 h-[3px] rounded-full bg-gray-100 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: "linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #f97316 100%)",
              }}
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{
                duration: 1.4,
                ease: [0.25, 1, 0.5, 1],
                delay: 0.1,
              }}
            />
          </div>
        </motion.div>
    </AnimatePresence>
  );
}
