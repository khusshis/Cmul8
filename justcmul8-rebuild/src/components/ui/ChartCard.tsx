"use client";

import React from "react";
import { motion } from "framer-motion";
import { BarChart3, type LucideIcon } from "lucide-react";
import { HelpTip } from "./MetricCard";

/* ───────────────────────── EmptyState ───────────────────────── */

export function EmptyState({
  icon: Icon = BarChart3,
  title,
  hint,
  action,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex h-full w-full flex-col items-center justify-center text-center ${compact ? "gap-1.5 p-4" : "gap-2 p-8"}`}>
      <span className={`flex items-center justify-center rounded-2xl bg-sf-f3f1ff text-fg-5742ff ${compact ? "h-10 w-10" : "h-14 w-14"}`}>
        <Icon size={compact ? 18 : 24} strokeWidth={2.2} aria-hidden />
      </span>
      <p className={`font-bold text-fg-161622 ${compact ? "text-[13px]" : "text-[15px]"}`}>{title}</p>
      {hint && <p className="max-w-sm text-[12.5px] leading-relaxed text-slate-600">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ───────────────────────── ChartLegend ───────────────────────── */

export interface LegendItem {
  label: string;
  color: string;
  /** Dashed line swatch instead of a dot (for reference or secondary lines). */
  dashed?: boolean;
}

/** Compact legend for chart headers. Readable on mobile, unlike recharts' default legend. */
export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[11.5px] font-semibold text-slate-600">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          {it.dashed ? (
            <span aria-hidden className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: it.color }} />
          ) : (
            <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: it.color }} />
          )}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/* ───────────────────────── ChartCard ───────────────────────── */

export interface ChartCardProps {
  icon?: LucideIcon;
  title: string;
  /** One line under the title: what the chart shows and how to read it. */
  description?: React.ReactNode;
  /** Longer plain-English explanation behind an (i) button. */
  help?: string;
  /** Right side of the header: toggles, badges. */
  actions?: React.ReactNode;
  legend?: LegendItem[];
  /** Fixed plot height in px so ResponsiveContainer never collapses to 0. Pass null for free-height content. */
  height?: number | null;
  loading?: boolean;
  /** Show the empty state instead of children. */
  empty?: boolean;
  emptyTitle?: string;
  emptyHint?: React.ReactNode;
  footer?: React.ReactNode;
  /** Entrance delay in seconds. */
  delay?: number;
  className?: string;
  children?: React.ReactNode;
}

/** Card shell for every chart: header with icon + plain-English description, fixed-height plot, empty/loading states. */
export default function ChartCard({
  icon: Icon,
  title,
  description,
  help,
  actions,
  legend,
  height = 260,
  loading = false,
  empty = false,
  emptyTitle = "Nothing to show yet",
  emptyHint = "Run the simulation to fill this chart.",
  footer,
  delay = 0,
  className = "",
  children,
}: ChartCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`relative flex min-w-0 flex-col rounded-[22px] border border-ln-ecebf7 bg-surface p-4 shadow-[0_1px_2px_rgba(16,24,40,.04),0_14px_36px_-24px_rgba(87,66,255,.3)] sm:p-5 ${className}`}
      aria-label={title}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          {Icon && (
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sf-f3f1ff text-fg-5742ff">
              <Icon size={16} strokeWidth={2.3} aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h3 className="text-[14.5px] font-extrabold leading-snug tracking-tight text-fg-161622">{title}</h3>
              {help && <HelpTip text={help} label={`About ${title}`} align="start" />}
            </div>
            {description && <p className="mt-0.5 text-[12.5px] leading-snug text-slate-600">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>

      {legend && legend.length > 0 && !empty && !loading && (
        <div className="mt-3">
          <ChartLegend items={legend} />
        </div>
      )}

      <div className="relative mt-3 min-w-0 flex-auto" style={height ? { height, minHeight: height } : undefined}>
        {loading ? (
          <div className="relative h-full min-h-[120px] overflow-hidden rounded-2xl bg-sf-f6f5fc" aria-busy="true" aria-label="Loading chart">
            <motion.div
              className="absolute inset-y-0 -left-1/2 w-1/2 bg-linear-to-r from-transparent via-surface/70 to-transparent"
              animate={{ x: ["0%", "400%"] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
            />
          </div>
        ) : empty ? (
          <EmptyState title={emptyTitle} hint={emptyHint} compact={!!height && height < 220} />
        ) : (
          children
        )}
      </div>

      {footer && !empty && !loading && <div className="mt-4 border-t border-ln-f1f0fa pt-3.5">{footer}</div>}
    </motion.section>
  );
}

/** A row of small labelled numbers for chart footers. */
export function StatRow({ items }: { items: { label: string; value: React.ReactNode; tone?: "default" | "bad" | "good" }[] }) {
  return (
    <dl className="grid gap-3 text-center" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="truncate text-[10.5px] font-bold uppercase tracking-wider text-slate-500">{it.label}</dt>
          <dd className={`mt-0.5 text-[15px] font-extrabold tabular-nums ${it.tone === "bad" ? "text-rose-700" : it.tone === "good" ? "text-emerald-700" : "text-fg-161622"}`}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
