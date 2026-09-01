"use client";

import React from "react";

interface GlitchTextProps {
  children: React.ReactNode;
  className?: string;
  intensity?: "normal" | "high";
  active?: boolean;
  delay?: number; 
}

export const GlitchText = ({
  children,
  className = "",
  intensity,
  active,
  delay,
}: GlitchTextProps) => {
  // The glitch effect is removed for the professional light theme.
  // We simply render the text with the passed className.
  return (
    <span className={`inline-block ${className}`}>
      {children}
    </span>
  );
};
