"use client";
import React from "react";

export default function LiveCursor({ x, y, name, color }: { x: number; y: number; name: string; color: string }) {
  return (
    <div className="absolute pointer-events-none z-50 transition-transform duration-75" style={{ transform: `translate(${x}px, ${y}px)` }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill={color}><path d="M0 0 L16 6 L7 8 L5 16 Z" /></svg>
      <div className="mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm whitespace-nowrap w-max" style={{ background: color }}>
        {name}
      </div>
    </div>
  );
}
