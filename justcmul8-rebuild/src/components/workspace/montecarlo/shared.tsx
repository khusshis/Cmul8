"use client";

import React from "react";
import { AlertTriangle, ChevronDown, Info, Loader2, RotateCcw, X, CheckCircle2, Clock, Gauge, HeartPulse, Wallet } from "lucide-react";
import { HelpTip } from "@/components/ui/MetricCard";
import { SERIES, themeColor } from "@/components/ui/chartTheme";
import type { MetricKey, RunStatistic } from "@/lib/simulation/monteCarlo";

export { HelpTip };

// ─── Palette ─────────────────────────────────────────────────────────────────
// Scenario colours = the app's Okabe-Ito SERIES (validated: all pairs pass the normal-vision
// floor; two pairs sit in the 6–8 CVD band, so every lane also carries its letter and name).
export const BRAND = "var(--color-sf-5742ff)";
export const SCENARIO_COLORS = SERIES.slice(0, 6);
export const SLOT_LETTERS = ["A", "B", "C", "D"] as const;
export const PASS_COLOR = "var(--color-fg-047857)";
export const FAIL_COLOR = "var(--color-fg-be123c)";

// ─── Formatting ──────────────────────────────────────────────────────────────

/** Simulated seconds → "42 s" / "3.5 min" / "1.2 h". */
export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec)) return "—";
  const a = Math.abs(sec);
  if (a < 60) return `${a < 10 ? sec.toFixed(1) : Math.round(sec)} s`;
  if (a < 3600) return `${(sec / 60).toFixed(a < 600 ? 1 : 0)} min`;
  if (a < 86400) return `${(sec / 3600).toFixed(1)} h`;
  return `${(sec / 86400).toFixed(1)} d`;
}

const num = (v: number, digits: number) => (Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 }) : "—");
export const pctText = (share: number, digits = 0) => (Number.isFinite(share) ? `${(share * 100).toFixed(digits)}%` : "—");
export const levelText = (level: number) => `${Math.round(level * 100)}%`;

export interface MetricMeta {
  key: MetricKey;
  label: string;
  /** Unit shown next to inputs, e.g. "s", "%". */
  unit: string;
  icon: React.ElementType;
  /** Plain-English explanation shown in the (i) tooltip. */
  help: string;
  /** Absolute value in the metric's unit. */
  format: (v: number) => string;
  /** Absolute change, e.g. "+12 customers", "−3.1 min", "+4.0 pts". */
  formatDiff: (d: number) => string;
  /** Show the absolute change instead of a % (for metrics already in % or points). */
  absoluteDelta?: boolean;
  /** Physical lower/upper limit; used to explain clamped intervals. */
  boundNote?: string;
}

const signed = (d: number, s: string) => `${d > 0 ? "+" : d < 0 ? "−" : "±"}${s}`;

export function getMetricMeta(entity: string, runLength: string): Record<MetricKey, MetricMeta> {
  const ent = entity.toLowerCase();
  return {
    throughput: {
      key: "throughput",
      label: `${entity}s completed`,
      unit: `${ent}s`,
      icon: CheckCircle2,
      help: `How many ${ent}s reached an Exit Point during one simulated ${runLength}. Higher is better.`,
      format: (v) => num(v, v < 100 ? 1 : 0),
      formatDiff: (d) => signed(d, `${num(Math.abs(d), Math.abs(d) < 100 ? 1 : 0)} ${ent}s`),
      boundNote: "can't be below 0",
    },
    avgWaitTime: {
      key: "avgWaitTime",
      label: "Median wait",
      unit: "s",
      icon: Clock,
      help: `In each run, half of the ${ent}s waited less than this and half waited longer (the median, or p50). The card shows the average of that median across runs. Lower is better.`,
      format: formatDuration,
      formatDiff: (d) => signed(d, formatDuration(Math.abs(d))),
      boundNote: "can't be below 0",
    },
    utilization: {
      key: "utilization",
      label: "Bottleneck busy",
      unit: "%",
      icon: Gauge,
      help: "Share of time the busiest station was working. Near 100% means it's maxed out and queues build; low means spare capacity. Neither direction is automatically better.",
      format: (v) => `${num(v, 1)}%`,
      formatDiff: (d) => signed(d, `${Math.abs(d).toFixed(1)} pts`),
      absoluteDelta: true,
      boundNote: "must stay between 0% and 100%",
    },
    healthScore: {
      key: "healthScore",
      label: "Health score",
      unit: "/100",
      icon: HeartPulse,
      help: "JustCmul8's 0–100 rating that combines flow, waiting and bottleneck pressure. Higher is better.",
      format: (v) => `${num(v, 0)}/100`,
      formatDiff: (d) => signed(d, `${Math.abs(d).toFixed(1)} pts`),
      absoluteDelta: true,
      boundNote: "must stay between 0 and 100",
    },
    totalCost: {
      key: "totalCost",
      label: "Total cost",
      unit: "$",
      icon: Wallet,
      help: "Resource, holding and waiting-penalty cost for one run, from the cost settings on your blocks. Lower is better.",
      format: (v) => (Number.isFinite(v) ? `$${num(v, 2)}` : "—"),
      formatDiff: (d) => signed(d, `$${num(Math.abs(d), 2)}`),
      boundNote: "can't be below 0",
    },
  };
}

/** "+18.2%" for ratio metrics, "+4.0 pts" for metrics already in % or points, absolute when the base is 0. */
export function deltaText(diff: number, pct: number | null, meta: MetricMeta): string {
  if (meta.absoluteDelta || pct === null || !Number.isFinite(pct)) return meta.formatDiff(diff);
  const a = Math.abs(pct);
  return `${pct > 0 ? "+" : pct < 0 ? "−" : "±"}${a < 10 ? a.toFixed(1) : a.toFixed(0)}%`;
}

export const fmtP = (p: number) => (!Number.isFinite(p) ? "p = n/a" : p < 0.001 ? "p < 0.001" : `p = ${p.toFixed(3)}`);

// ─── Primitives ──────────────────────────────────────────────────────────────

export const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ln-5742ff focus-visible:ring-offset-2";
export const cardCls = "rounded-[20px] border border-ln-ecebf7 bg-surface shadow-[0_1px_2px_rgba(16,24,40,.04),0_14px_36px_-24px_rgba(87,66,255,.3)]";
export const inputCls = `h-9 rounded-lg border border-gray-200 bg-surface px-2.5 text-[12.5px] font-bold text-gray-800 tabular-nums outline-none focus:border-ln-5742ff ${focusRing}`;
export const btnGhost = `inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-surface px-3 text-[12px] font-extrabold text-gray-700 transition-colors hover:border-indigo-200 hover:bg-sf-f4f2ff hover:text-fg-4331e0 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;
export const btnPrimary = `inline-flex items-center justify-center gap-2 rounded-xl bg-sf-5742ff px-5 py-2.5 text-[13px] font-black text-white shadow-[0_8px_20px_-6px_rgba(87,66,255,0.6)] transition-all hover:bg-sf-4531e5 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

/** Label + (i) help, wrapping a control. */
export function Field({ label, help, children, className = "" }: { label: string; help: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="mb-1 flex items-center gap-1">
        <span className="text-[11.5px] font-extrabold text-gray-700">{label}</span>
        <HelpTip text={help} label={`About ${label}`} align="start" />
      </div>
      {children}
    </div>
  );
}

/** Radio-group segmented control. */
export function Segmented<T extends string | number>({ label, value, options, onChange, disabled }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-xl border border-indigo-100 bg-sf-f4f2ff p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1 text-[12px] font-black tabular-nums transition-all disabled:cursor-not-allowed ${focusRing} ${
            value === o.value ? "bg-sf-5742ff text-white shadow-[0_2px_8px_rgba(87,66,255,0.35)]" : "text-gray-600 hover:bg-surface hover:text-gray-900"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Preset run counts plus an optional custom number. */
export function CountPicker({ label, value, options, onChange, disabled, custom }: { label: string; value: number; options: number[]; onChange: (n: number) => void; disabled?: boolean; custom?: { min: number; max: number } }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Segmented label={label} value={value} options={options.map((o) => ({ value: o, label: String(o) }))} onChange={onChange} disabled={disabled} />
      {custom && <NumberField label={`${label}, custom (${custom.min} to ${custom.max})`} value={value} min={custom.min} max={custom.max} width="w-20" disabled={disabled} onCommit={(v) => onChange(Math.round(v))} />}
    </span>
  );
}

/** Number input that commits on blur / Enter, so typing "1." doesn't fight the state. */
export function NumberField({ value, onCommit, label, min, max, step = 1, suffix, width = "w-24", disabled }: { value: number; onCommit: (v: number) => void; label: string; min?: number; max?: number; step?: number; suffix?: string; width?: string; disabled?: boolean }) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const v = Number(draft);
    setDraft(null);
    if (draft.trim() === "" || !Number.isFinite(v)) return;
    onCommit(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v)));
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="number"
        inputMode="decimal"
        aria-label={label}
        value={draft ?? String(Number.isFinite(value) ? Number(value.toFixed(4)) : "")}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        className={`${inputCls} ${width}`}
      />
      {suffix && <span className="text-[11.5px] font-bold text-gray-500">{suffix}</span>}
    </span>
  );
}

/** Range slider with a live value readout. */
export function SliderField({ label, value, min, max, step, onChange, format, disabled }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string; disabled?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <input
        type="range"
        aria-label={label}
        aria-valuetext={format(value)}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full min-w-[120px] cursor-pointer accent-fg-5742ff disabled:cursor-not-allowed"
      />
      <span className="w-14 shrink-0 text-right text-[12.5px] font-black tabular-nums text-fg-4331e0">{format(value)}</span>
    </span>
  );
}

export function Chips({ items, tone = "brand" }: { items: string[]; tone?: "brand" | "light" }) {
  if (!items.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Active stress conditions">
      {items.map((c) => (
        <li key={c} className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${tone === "light" ? "bg-white/15 text-white ring-1 ring-white/25" : "bg-sf-efedff text-fg-4331e0 ring-1 ring-indigo-100"}`}>
          {c}
        </li>
      ))}
    </ul>
  );
}

export function LetterSwatch({ color, letter, size = 16 }: { color: string; letter: string; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full font-black text-white" style={{ background: themeColor(color), width: size, height: size, fontSize: size * 0.56 }} aria-hidden>
      {letter}
    </span>
  );
}

/**
 * Range bar: faint track = min..max of all runs, tinted band = risk band of runs,
 * dark band = CI of the average, white-ringed dot = average. Optional target tick.
 */
export function RangeBar({ stat, color = BRAND, domain, target }: { stat: RunStatistic; color?: string; domain?: [number, number]; target?: number }) {
  const [lo, hi] = domain ?? [Math.min(stat.min, target ?? stat.min), Math.max(stat.max, target ?? stat.max)];
  const span = hi - lo || 1;
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - lo) / span) * 100))}%`;
  const width = (a: number, b: number) => `calc(${pos(b)} - ${pos(a)})`;
  color = themeColor(color);
  return (
    <div className="relative h-3" aria-hidden>
      <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-gray-100" />
      <div className="absolute top-1/2 h-[6px] -translate-y-1/2 rounded-full opacity-25" style={{ left: pos(stat.bandLo), width: width(stat.bandLo, stat.bandHi), background: color }} />
      <div className="absolute top-1/2 h-[6px] -translate-y-1/2 rounded-full" style={{ left: pos(stat.ciLower), width: `max(2px, ${width(stat.ciLower, stat.ciUpper)})`, background: color }} />
      {target !== undefined && <div className="absolute top-0 h-3 w-[2px] rounded-full bg-gray-800" style={{ left: pos(target) }} />}
      <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface shadow" style={{ left: pos(stat.mean), background: color }} />
    </div>
  );
}

/** Native <details> section, styled. */
export function Explainer({ title, children, defaultOpen, icon: Icon = Info }: { title: string; children: React.ReactNode; defaultOpen?: boolean; icon?: React.ElementType }) {
  return (
    <details open={defaultOpen} className="group rounded-[20px] border border-indigo-100/80 bg-linear-to-br from-surface to-sf-f4f2ff shadow-[0_4px_20px_-6px_rgba(87,66,255,0.08)]">
      <summary className={`flex cursor-pointer list-none items-center gap-2.5 rounded-[20px] px-5 py-3.5 text-[13px] font-extrabold text-gray-900 [&::-webkit-details-marker]:hidden ${focusRing}`}>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sf-5742ff/10 text-fg-5742ff">
          <Icon size={15} />
        </span>
        {title}
        <ChevronDown size={16} className="ml-auto text-gray-400 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="px-5 pb-5 text-[12.5px] leading-relaxed text-gray-600">{children}</div>
    </details>
  );
}

export function ErrorCard({ title, message, onRetry, onDismiss }: { title: string; message: string; onRetry?: () => void; onDismiss: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-[20px] border border-rose-200 bg-rose-50/70 p-4 sm:flex-row sm:items-start sm:p-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
        <AlertTriangle size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-black text-rose-900">{title}</p>
        <p className="mt-0.5 break-words text-[12.5px] text-rose-800/90">{message}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        {onRetry && (
          <button type="button" onClick={onRetry} className={`flex h-9 items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 text-[12.5px] font-extrabold text-white hover:bg-rose-700 dark:bg-sf-be123c dark:hover:bg-sf-e11d48 ${focusRing}`}>
            <RotateCcw size={14} /> Try again
          </button>
        )}
        <button type="button" onClick={onDismiss} aria-label="Dismiss error" className={`flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-surface text-rose-700 hover:bg-rose-100 ${focusRing}`}>
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

export function WarningCard({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-[20px] border border-amber-200 bg-amber-50/80 p-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
        <AlertTriangle size={16} />
      </span>
      <p className="min-w-0 flex-1 pt-1 text-[12.5px] font-semibold text-amber-900">{message}</p>
      <button type="button" onClick={onDismiss} aria-label="Dismiss warning" className={`flex h-8 w-8 items-center justify-center rounded-lg text-amber-700 hover:bg-amber-100 ${focusRing}`}>
        <X size={14} />
      </button>
    </div>
  );
}

/** Progress with an honest status line and a Cancel button. */
export function ProgressCard({ title, status, completed, total, onCancel }: { title: string; status: string; completed: number; total: number; onCancel: () => void }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="rounded-[20px] border border-indigo-100 bg-surface p-4 shadow-[0_4px_20px_-6px_rgba(87,66,255,0.10)] sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Loader2 size={18} className="shrink-0 animate-spin text-fg-5742ff motion-reduce:animate-none" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-black text-gray-900">{title}</p>
          <p className="text-[11.5px] font-medium text-gray-500" aria-live="polite">{status}</p>
        </div>
        <span className="text-[13px] font-black tabular-nums text-fg-5742ff">{completed}/{total}</span>
        <button type="button" onClick={onCancel} className={`h-8 rounded-lg border border-gray-200 bg-surface px-3 text-[12px] font-extrabold text-gray-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 ${focusRing}`}>
          Cancel
        </button>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-indigo-50" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={completed} aria-label={title}>
        <div className="h-full rounded-full bg-linear-to-r from-sf-5742ff to-sf-9b8cff transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Width of an element, tracked with ResizeObserver (for hand-drawn SVG charts). */
export function useElementWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Evenly spaced "nice" ticks across [lo, hi]. */
export function niceTicks(lo: number, hi: number, count = 5): number[] {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Number(v.toPrecision(12)));
  return out;
}

// ─── Export helpers ──────────────────────────────────────────────────────────

export function downloadFile(name: string, content: string | Blob, type = "text/plain") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadPng(node: HTMLElement, name: string) {
  const { toPng } = await import("html-to-image");
  // Card colour of the current theme, so a dark-mode export isn't light text on white.
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--color-sf-ffffff").trim() || "#ffffff";
  const url = await toPng(node, { backgroundColor: bg, pixelRatio: 2, cacheBust: true });
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const fileSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "export";
