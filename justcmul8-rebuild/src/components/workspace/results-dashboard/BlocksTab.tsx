"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import type { SimResult, NodeStats } from "@/lib/simulation/types";
import { NODE_LABELS } from "@/lib/simulation/simTypeRegistry";

type SortKey = "label" | "nodeType" | "entitiesIn" | "entitiesOut" | "utilization" | "avgWaitTime";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "label", label: "Station Name" },
  { key: "nodeType", label: "Station Type" },
  { key: "entitiesIn", label: "Arrived" },
  { key: "entitiesOut", label: "Finished" },
  { key: "utilization", label: "Busy %" },
  { key: "avgWaitTime", label: "Avg Wait" },
];

export default function BlocksTab({ result }: { result: SimResult }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("utilization");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  const rows = useMemo(() => {
    let entries = Object.entries(result.nodeStats);
    if (search.trim()) {
      const q = search.toLowerCase();
      entries = entries.filter(
        ([, s]) => s.label.toLowerCase().includes(q) || s.nodeType.toLowerCase().includes(q)
      );
    }
    entries.sort(([, a], [, b]) => {
      const av = (a as any)[sortKey] ?? 0;
      const bv = (b as any)[sortKey] ?? 0;
      const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
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

  const selectedBlockStats: NodeStats | null = selectedBlockId
    ? result.nodeStats[selectedBlockId]
    : null;

  return (
    <div className="space-y-4">
      {/* ── Search & Filter Controls ── */}
      <div className="rounded-[22px] bg-white border border-gray-100 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search station by name or type..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-[13px] bg-gray-50 focus:bg-white focus:outline-none focus:border-[#5742FF] transition-all"
            />
          </div>
          <span className="text-[12px] font-bold text-gray-500">
            {rows.length} station{rows.length !== 1 ? "s" : ""} inspected
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-[#FAF9FF]">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="py-3 px-5 text-[11px] font-black uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:text-[#5742FF] transition-colors"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {col.label}
                      {sortKey === col.key ? (
                        sortDir === "asc" ? (
                          <ArrowUp size={12} className="text-[#5742FF]" />
                        ) : (
                          <ArrowDown size={12} className="text-[#5742FF]" />
                        )
                      ) : (
                        <ArrowUpDown size={12} className="opacity-30" />
                      )}
                    </span>
                  </th>
                ))}
                <th className="py-3 px-5 text-[11px] font-black uppercase tracking-wider text-gray-500 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([id, s], i) => {
                const isBottleneck = result.bottleneckNodeId === id;
                const util = s.utilization !== undefined ? Math.round(s.utilization * 100) : null;

                return (
                  <motion.tr
                    key={id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className={`border-b border-gray-100 hover:bg-[#FAF9FF] transition-colors ${
                      isBottleneck ? "bg-red-50/40" : ""
                    }`}
                  >
                    <td className="py-3.5 px-5 font-bold text-gray-900">
                      <div className="flex items-center gap-2">
                        <span>{s.label}</span>
                        {isBottleneck && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-red-600 text-white">
                            SLOWEST CHOKE POINT
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-gray-500 font-medium">
                      {NODE_LABELS[s.nodeType as keyof typeof NODE_LABELS] || s.nodeType}
                    </td>
                    <td className="py-3.5 px-5 font-bold text-blue-600 tabular-nums">
                      {s.entitiesIn}
                    </td>
                    <td className="py-3.5 px-5 font-bold text-emerald-600 tabular-nums">
                      {s.entitiesOut}
                    </td>
                    <td className="py-3.5 px-5">
                      {util !== null ? (
                        <div className="flex items-center gap-2.5">
                          <div className="w-16 h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              style={{
                                width: `${util}%`,
                                backgroundColor:
                                  util > 85 ? "#EF4444" : util > 60 ? "#F59E0B" : "#10B981",
                              }}
                              className="h-full rounded-full"
                            />
                          </div>
                          <span className="font-extrabold text-gray-900 text-[12px] tabular-nums">
                            {util}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 font-bold text-gray-800 tabular-nums">
                      {(s.avgWaitTime ?? 0).toFixed(2)}s
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => setSelectedBlockId(id)}
                        className="px-2.5 py-1 text-[11px] font-bold text-[#5742FF] bg-indigo-50 hover:bg-[#5742FF] hover:text-white rounded-lg transition-all"
                      >
                        Details
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Station Drill-Down Modal ── */}
      <AnimatePresence>
        {selectedBlockId && selectedBlockStats && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedBlockId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white w-full max-w-lg rounded-[24px] shadow-2xl p-6 relative space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-[18px] font-black text-gray-900">
                    {selectedBlockStats.label}
                  </h3>
                  <span className="text-[12px] font-semibold text-gray-400">
                    {NODE_LABELS[selectedBlockStats.nodeType as keyof typeof NODE_LABELS] ||
                      selectedBlockStats.nodeType}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedBlockId(null)}
                  className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 text-center">
                  <span className="text-[10.5px] font-bold text-gray-400 uppercase block mb-1">
                    Total Arrived
                  </span>
                  <span className="text-[22px] font-black text-blue-600 tabular-nums">
                    {selectedBlockStats.entitiesIn}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 text-center">
                  <span className="text-[10.5px] font-bold text-gray-400 uppercase block mb-1">
                    Total Finished
                  </span>
                  <span className="text-[22px] font-black text-emerald-600 tabular-nums">
                    {selectedBlockStats.entitiesOut}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 text-center">
                  <span className="text-[10.5px] font-bold text-gray-400 uppercase block mb-1">
                    Average Line Wait
                  </span>
                  <span className="text-[22px] font-black text-gray-900 tabular-nums">
                    {(selectedBlockStats.avgWaitTime ?? 0).toFixed(2)}s
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 text-center">
                  <span className="text-[10.5px] font-bold text-gray-400 uppercase block mb-1">
                    Busy % (Workload)
                  </span>
                  <span className="text-[22px] font-black text-[#5742FF] tabular-nums">
                    {selectedBlockStats.utilization !== undefined
                      ? `${Math.round(selectedBlockStats.utilization * 100)}%`
                      : "N/A"}
                  </span>
                </div>
              </div>

              {(selectedBlockStats.renegeCount ?? 0) > 0 && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-[12px] text-red-700 font-bold flex items-center justify-between">
                  <span>Left Line (Gave Up Waiting):</span>
                  <span>{selectedBlockStats.renegeCount}</span>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
