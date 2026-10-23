"use client";

import React from "react";

type Item = { name?: string | number; value?: unknown; color?: string; fill?: string; stroke?: string; dataKey?: unknown };

export interface ChartTooltipProps {
  // Injected by recharts when passed as <Tooltip content={<ChartTooltip ... />} />
  active?: boolean;
  payload?: ReadonlyArray<Item>;
  label?: string | number;
  /** Formats each value. Receives the series name and dataKey so mixed series can format differently. */
  valueFormatter?: (value: number, name: string, dataKey: string) => string;
  labelFormatter?: (label: string | number) => string;
  /** Optional line under the values, e.g. "Higher = longer wait". */
  footer?: string;
}

/** Dark floating card used by every chart in the app. */
export default function ChartTooltip({ active, payload, label, valueFormatter, labelFormatter, footer }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const heading = label === undefined || label === "" ? null : labelFormatter ? labelFormatter(label) : String(label);
  return (
    <div className="pointer-events-none min-w-[160px] max-w-[260px] rounded-xl border border-white/10 bg-sf-161622/95 px-3 py-2.5 text-white shadow-[0_14px_36px_-10px_rgba(16,24,40,.55)] backdrop-blur">
      {heading && <div className="mb-1.5 border-b border-white/10 pb-1.5 text-[11px] font-bold text-white/70">{heading}</div>}
      <div className="space-y-1">
        {payload.map((item, i) => {
          const name = String(item.name ?? item.dataKey ?? "");
          const raw = item.value;
          const num = typeof raw === "number" ? raw : Number(raw);
          const text = Number.isFinite(num) ? (valueFormatter ? valueFormatter(num, name, String(item.dataKey ?? "")) : num.toLocaleString(undefined, { maximumFractionDigits: 2 })) : "—";
          return (
            <div key={i} className="flex items-center justify-between gap-4 text-[12px]">
              <span className="flex min-w-0 items-center gap-1.5 text-white/75">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color || item.stroke || item.fill }} />
                <span className="truncate">{name}</span>
              </span>
              <span className="font-bold tabular-nums">{text}</span>
            </div>
          );
        })}
      </div>
      {footer && <div className="mt-1.5 text-[10.5px] text-white/55">{footer}</div>}
    </div>
  );
}
