"use client";

import React, { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Info, Minus, type LucideIcon } from "lucide-react";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { TONES, isNum, type Tone } from "./chartTheme";

/* ───────────────────────── HelpTip ───────────────────────── */

/** Small (i) button that explains something in plain English on hover or keyboard focus. */
export function HelpTip({ text, label = "What does this mean?", align = "end" }: { text: string; label?: string; align?: "start" | "end" | "center" }) {
  const id = useId();
  const x = align === "start" ? "left-0" : align === "center" ? "left-1/2 -translate-x-1/2" : "right-0";
  return (
    <span className="group/help relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#5742FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5742FF]/50"
      >
        <Info size={13} strokeWidth={2.4} />
      </button>
      <span
        role="tooltip"
        id={id}
        className={`pointer-events-none absolute top-full z-40 mt-1.5 ${x} w-60 rounded-xl border border-white/10 bg-[#161622] px-3 py-2 text-left text-[12px] font-medium normal-case leading-snug tracking-normal text-white/90 opacity-0 shadow-[0_14px_36px_-10px_rgba(16,24,40,.5)] transition-opacity duration-150 group-hover/help:opacity-100 group-focus-within/help:opacity-100 motion-reduce:transition-none`}
      >
        {text}
      </span>
    </span>
  );
}

/* ───────────────────────── Sparkline ───────────────────────── */

/** Tiny inline trend line. Pure SVG, no chart library, so it is cheap to render in many cards. */
export function Sparkline({ data, color, height = 32, label }: { data: number[]; color: string; height?: number; label?: string }) {
  const id = useId().replace(/:/g, "");
  const pts = data.filter(isNum);
  if (pts.length < 2) return null;
  const w = 100;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * w, height - 3 - ((v - min) / span) * (height - 6)] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const last = xy[xy.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="block w-full overflow-visible" style={{ height }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${height} L0,${height} Z`} fill={`url(#spark-${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.6} fill="#fff" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ───────────────────────── RangeBar ───────────────────────── */

export interface RangeSpec {
  /** Left and right ends of the track. */
  min: number;
  max: number;
  /** Filled up to here. */
  value: number;
  /** Optional tick, e.g. a target or the worst case. */
  marker?: number;
  minLabel?: string;
  maxLabel?: string;
  markerLabel?: string;
}

export function RangeBar({ range, color }: { range: RangeSpec; color: string }) {
  const span = range.max - range.min || 1;
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - range.min) / span) * 100));
  return (
    <div>
      <div className="relative h-2 rounded-full bg-slate-100">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}99, ${color})` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct(range.value)}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
        {isNum(range.marker) && (
          <span className="absolute -top-1 h-4 w-0.5 rounded-full bg-slate-700" style={{ left: `calc(${pct(range.marker)}% - 1px)` }} title={range.markerLabel} />
        )}
      </div>
      {(range.minLabel || range.maxLabel || range.markerLabel) && (
        <div className="mt-1 flex justify-between gap-2 text-[10.5px] font-semibold text-slate-500">
          <span className="truncate">{range.minLabel}</span>
          {range.markerLabel && <span className="truncate text-slate-600">{range.markerLabel}</span>}
          <span className="truncate">{range.maxLabel}</span>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── DeltaPill ───────────────────────── */

export interface DeltaSpec {
  /** Signed change. Positive = went up. */
  value: number;
  /** Which direction is good news. Colours the pill. Default "up". */
  goodWhen?: "up" | "down";
  /** Text shown in the pill. Defaults to the signed value. */
  text?: string;
  /** Screen-reader and tooltip text, e.g. "vs. previous run". */
  label?: string;
}

export function DeltaPill({ delta }: { delta: DeltaSpec }) {
  if (!isNum(delta.value)) return null;
  const flat = Math.abs(delta.value) < 1e-9;
  const up = delta.value > 0;
  const good = flat ? null : (delta.goodWhen ?? "up") === "up" ? up : !up;
  const tone = good === null ? TONES.neutral : good ? TONES.good : TONES.bad;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const text = delta.text ?? `${up ? "+" : ""}${delta.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums"
      style={{ background: tone.tint, color: tone.text }}
      title={delta.label}
    >
      <Icon size={12} strokeWidth={2.6} aria-hidden />
      {text}
      {delta.label && <span className="sr-only"> {delta.label}</span>}
    </span>
  );
}

/* ───────────────────────── MetricCard ───────────────────────── */

export interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  /** A number animates up and gets tabular figures; a string is shown as-is. Non-finite numbers show "—". */
  value: number | string | null | undefined;
  /** Shown smaller after the value, e.g. "s", "%", "/hr". */
  unit?: string;
  prefix?: string;
  decimals?: number;
  /** Custom number formatting (overrides decimals and count-up rounding). */
  format?: (n: number) => string;
  /** Colour meaning: brand (neutral highlight), good, warn, bad, info, neutral. */
  tone?: Tone;
  /** Plain-English explanation shown in the (i) tooltip. */
  help?: string;
  /** One supporting line under the value. */
  caption?: React.ReactNode;
  delta?: DeltaSpec;
  /** Values for an inline sparkline. */
  trend?: number[];
  trendLabel?: string;
  range?: RangeSpec;
  /** 0–100, draws a progress bar. */
  progress?: number;
  /** Small label at top-right, e.g. "per station". */
  badge?: string;
  /** Entrance delay in seconds. */
  delay?: number;
  size?: "md" | "sm";
  className?: string;
  children?: React.ReactNode;
}

function Value({ value, decimals = 0, format }: { value: number; decimals?: number; format?: (n: number) => string }) {
  const reduce = useReducedMotion();
  // useCountUp divides by duration, so 1ms (not 0) is the "no animation" setting.
  const animated = useCountUp(value, reduce ? 1 : 900, format ? 6 : decimals);
  return <>{format ? format(animated) : animated.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}

/**
 * The app's KPI tile: tone-keyed edge glow, icon chip, big tabular value with unit,
 * optional delta pill, sparkline, range bar or progress bar, and a plain-English help tip.
 */
export default function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  prefix,
  decimals = 0,
  format,
  tone = "brand",
  help,
  caption,
  delta,
  trend,
  trendLabel,
  range,
  progress,
  badge,
  delay = 0,
  size = "md",
  className = "",
  children,
}: MetricCardProps) {
  const t = TONES[tone];
  const numeric = typeof value === "number";
  const missing = value === null || value === undefined || (numeric && !isNum(value)) || value === "";
  const sm = size === "sm";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`group/metric relative flex min-w-0 flex-col rounded-[20px] border border-[#ECEBF7] bg-white ${sm ? "p-3.5" : "p-4 sm:p-5"} shadow-[0_1px_2px_rgba(16,24,40,.04),0_10px_30px_-18px_rgba(87,66,255,.25)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[color:var(--ring)] hover:shadow-[0_18px_40px_-20px_var(--ring)] focus-within:border-[color:var(--ring)] motion-reduce:transform-none ${className}`}
      style={{ ["--ring" as string]: t.ring }}
    >
      {/* Decoration lives in its own clipped layer so the help tooltip isn't cut off. */}
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${t.solid}, ${t.solid}00 85%)` }} />
        <span
          className="absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-60 blur-2xl transition-opacity duration-300 group-hover/metric:opacity-100"
          style={{ background: t.tint }}
        />
      </span>

      <div className="relative flex items-start justify-between gap-2">
        <span className={`flex shrink-0 items-center justify-center rounded-xl ${sm ? "h-8 w-8" : "h-10 w-10"}`} style={{ background: t.tint, color: t.text }}>
          <Icon size={sm ? 16 : 19} strokeWidth={2.3} aria-hidden />
        </span>
        <span className="flex items-center gap-1">
          {badge && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">{badge}</span>}
          {help && <HelpTip text={help} label={`What is ${label}?`} />}
        </span>
      </div>

      <div className={`relative ${sm ? "mt-2.5" : "mt-4"}`}>
        <div className={`text-[11.5px] font-bold uppercase tracking-[0.08em] text-slate-600 ${sm ? "line-clamp-1" : "line-clamp-2"}`} title={label}>
          {label}
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
          <span className={`font-black tracking-tight text-[#161622] tabular-nums leading-none ${sm ? "text-[20px]" : "text-[28px]"} ${!numeric && !missing ? "break-words" : ""}`}>
            {missing ? (
              <span className="text-slate-500">—</span>
            ) : (
              <>
                {prefix}
                {numeric ? <Value value={value as number} decimals={decimals} format={format} /> : value}
              </>
            )}
          </span>
          {unit && !missing && <span className={`font-bold text-slate-500 ${sm ? "text-[12px]" : "text-[14px]"}`}>{unit}</span>}
          {delta && <DeltaPill delta={delta} />}
        </div>
        {caption && <div className="mt-1.5 text-[12px] font-medium leading-snug text-slate-600">{caption}</div>}
      </div>

      {(trend || range || isNum(progress) || children) && (
        <div className={`relative mt-auto ${sm ? "pt-2.5" : "pt-4"}`}>
          {trend && <Sparkline data={trend} color={t.solid} label={trendLabel} />}
          {range && <RangeBar range={range} color={t.solid} />}
          {isNum(progress) && (
            <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${t.solid}aa, ${t.solid})` }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay }}
              />
            </div>
          )}
          {children}
        </div>
      )}
    </motion.div>
  );
}
