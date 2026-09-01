"use client";

import React from "react";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  notched?: boolean;
  heavy?: boolean;
  hover?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
  as?: "div" | "article" | "section";
  accentColor?: string;
}

export default function GlassCard({
  children,
  className = "",
  notched = false, // Ignored in light theme
  heavy = false, // Ignored in light theme
  hover = true,
  style,
  onClick,
  as: Tag = "div",
  accentColor,
}: GlassCardProps) {
  const base = "bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] border border-[var(--color-border)]";
  const hoverClass = hover ? "transition-transform duration-200 hover:-translate-y-1 hover:shadow-md" : "";
  const cursorClass = onClick ? "cursor-pointer" : "";

  return (
    <Tag
      className={`${base} ${hoverClass} ${cursorClass} ${className}`}
      style={
        accentColor
          ? { borderTop: `4px solid ${accentColor}`, ...style }
          : style
      }
      onClick={onClick}
    >
      {children}
    </Tag>
  );
}
