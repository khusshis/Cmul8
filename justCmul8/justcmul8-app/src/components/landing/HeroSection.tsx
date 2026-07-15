"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { GlitchText } from "@/components/ui/GlitchText";

export default function HeroSection() {
  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 pt-20 pb-16 overflow-hidden"
      aria-label="Hero"
    >


      {/* Floating particles */}
      <Particles />

      {/* Global Environment Scanline */}
      <motion.div
        className="absolute left-0 right-0 h-1 z-0 pointer-events-none mix-blend-screen"
        style={{
          background: "linear-gradient(to bottom, transparent, rgba(0, 242, 255, 0.2) 50%, transparent)",
          maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)"
        }}
        animate={{ top: ["-30%", "130%"] }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      />

      <div className="relative z-10 max-w-4xl mx-auto space-y-8">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs tracking-widest"
          style={{
            fontFamily: "var(--font-mono)",
            background: "rgba(0,242,255,0.08)",
            border: "1px solid rgba(0,242,255,0.25)",
            color: "var(--neon-cyan)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse inline-block" />
          PYODIDE + SIMPY · RUNS IN YOUR BROWSER
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <h1 className="mb-6 w-full flex justify-center">
            <span className="sr-only">JustCmul8</span>
            <GlitchText intensity="high" delay={0}>
              <div className="relative w-[90vw] max-w-[1000px] h-[120px] sm:h-[200px] md:h-[280px] mx-auto overflow-hidden">
                {/* Static Faint CRT Grill */}
                <div 
                  className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_3px,rgba(0,242,255,0.02)_3px,rgba(0,242,255,0.02)_6px)] pointer-events-none z-0"
                  style={{
                    maskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
                    WebkitMaskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)"
                  }}
                />
                {/* Animated Sweeping Scanline */}
                <motion.div
                  className="absolute left-0 right-0 h-2 z-20 pointer-events-none mix-blend-screen"
                  style={{
                    background: "linear-gradient(to bottom, transparent, rgba(0, 242, 255, 0.35) 50%, transparent)",
                    maskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
                    WebkitMaskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)"
                  }}
                  animate={{ top: ["-30%", "130%"] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
                />
                <Image
                  src="/justcmul8new.png"
                  alt="JustCmul8 Logo"
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 800px, 1000px"
                  className="object-contain drop-shadow-[0_0_8px_rgba(0,242,255,0.5)] mix-blend-screen relative z-10 opacity-90"
                  priority
                />
              </div>
            </GlitchText>
          </h1>
          <h2
            className="font-display font-bold leading-tight mb-2"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.2rem, 3vw, 2.2rem)",
              letterSpacing: "0.06em",
              color: "#ffffff",
            }}
          >
            <GlitchText intensity="high" delay={0.8}>
              TRANSFORM YOUR
              <br />
              <span className="text-neon-cyan">OPERATIONS</span>
            </GlitchText>
          </h2>
          <h3
            className="font-display font-semibold mt-2"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1rem, 2.5vw, 1.5rem)",
              letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            WITH THE NO-CODE SIMULATION ENGINE
          </h3>
        </motion.div>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="text-lg max-w-2xl mx-auto leading-relaxed"
          style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}
        >
          Finally, high-fidelity discrete event simulation is accessible to everyone.
          Build complex industrial models visually, and let JustCmul8 instantly transpile
          your design into performant Python/SimPy logic, executed at speed in your browser
          via WebAssembly. Identify bottlenecks, test &ldquo;what-if&rdquo; scenarios, and
          optimize your processes in a risk-free environment.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 1.0 }}
          className="flex flex-wrap items-center justify-center gap-4"
        >
          <Link href="/signup" className="btn-cyber-primary animate-pulse-glow" style={{ fontSize: "1rem", padding: "14px 32px" }}>
            START YOUR FREE PROJECT
            <ArrowRight size={18} />
          </Link>
          <a href="#features" className="btn-cyber-ghost" style={{ fontSize: "1rem", padding: "14px 32px" }}>
            EXPLORE FEATURES
            <ChevronDown size={18} />
          </a>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 1.2 }}
          className="text-xs"
          style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
        >
          1 Active Project Included Free · No Credit Card Required
        </motion.p>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
        >
          <ChevronDown size={20} style={{ color: "var(--neon-cyan)", opacity: 0.5 }} />
        </motion.div>
      </motion.div>
    </section>
  );
}

function Particles() {
  const [mounted, setMounted] = React.useState(false);
  const particles = React.useMemo(() => {
    if (!mounted) return [];
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 8}s`,
      duration: `${6 + Math.random() * 6}s`,
      size: `${2 + Math.random() * 4}px`,
    }));
  }, [mounted]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            background: "var(--neon-cyan)",
            opacity: 0,
            animationName: "particle-float",
            animationDuration: p.duration,
            animationDelay: p.delay,
            animationTimingFunction: "linear",
            animationIterationCount: "infinite",
            boxShadow: `0 0 6px var(--neon-cyan)`,
          }}
        />
      ))}
    </div>
  );
}
