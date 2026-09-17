"use client";

import React, { useMemo, useState } from "react";
import { Search, Download, Copy, Check, ScrollText } from "lucide-react";
import type { SimResult, SimLog } from "@/lib/simulation/types";

const EVENT_PILLS = [
  { id: "all", label: "All Events" },
  { id: "arrived", label: "Arrived" },
  { id: "queued", label: "Queued" },
  { id: "service_start", label: "Service Start" },
  { id: "service_end", label: "Service End" },
  { id: "reneged", label: "Reneged" },
  { id: "completed", label: "Completed" },
];

const EVENT_COLORS: Record<string, string> = {
  arrived: "bg-blue-50 text-blue-700 border-blue-200",
  queued: "bg-purple-50 text-purple-700 border-purple-200",
  service_start: "bg-amber-50 text-amber-700 border-amber-200",
  service_end: "bg-emerald-50 text-emerald-700 border-emerald-200",
  reneged: "bg-red-50 text-red-700 border-red-200",
  completed: "bg-teal-50 text-teal-700 border-teal-200",
};

export default function LogsTab({ result }: { result: SimResult }) {
  const [search, setSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [copied, setCopied] = useState(false);

  const logs = result.logs || [];

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesFilter =
        selectedFilter === "all" || log.event.toLowerCase() === selectedFilter.toLowerCase();
      const q = search.toLowerCase();
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
      .map(
        (l) =>
          `[${l.simTime.toFixed(2)}s] Entity #${l.entityId} -> ${l.nodeLabel} [${l.event.toUpperCase()}]`
      )
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadCsv() {
    const header = "SimTime,EntityId,NodeId,NodeLabel,Event\n";
    const rows = filteredLogs
      .map((l) => `${l.simTime},${l.entityId},"${l.nodeId}","${l.nodeLabel}","${l.event}"`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "simulation_events.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-[22px] bg-white border border-gray-100 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] overflow-hidden flex flex-col h-[580px]">
      {/* ── Top Bar ── */}
      <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF9FF]">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by entity, block, or event..."
            className="w-full pl-9 pr-4 py-2 text-[12.5px] rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-[#5742FF]"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyLogs}
            className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-[12px] font-bold hover:bg-gray-50 flex items-center gap-1.5 shadow-sm transition-all"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
          <button
            onClick={downloadCsv}
            className="px-3 py-1.5 rounded-xl bg-[#5742FF] text-white text-[12px] font-bold hover:bg-[#4531E5] flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ── Filter Chips ── */}
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2 overflow-x-auto custom-scrollbar bg-white">
        {EVENT_PILLS.map((pill) => (
          <button
            key={pill.id}
            onClick={() => setSelectedFilter(pill.id)}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
              selectedFilter === pill.id
                ? "bg-[#5742FF] text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* ── Virtualized / Scrollable Logs List ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 font-mono text-[12px] custom-scrollbar bg-gray-50/50">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-20 text-gray-400 font-sans">No matching event logs found.</div>
        ) : (
          filteredLogs.map((log, i) => {
            const pillStyle =
              EVENT_COLORS[log.event.toLowerCase()] || "bg-gray-100 text-gray-700 border-gray-200";

            return (
              <div
                key={i}
                className="p-2.5 rounded-xl bg-white border border-gray-100/80 hover:border-indigo-100 flex items-center justify-between gap-3 shadow-2xs transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-gray-400 tabular-nums w-14">
                    {log.simTime.toFixed(2)}s
                  </span>
                  <span className="font-extrabold text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-[11px]">
                    Entity #{log.entityId}
                  </span>
                  <span className="text-gray-700 font-sans font-semibold text-[12.5px]">
                    {log.nodeLabel}
                  </span>
                </div>

                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${pillStyle}`}
                >
                  {log.event}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* ── Footer ── */}
      <div className="p-3 border-t border-gray-100 bg-white flex items-center justify-between text-[11.5px] text-gray-400 font-medium">
        <span>Showing {filteredLogs.length} of {logs.length} logged events</span>
        <span>Sim Clock Elapsed: {result.totalSimTime.toFixed(1)}s</span>
      </div>
    </div>
  );
}
