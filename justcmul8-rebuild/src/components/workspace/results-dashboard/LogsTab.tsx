"use client";

import React, { useMemo, useState } from "react";
import { Search, Download, Copy, Check, ScrollText, X } from "lucide-react";
import type { SimResult } from "@/lib/simulation/types";
import { EmptyState } from "@/components/ui/ChartCard";
import { fmtSeconds } from "@/components/ui/chartTheme";

const EVENT_PILLS = [
  { id: "all", label: "All events" },
  { id: "arrived", label: "Arrived" },
  { id: "queued", label: "Queued" },
  { id: "service_start", label: "Service start" },
  { id: "service_end", label: "Service end" },
  { id: "reneged", label: "Gave up" },
  { id: "completed", label: "Completed" },
];

// -700 text on -50 backgrounds keeps every pill above 4.5:1 contrast.
const EVENT_COLORS: Record<string, string> = {
  arrived: "bg-sky-50 text-sky-800 border-sky-200",
  queued: "bg-violet-50 text-violet-800 border-violet-200",
  service_start: "bg-amber-50 text-amber-800 border-amber-200",
  service_end: "bg-emerald-50 text-emerald-800 border-emerald-200",
  reneged: "bg-rose-50 text-rose-800 border-rose-200",
  completed: "bg-teal-50 text-teal-800 border-teal-200",
};

// ponytail: plain list capped at MAX_ROWS; swap for a virtualized list if people need to scroll 10k+ events.
const MAX_ROWS = 500;

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

export default function LogsTab({ result }: { result: SimResult }) {
  const [search, setSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [copied, setCopied] = useState(false);

  const logs = useMemo(() => result.logs || [], [result.logs]);

  const filteredLogs = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter((log) => {
      const matchesFilter = selectedFilter === "all" || log.event.toLowerCase() === selectedFilter.toLowerCase();
      const matchesSearch =
        !q ||
        log.nodeLabel.toLowerCase().includes(q) ||
        log.event.toLowerCase().includes(q) ||
        String(log.entityId).includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [logs, selectedFilter, search]);

  function copyLogs() {
    const text = filteredLogs
      .map((l) => `[${l.simTime.toFixed(2)}s] Entity #${l.entityId} -> ${l.nodeLabel} [${l.event.toUpperCase()}]`)
      .join("\n");
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {}
    );
  }

  function downloadCsv() {
    const header = "SimTime,EntityId,NodeId,NodeLabel,Event\n";
    const rows = filteredLogs
      .map((l) => [l.simTime, l.entityId, csvCell(l.nodeId), csvCell(l.nodeLabel), csvCell(l.event)].join(","))
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "simulation_events.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const shown = filteredLogs.slice(0, MAX_ROWS);

  return (
    <section aria-label="Activity log" className="flex h-[580px] flex-col overflow-hidden rounded-[22px] border border-ln-ecebf7 bg-surface shadow-[0_14px_36px_-24px_rgba(87,66,255,.3)]">
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3 border-b border-ln-f1f0fa bg-sf-faf9ff p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-sm">
          <span className="sr-only">Search events</span>
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, station or event…"
            className="h-10 w-full rounded-xl border border-ln-e7e5f6 bg-surface pl-10 pr-9 text-[13px] text-fg-161622 outline-none placeholder:text-slate-500 focus:border-ln-c4b5fd focus:shadow-[0_0_0_4px_rgba(139,92,246,.12)]"
          />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
              <X size={13} />
            </button>
          )}
        </label>

        <div className="flex items-center gap-2">
          <button
            onClick={copyLogs}
            disabled={filteredLogs.length === 0}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-ln-e7e5f6 bg-surface px-3 text-[12.5px] font-bold text-slate-700 transition-colors hover:border-ln-d9d3fb hover:text-fg-4331e0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ln-5742ff/50 disabled:opacity-50"
          >
            {copied ? <Check size={14} className="text-emerald-600" aria-hidden /> : <Copy size={14} aria-hidden />}
            <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
          </button>
          <button
            onClick={downloadCsv}
            disabled={filteredLogs.length === 0}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-ln-8d80ff bg-gradient-to-b from-sf-6a57ff to-sf-5742ff px-3 text-[12.5px] font-bold text-white shadow-[0_6px_16px_-8px_rgba(87,66,255,.8)] transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ln-5742ff/50 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            <Download size={14} aria-hidden />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Filter chips ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-ln-f1f0fa bg-surface px-4 py-2.5 no-scrollbar" role="group" aria-label="Filter by event type">
        {EVENT_PILLS.map((pill) => (
          <button
            key={pill.id}
            aria-pressed={selectedFilter === pill.id}
            onClick={() => setSelectedFilter(pill.id)}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ln-5742ff/50 ${
              selectedFilter === pill.id ? "bg-sf-5742ff text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* ── List ── */}
      <div className="custom-scrollbar flex-1 overflow-y-auto bg-sf-fbfaff p-2 sm:p-3">
        {filteredLogs.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={logs.length === 0 ? "No events were logged" : "No events match"}
            hint={logs.length === 0 ? "Event logging may be off for this run." : "Try another filter or search term."}
          />
        ) : (
          <ol className="space-y-1">
            {shown.map((log, i) => {
              const pillStyle = EVENT_COLORS[log.event.toLowerCase()] || "bg-slate-100 text-slate-700 border-slate-200";
              return (
                <li
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-ln-f1f0fa bg-surface px-3 py-2 transition-colors hover:border-ln-e7e3ff"
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="w-14 shrink-0 font-mono text-[11.5px] font-bold tabular-nums text-slate-500">{log.simTime.toFixed(2)}s</span>
                    <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 font-mono text-[11.5px] font-bold text-fg-161622">#{log.entityId}</span>
                    <span className="min-w-0 truncate text-[13px] font-semibold text-slate-700">{log.nodeLabel}</span>
                  </span>
                  <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10.5px] font-black uppercase ${pillStyle}`}>{log.event.replace(/_/g, " ")}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ln-f1f0fa bg-surface px-4 py-2.5 text-[12px] font-medium text-slate-600">
        <span aria-live="polite">
          {filteredLogs.length > MAX_ROWS
            ? `Showing first ${MAX_ROWS.toLocaleString()} of ${filteredLogs.length.toLocaleString()} matching (export includes all)`
            : `Showing ${filteredLogs.length.toLocaleString()} of ${logs.length.toLocaleString()} events`}
        </span>
        <span>Simulated {fmtSeconds(result.totalSimTime)}</span>
      </div>
    </section>
  );
}
