"use client";

import React from "react";
import { motion } from "framer-motion";

interface GlitchTextProps {
  children: React.ReactNode;
  className?: string;
  intensity?: "normal" | "high";
  active?: boolean;
  delay?: number; // initial start delay in seconds to offset instances
}

export const GlitchText = ({
  children,
  className = "",
  intensity = "normal",
  active = true,
  delay = 0,
}: GlitchTextProps) => {
  const glitchDelay = intensity === "high" ? 0.4 : 1.2;

  if (!active) {
    return <span className={`inline-block ${className}`}>{children}</span>;
  }

  return (
    <motion.span className={`relative inline-block ${className}`}>
      <span className="relative z-10">{children}</span>
      <motion.span
        className="absolute inset-0"
        style={{ color: "var(--neon-cyan)", pointerEvents: "none", clipPath: "inset(0 0 60% 0)" }}
        animate={{
          x: [0, -8, 0, 5, -3, 0],
          opacity: [0, 0.8, 0, 0.5, 0.3, 0],
          skewX: [0, 5, 0, -3, 0],
        }}
        transition={{ duration: 0.15, repeat: Infinity, repeatDelay: glitchDelay, delay }}
        aria-hidden="true"
      >
        {children}
      </motion.span>
      <motion.span
        className="absolute inset-0"
        style={{ color: "var(--neon-magenta)", pointerEvents: "none", clipPath: "inset(40% 0 0 0)" }}
        animate={{
          x: [0, 8, -5, 0, 3, 0],
          opacity: [0, 0.7, 0, 0.4, 0.2, 0],
          skewX: [0, -5, 0, 3, 0],
        }}
        transition={{ duration: 0.12, repeat: Infinity, repeatDelay: glitchDelay + 0.5, delay: delay + 0.07 }}
        aria-hidden="true"
      >
        {children}
      </motion.span>
    </motion.span>
  );
};
