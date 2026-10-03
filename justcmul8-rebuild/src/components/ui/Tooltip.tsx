import React from "react";

/*
 * CSS-only hover/focus tooltip: no JS, no portal, no listeners, so it costs
 * nothing until shown. Renders inside the trigger's box, so pick `align` to
 * keep it clear of overflow-hidden edges.
 */
export default function Tooltip({
  label,
  shortcut,
  side = "bottom",
  align = "center",
  children,
}: {
  label: string;
  shortcut?: string;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
  children: React.ReactNode;
}) {
  const pos = side === "bottom" ? "top-full mt-2" : "bottom-full mb-2";
  const x = align === "start" ? "left-0" : align === "end" ? "right-0" : "left-1/2 -translate-x-1/2";
  const shift = side === "bottom" ? "-translate-y-1" : "translate-y-1";
  return (
    <span className="relative inline-flex group/tt">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute ${pos} ${x} z-50 flex items-center gap-2 whitespace-nowrap rounded-lg bg-[#161622] border border-[#3a3a4c] px-2.5 py-1.5 text-[11.5px] font-semibold text-white shadow-[0_8px_24px_-6px_rgba(16,24,40,.35)] opacity-0 ${shift} transition-[opacity,translate] duration-150 ease-out group-hover/tt:opacity-100 group-hover/tt:translate-y-0 group-hover/tt:delay-300 group-focus-within/tt:opacity-100 group-focus-within/tt:translate-y-0 motion-reduce:transition-none`}
      >
        {label}
        {shortcut && (
          <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-white/20 bg-white/10 px-1 font-mono text-[10.5px] font-bold text-white/90">
            {shortcut}
          </kbd>
        )}
      </span>
    </span>
  );
}
