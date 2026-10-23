/**
 * Shared chart + metric look for the results dashboards (recharts 3).
 * One palette, one axis style, one set of number formatters, so every card and chart reads the same.
 */

export const BRAND = "#5742FF";

/** Status tones. Text colours are the -700 shades so they pass WCAG AA on white. */
export const TONES = {
  brand: { solid: "#5742FF", text: "#4331E0", tint: "#EFEDFF", ring: "rgba(87,66,255,.28)" },
  good: { solid: "#10B981", text: "#047857", tint: "#E8F8F1", ring: "rgba(16,185,129,.28)" },
  warn: { solid: "#F59E0B", text: "#B45309", tint: "#FEF4E2", ring: "rgba(245,158,11,.30)" },
  bad: { solid: "#E11D48", text: "#BE123C", tint: "#FDECEF", ring: "rgba(225,29,72,.26)" },
  info: { solid: "#0EA5E9", text: "#0369A1", tint: "#E6F5FD", ring: "rgba(14,165,233,.28)" },
  neutral: { solid: "#64748B", text: "#475569", tint: "#F1F5F9", ring: "rgba(100,116,139,.25)" },
} as const;
export type Tone = keyof typeof TONES;

/**
 * Categorical series colours: brand violet first, then Okabe-Ito hues, which stay distinct
 * for protanopia / deuteranopia / tritanopia. Use in order.
 */
export const SERIES = ["#5742FF", "#E69F00", "#009E73", "#CC79A7", "#0072B2", "#D55E00", "#56B4E9", "#7C3AED"];
export const seriesColor = (i: number) => SERIES[i % SERIES.length];

/** Busy / idle / blocked, picked from the same colour-blind-safe set. */
export const STATE_COLORS = { busy: "#5742FF", idle: "#E69F00", blocked: "#D55E00" } as const;

/** Soft horizontal gridlines. Spread onto <CartesianGrid {...GRID} />. */
export const GRID = { stroke: "#ECEBF7", strokeDasharray: "3 6", vertical: false } as const;

/** Readable axis ticks (slate-500 on white = 4.8:1). Spread onto <XAxis {...AXIS} />. */
export const AXIS = {
  axisLine: false,
  tickLine: false,
  tick: { fill: "#64748B", fontSize: 11, fontWeight: 600 },
} as const;

/** Small axis title, e.g. <YAxis label={axisLabel("Seconds")} />. */
export function axisLabel(value: string, side: "left" | "right" = "left") {
  return {
    value,
    angle: side === "left" ? -90 : 90,
    position: side === "left" ? ("insideLeft" as const) : ("insideRight" as const),
    offset: 14,
    style: { fill: "#64748B", fontSize: 10.5, fontWeight: 700, textAnchor: "middle" as const },
  };
}

/** Y-axis upper bound with a little headroom; never 0 so an all-zero series still draws an axis. */
export const niceMax = (dataMax: number) =>
  !Number.isFinite(dataMax) || dataMax <= 0 ? 1 : dataMax <= 4 ? Math.ceil(dataMax) || 1 : Math.ceil(dataMax * 1.1 - 1e-9);

/** Same, for fractional data such as seconds below 1. */
export const niceMaxFloat = (dataMax: number) =>
  !Number.isFinite(dataMax) || dataMax <= 0 ? 1 : dataMax <= 1 ? Math.max(0.1, +(dataMax * 1.15).toFixed(2)) : Math.ceil(dataMax * 1.1 - 1e-9);

// ─── Formatters: all guard NaN / Infinity / null so the UI never prints "NaN" or "Infinity" ───

export const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** 0.4s, 12s, 3.5 min, 1.2 hr */
export function fmtSeconds(seconds: number | undefined | null): string {
  if (!isNum(seconds) || seconds <= 0) return "0s";
  if (seconds < 60) return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`;
  if (seconds < 3600) {
    const m = seconds / 60;
    return Number.isInteger(m) ? `${m} min` : `${m.toFixed(1)} min`;
  }
  const h = seconds / 3600;
  return Number.isInteger(h) ? `${h} hr` : `${h.toFixed(1)} hr`;
}

/** 950, 1.2k, 3M */
export function fmtCount(val: number | undefined | null): string {
  if (!isNum(val) || val <= 0) return "0";
  if (val >= 1_000_000) {
    const m = val / 1_000_000;
    return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
  }
  if (val >= 1_000) {
    const k = val / 1_000;
    return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
  }
  return Number.isInteger(val) ? val.toString() : val.toFixed(1);
}

export function fmtMoney(val: number | undefined | null, compact = false): string {
  if (!isNum(val)) return "$0";
  if (compact && Math.abs(val) >= 1000) return `${val < 0 ? "-" : ""}$${fmtCount(Math.abs(val))}`;
  return val.toLocaleString(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const fmtPct = (val: number | undefined | null, digits = 0) => (isNum(val) ? `${val.toFixed(digits)}%` : "—");

/** Rate per second with sensible precision. */
export const fmtRate = (val: number | undefined | null) => (!isNum(val) ? "0" : val >= 10 ? val.toFixed(0) : val >= 1 ? val.toFixed(1) : val.toFixed(2));

/**
 * Thin a long series to about `max` points for drawing, always keeping the first, last and
 * peak point of `peakKey` so spikes don't vanish.
 */
export function downsample<T>(rows: T[], max = 180, peakKey?: keyof T): T[] {
  if (rows.length <= max) return rows;
  const step = Math.ceil(rows.length / max);
  const keep = new Set<number>([0, rows.length - 1]);
  for (let i = 0; i < rows.length; i += step) keep.add(i);
  if (peakKey) {
    let peak = 0;
    for (let i = 1; i < rows.length; i++) if (Number(rows[i][peakKey]) > Number(rows[peak][peakKey])) peak = i;
    keep.add(peak);
  }
  return [...keep].sort((a, b) => a - b).map((i) => rows[i]);
}

/** Max of a numeric array without spreading (spreading 100k+ values overflows the call stack). */
export const maxOf = (vals: number[], floor = 0) => vals.reduce((m, v) => (isNum(v) && v > m ? v : m), floor);
