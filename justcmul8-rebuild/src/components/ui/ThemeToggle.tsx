"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

// The .dark class on <html> is the single source of truth (set before paint by the script in layout.tsx).
function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
}
const getDark = () => document.documentElement.classList.contains("dark");

/** True while dark mode is on; re-renders on every switch. For canvas/chart code that needs resolved colours. */
export function useIsDark() {
  return useSyncExternalStore(subscribe, getDark, () => false);
}

/** Switches theme with a circular reveal from (x, y), or a crossfade where View Transitions aren't available. */
export function setTheme(dark: boolean, x = innerWidth / 2, y = 0) {
  const root = document.documentElement;
  const apply = () => {
    root.classList.toggle("dark", dark);
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch {}
  };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return apply();
  if (!document.startViewTransition) {
    root.classList.add("theme-fade");
    apply();
    setTimeout(() => root.classList.remove("theme-fade"), 450);
    return;
  }
  root.style.setProperty("--theme-x", `${x}px`);
  root.style.setProperty("--theme-y", `${y}px`);
  root.style.setProperty("--theme-r", `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
  document.startViewTransition(apply);
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const dark = useIsDark();
  return (
    <button
      type="button"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setTheme(!dark, r.left + r.width / 2, r.top + r.height / 2);
      }}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={`relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ln-e7e5f6 bg-surface text-fg-64748b transition-colors hover:text-fg-5742ff active:scale-95 ${className}`}
    >
      <Sun size={15} strokeWidth={2.2} className={`absolute transition-all duration-500 ${dark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
      <Moon size={15} strokeWidth={2.2} className={`absolute transition-all duration-500 ${dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`} />
    </button>
  );
}
