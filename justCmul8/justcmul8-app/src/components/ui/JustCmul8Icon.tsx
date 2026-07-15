import React from "react";

export interface JustCmul8IconProps extends React.SVGProps<SVGSVGElement> {}

export function JustCmul8Icon({ className = "", ...props }: JustCmul8IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={`${className}`}
      fill="none"
      {...props}
    >
      <defs>
        <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="cyber-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* Outer Cyber Frame */}
      <path
        d="M25 5 L75 5 L95 25 L95 75 L75 95 L25 95 L5 75 L5 25 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.2"
      />
      <path
        d="M20 10 L80 10 L90 20 L90 80 L80 90 L20 90 L10 80 L10 20 Z"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="4 6"
        strokeOpacity="0.4"
      />

      {/* The Core '8' Infinity Symbol */}
      <g filter="url(#neon-glow)">
        <path
          d="M 15 50 C 15 20, 45 20, 50 50 C 55 80, 85 80, 85 50 C 85 20, 55 20, 50 50 C 45 80, 15 80, 15 50 Z"
          stroke="url(#cyber-gradient)"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Core Intersection Node */}
        <circle cx="50" cy="50" r="4.5" fill="currentColor" />
        
        {/* Peripheral Nodes */}
        <circle cx="15" cy="50" r="3.5" fill="currentColor" />
        <circle cx="85" cy="50" r="3.5" fill="currentColor" />
      </g>

      {/* Floating Data Particles */}
      <circle cx="32" cy="35" r="1.5" fill="currentColor" opacity="0.8" />
      <circle cx="68" cy="65" r="1.5" fill="currentColor" opacity="0.8" />
      <circle cx="32" cy="65" r="1" fill="currentColor" opacity="0.5" />
      <circle cx="68" cy="35" r="1" fill="currentColor" opacity="0.5" />

      {/* Cyber Accents */}
      <rect x="0" y="45" width="2" height="10" fill="currentColor" opacity="0.7" />
      <rect x="98" y="45" width="2" height="10" fill="currentColor" opacity="0.7" />
      <rect x="45" y="0" width="10" height="2" fill="currentColor" opacity="0.7" />
      <rect x="45" y="98" width="10" height="2" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

export default JustCmul8Icon;
