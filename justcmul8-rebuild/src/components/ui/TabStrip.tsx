"use client";

import React, { useRef } from "react";
import { motion } from "framer-motion";

export interface TabDef<T extends string> {
  id: T;
  label: string;
}

/** Props for the panel the strip controls: spread onto the content wrapper. */
export const tabPanelProps = (layoutId: string, value: string) => ({
  role: "tabpanel" as const,
  id: `${layoutId}-panel`,
  "aria-labelledby": `${layoutId}-tab-${value}`,
  tabIndex: 0,
});

/**
 * Pill tab strip with a sliding active pill. Keyboard: Left/Right (or Up/Down) move and select,
 * Home/End jump. Roving tabindex, so Tab enters the strip once and then moves on to the panel.
 */
export default function TabStrip<T extends string>({
  tabs,
  value,
  onChange,
  layoutId,
  label,
  className = "",
}: {
  tabs: readonly TabDef<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Unique per strip; also used to build tab/panel ids. */
  layoutId: string;
  /** Accessible name of the tab list. */
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: React.KeyboardEvent, i: number) {
    const last = tabs.length - 1;
    const next =
      e.key === "ArrowRight" || e.key === "ArrowDown" ? (i === last ? 0 : i + 1) :
      e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i === 0 ? last : i - 1) :
      e.key === "Home" ? 0 :
      e.key === "End" ? last : null;
    if (next === null) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className={`flex items-center gap-1 overflow-x-auto no-scrollbar ${className}`}>
      {tabs.map((t, i) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => { refs.current[i] = el; }}
            id={`${layoutId}-tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={on}
            aria-controls={`${layoutId}-panel`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`relative shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5742FF]/50 focus-visible:ring-offset-1 ${
              on ? "text-white" : "text-slate-600 hover:bg-[#F1EFFF] hover:text-[#161622]"
            }`}
          >
            {on && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-gradient-to-b from-[#6a57ff] to-[#5742FF] shadow-[0_6px_16px_-6px_rgba(87,66,255,.7),inset_0_1px_0_rgba(255,255,255,.3)]"
                transition={{ type: "spring", stiffness: 450, damping: 34 }}
              />
            )}
            <span className="relative z-10">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
