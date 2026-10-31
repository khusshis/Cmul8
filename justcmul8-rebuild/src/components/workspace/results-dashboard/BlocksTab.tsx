"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, X, ArrowDownToLine, ArrowUpFromLine, Clock, Gauge, ChevronRight } from "lucide-react";
import type { SimResult, NodeStats } from "@/lib/simulation/types";
import { NODE_LABELS } from "@/lib/simulation/simTypeRegistry";
import MetricCard from "@/components/ui/MetricCard";
import { EmptyState } from "@/components/ui/ChartCard";
import { TONES, fmtSeconds } from "@/components/ui/chartTheme";
import { hasUtilization } from "@/lib/simulation/analyticsEngine";

type SortKey = "label" | "nodeType" | "entitiesIn" | "entitiesOut" | "utilization" | "avgWaitTime";

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "label", label: "Station" },
  { key: "nodeType", label: "Type" },
  { key: "entitiesIn", label: "Arrived", numeric: true },
  { key: "entitiesOut", label: "Finished", numeric: true },
  { key: "utilization", label: "Busy", numeric: true },
  { key: "avgWaitTime", label: "Avg wait", numeric: true },
];

const typeLabel = (t: string) => NODE_LABELS[t as keyof typeof NODE_LABELS] || t;
const utilTone = (u: number) => (u > 85 ? TONES.bad : u > 60 ? TONES.warn : TONES.good);

export default function BlocksTab({ result }: { result: SimResult }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("utilization");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  const total = Object.keys(result.nodeStats).length;

  const rows = useMemo(() => {
    let entries = Object.entries(result.nodeStats);
    if (search.trim()) {
      const q = search.toLowerCase();
      entries = entries.filter(
        ([, s]) => s.label.toLowerCase().includes(q) || s.nodeType.toLowerCase().includes(q) || typeLabel(s.nodeType).toLowerCase().includes(q)
      );
    }
    entries.sort(([, a], [, b]) => {
      // Rows showing "—" for Busy sort below every real value.
      const val = (s: NodeStats) => (sortKey === "utilization" && !hasUtilization(s) ? -1 : s[sortKey] ?? 0);
      const av = val(a);
      const bv = val(b);
      const cmp = typeof av === "string" ? av.localeCompare(String(bv)) : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return entries;
  }, [result.nodeStats, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const selectedBlockStats: NodeStats | null = selectedBlockId ? result.nodeStats[selectedBlockId] : null;

  // Escape closes the details dialog. Capture phase + preventDefault so the parent suite doesn't also close.
  useEffect(() => {
    if (!selectedBlockId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setSelectedBlockId(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [selectedBlockId]);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[22px] border border-ln-ecebf7 bg-surface shadow-[0_14px_36px_-24px_rgba(87,66,255,.3)]">
        {/* ── Search ── */}
        <div className="flex flex-col gap-3 border-b border-ln-f1f0fa p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-sm">
            <span className="sr-only">Search stations</span>
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by station name or type…"
              className="h-10 w-full rounded-xl border border-ln-e7e5f6 bg-sf-fafaff pl-10 pr-9 text-[13px] text-fg-161622 outline-none transition-shadow placeholder:text-slate-500 focus:border-ln-c4b5fd focus:bg-surface focus:shadow-[0_0_0_4px_rgba(139,92,246,.12)]"
            />
            {search && (
              <button onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                <X size={13} />
              </button>
            )}
          </label>
          <span className="text-[12.5px] font-semibold text-slate-600" aria-live="polite">
            {rows.length === total ? `${total} station${total === 1 ? "" : "s"}` : `${rows.length} of ${total} stations`}
          </span>
        </div>

        {rows.length === 0 ? (
          <EmptyState compact icon={Search} title={total === 0 ? "No stations in this model" : `No stations match “${search}”`} hint={total === 0 ? undefined : "Try a different name or type."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <caption className="sr-only">Station counters. Use the column buttons to sort.</caption>
              <thead>
                <tr className="border-b border-ln-f1f0fa bg-sf-faf9ff">
                  {COLUMNS.map((col) => {
                    const active = sortKey === col.key;
                    return (
                      <th
                        key={col.key}
                        scope="col"
                        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                        className={`px-4 py-2 sm:px-5 ${col.numeric ? "text-right" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(col.key)}
                          className={`inline-flex items-center gap-1.5 rounded-md py-1 text-[11px] font-black uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ln-5742ff/50 ${
                            active ? "text-fg-4331e0" : "text-slate-600 hover:text-fg-4331e0"
                          }`}
                        >
                          {col.label}
                          {active ? sortDir === "asc" ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden /> : <ArrowUpDown size={12} className="opacity-40" aria-hidden />}
                        </button>
                      </th>
                    );
                  })}
                  <th scope="col" className="px-4 py-3 text-right sm:px-5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([id, s], i) => {
                  const isBottleneck = result.bottleneckNodeId === id;
                  const util = hasUtilization(s) && s.utilization !== undefined ? Math.round(s.utilization * 100) : null;
                  return (
                    <motion.tr
                      key={id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.3) }}
                      className={`border-b border-ln-f4f3fb transition-colors last:border-0 hover:bg-sf-faf9ff ${isBottleneck ? "bg-rose-50/50" : ""}`}
                    >
                      <th scope="row" className="px-4 py-3 font-bold text-fg-161622 sm:px-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{s.label}</span>
                          {isBottleneck && <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black uppercase text-white dark:bg-sf-be123c">Bottleneck</span>}
                        </div>
                      </th>
                      <td className="px-4 py-3 font-medium text-slate-600 sm:px-5">{typeLabel(s.nodeType)}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-fg-161622 sm:px-5">{(s.entitiesIn ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-emerald-700 sm:px-5">{(s.entitiesOut ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 sm:px-5">
                        {util !== null ? (
                          <div className="flex items-center justify-end gap-2.5">
                            <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                              <div style={{ width: `${Math.min(100, util)}%`, backgroundColor: utilTone(util).solid }} className="h-full rounded-full" />
                            </div>
                            <span className="w-9 text-right text-[12.5px] font-extrabold tabular-nums text-fg-161622">{util}%</span>
                          </div>
                        ) : (
                          <span className="block text-right text-slate-500" aria-label="Not applicable">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-fg-161622 sm:px-5">{fmtSeconds(s.avgWaitTime)}</td>
                      <td className="px-4 py-3 text-right sm:px-5">
                        <button
                          onClick={() => setSelectedBlockId(id)}
                          aria-label={`Details for ${s.label}`}
                          className="inline-flex items-center gap-0.5 rounded-lg bg-sf-f3f1ff px-2.5 py-1 text-[12px] font-bold text-fg-4331e0 transition-colors hover:bg-sf-5742ff hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ln-5742ff/50"
                        >
                          Details <ChevronRight size={13} aria-hidden />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Station details dialog ── */}
      <AnimatePresence>
        {selectedBlockId && selectedBlockStats && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-sf-161622/45 p-4 backdrop-blur-sm dark:bg-black/60"
            onClick={() => setSelectedBlockId(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="block-detail-title"
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-[24px] bg-sf-f8f7ff p-5 shadow-2xl sm:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-ln-ecebf7 pb-4">
                <div className="min-w-0">
                  <h3 id="block-detail-title" className="break-words text-[18px] font-black text-fg-161622">{selectedBlockStats.label}</h3>
                  <span className="text-[12.5px] font-semibold text-slate-600">{typeLabel(selectedBlockStats.nodeType)}</span>
                </div>
                <button
                  autoFocus
                  onClick={() => setSelectedBlockId(null)}
                  aria-label="Close station details"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-slate-600 shadow-sm hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ln-5742ff/50"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MetricCard size="sm" icon={ArrowDownToLine} tone="info" label="Arrived" value={selectedBlockStats.entitiesIn ?? 0} />
                <MetricCard size="sm" icon={ArrowUpFromLine} tone="good" label="Finished" value={selectedBlockStats.entitiesOut ?? 0} delay={0.03} />
                <MetricCard size="sm" icon={Clock} tone="warn" label="Average wait" value={selectedBlockStats.avgWaitTime ?? 0} format={fmtSeconds} delay={0.06} />
                {(() => {
                  const u = hasUtilization(selectedBlockStats) ? selectedBlockStats.utilization : undefined;
                  return (
                    <MetricCard
                      size="sm"
                      icon={Gauge}
                      tone={u === undefined ? "neutral" : u > 0.85 ? "bad" : u > 0.6 ? "warn" : "good"}
                      label={selectedBlockStats.nodeType === "container" ? "Full" : "Busy"}
                      value={u !== undefined ? Math.round(u * 100) : "N/A"}
                      unit={u !== undefined ? "%" : undefined}
                      progress={u !== undefined ? u * 100 : undefined}
                      delay={0.09}
                    />
                  );
                })()}
              </div>

              {(selectedBlockStats.renegeCount ?? 0) > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-[12.5px] font-bold text-rose-700">
                  <span>Gave up waiting and left</span>
                  <span className="tabular-nums">{selectedBlockStats.renegeCount!.toLocaleString()}</span>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
