"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlitchText } from "@/components/ui/GlitchText";

interface PreLoaderProps {
  onComplete: () => void;
}

const bootLines = [
  "INITIALIZING SIMULATION ENVIRONMENT...",
  "LOADING PYODIDE WASM RUNTIME...",
  "CONNECTING TO SUPABASE CLUSTER...",
  "CALIBRATING NODE GRAPH ENGINE...",
  "SYSTEM READY.",
];

export default function PreLoader({ onComplete }: PreLoaderProps) {
  const [phase, setPhase] = React.useState<"boot" | "done">("boot");
  const [currentLine, setCurrentLine] = React.useState(0);
  const [progress, setProgress] = React.useState(0);
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    // Advance boot lines
    if (currentLine < bootLines.length) {
      const t = setTimeout(() => {
        setProgress(Math.round(((currentLine + 1) / bootLines.length) * 100));
        setCurrentLine((l) => l + 1);
      }, 400);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        setPhase("done");
        setTimeout(() => {
          setVisible(false);
          onComplete();
        }, 600);
      }, 400);
      return () => clearTimeout(t);
    }
  }, [currentLine, onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="preloader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center scanlines"
          style={{ background: "var(--bg-primary)" }}
        >
          {/* Cyber grid background */}
          <div className="absolute inset-0 cyber-grid opacity-30" />

          {/* Corner decorations */}
          <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-neon-cyan opacity-60" />
          <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-neon-cyan opacity-60" />
          <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-neon-cyan opacity-60" />
          <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-neon-cyan opacity-60" />

          <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-md px-8">
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="text-center"
            >
              <h1
                className="font-display font-black text-5xl tracking-widest text-neon-cyan"
                style={{ fontFamily: "var(--font-display)" }}
              >
                <GlitchText active={phase !== "done"} intensity="high">
                  JUSTCMUL8
                </GlitchText>
              </h1>
              <p
                className="text-xs mt-1 tracking-widest"
                style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
              >
                DISCRETE EVENT SIMULATION PLATFORM
              </p>
            </motion.div>

            {/* Boot log */}
            <div className="w-full space-y-1.5 min-h-[120px]">
              {bootLines.slice(0, currentLine).map((line, i) => (
                <motion.p
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-xs"
                  style={{
                    fontFamily: "var(--font-mono)",
                    color:
                      i === bootLines.length - 1 && currentLine >= bootLines.length
                        ? "var(--neon-green)"
                        : "var(--neon-cyan)",
                  }}
                >
                  <span style={{ color: "var(--text-muted)" }}>{">"} </span>
                  {line}
                </motion.p>
              ))}
            </div>

            {/* Progress bar */}
            <div className="w-full">
              <div className="flex justify-between mb-1">
                <span
                  className="text-xs"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
                >
                  LOADING
                </span>
                <span
                  className="text-xs text-neon-cyan"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {progress}%
                </span>
              </div>
              <div
                className="w-full h-0.5 rounded-full overflow-hidden"
                style={{ background: "rgba(0,242,255,0.1)" }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: "linear-gradient(90deg, #00f2ff, #7000ff)",
                    boxShadow: "0 0 8px #00f2ff",
                  }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
