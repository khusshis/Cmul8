"use client";

import React from "react";
import { motion } from "framer-motion";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  notched?: boolean;
  heavy?: boolean;
  hover?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
  as?: "div" | "article" | "section";
  accentColor?: string; // e.g. "var(--neon-cyan)"
}

export default function GlassCard({
  children,
  className = "",
  notched = false,
  heavy = false,
  hover = true,
  style,
  onClick,
  as: Tag = "div",
  accentColor,
}: GlassCardProps) {
  const base = heavy ? "glass-panel-heavy" : "glass-panel";
  const hoverClass = hover ? "hover-glow-cyan" : "";
  const notchClass = notched ? "notched-card" : "";
  const cursorClass = onClick ? "cursor-pointer" : "";

  return (
    <motion.div
      whileHover={hover ? { scale: 1.01 } : undefined}
      transition={{ duration: 0.2 }}
      style={style}
      onClick={onClick}
    >
      <Tag
        className={`${base} ${hoverClass} ${notchClass} ${cursorClass} transition-all duration-300 ${className}`}
        style={
          accentColor
            ? { borderTop: `2px solid ${accentColor}`, ...style }
            : undefined
        }
      >
        {children}
      </Tag>
    </motion.div>
  );
}
