"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Search,
  User,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingDown,
  Layers,
  ChevronRight,
} from "lucide-react";
import type { SimResult, SimTypeId, EntityJourney } from "@/lib/simulation/types";

export default function EntityTracerTab({
  result,
  simType,
}: {
  result: SimResult;
  simType: SimTypeId;
}) {
  const allJourneys = useMemo(() => result.entityJourneys || [], [result.entityJourneys]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "slowest" | "reneged">("slowest");
  const [selectedEntityId, setSelectedEntityId] = useState<number | null>(
    allJourneys[0]?.entityId ?? null
  );

  const filteredJourneys = useMemo(() => {
    let list = [...allJourneys];

    if (filterMode === "slowest") {
      list.sort((a, b) => b.totalCycleTime - a.totalCycleTime);
    } else if (filterMode === "reneged") {
      list = list.filter((j) => j.status === "reneged");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().replace("#", "");
      list = list.filter(
        (j) =>
          String(j.entityId).includes(q) ||
          j.entityClass.toLowerCase().includes(q) ||
          j.status.toLowerCase().includes(q)
      );
    }

    return list.slice(0, 50); // limit to 50 in list
  }, [allJourneys, filterMode, searchQuery]);

  const selectedJourney = useMemo(() => {
    return allJourneys.find((j) => j.entityId === selectedEntityId) || filteredJourneys[0] || null;
  }, [allJourneys, selectedEntityId, filteredJourneys]);

  if (allJourneys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center text-gray-500">
        <User size={36} className="text-gray-300 mb-2" />
        <p className="text-[14px] font-bold">No individual journeys recorded.</p>
        <p className="text-[12px] text-gray-400 mt-1">Run a simulation with entity tracking to view individual paths.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* ── Left Column: Entity Selector List (4 cols) ── */}
      <div className="lg:col-span-4 rounded-[22px] bg-white border border-gray-100 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] flex flex-col h-[580px] overflow-hidden">
        {/* Header & Search */}
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Person / Item #ID..."
              className="w-full pl-9 pr-3 py-2 text-[12.5px] rounded-xl border border-gray-200 focus:outline-none focus:border-[#5742FF] bg-gray-50 text-gray-900"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {[
              { id: "slowest", label: "Longest Delays" },
              { id: "all", label: "All Items" },
              { id: "reneged", label: "Left Line" },
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setFilterMode(mode.id as any)}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  filterMode === mode.id
                    ? "bg-[#5742FF] text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Entity List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
          {filteredJourneys.map((journey) => {
            const isSelected = selectedJourney?.entityId === journey.entityId;
            return (
              <div
                key={journey.entityId}
                onClick={() => setSelectedEntityId(journey.entityId)}
                className={`p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between border ${
                  isSelected
                    ? "bg-[#F8F7FF] border-[#5742FF]/40 shadow-sm"
                    : "bg-white border-transparent hover:bg-gray-50 hover:border-gray-100"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[12px] ${
                      isSelected
                        ? "bg-[#5742FF] text-white"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    #{journey.entityId}
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-gray-900">
                      Item #{journey.entityId}
                    </div>
                    <div className="text-[10.5px] text-gray-400">
                      Arrived: t = {journey.arrivalTime.toFixed(1)}s
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[13px] font-extrabold text-gray-900 tabular-nums">
                    {journey.totalCycleTime.toFixed(1)}s
                  </div>
                  <span
                    className={`text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      journey.status === "completed"
                        ? "bg-emerald-50 text-emerald-600"
                        : journey.status === "reneged"
                        ? "bg-red-50 text-red-600"
                        : "bg-amber-50 text-amber-600"
                    }`}
                  >
                    {journey.status === "completed"
                      ? "Finished"
                      : journey.status === "reneged"
                      ? "Left Line"
                      : "In-Flight"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right Column: Step-by-Step Journey Stepper (8 cols) ── */}
      <div className="lg:col-span-8 rounded-[22px] bg-white border border-gray-100 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] p-6 flex flex-col justify-between">
        {selectedJourney ? (
          <div>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[20px] font-black text-gray-900 tracking-tight">
                    Item #{selectedJourney.entityId}
                  </span>
                  <span
                    className={`text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                      selectedJourney.status === "completed"
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                        : "bg-red-50 text-red-600 border border-red-200"
                    }`}
                  >
                    {selectedJourney.status === "completed"
                      ? "Finished"
                      : selectedJourney.status === "reneged"
                      ? "Left Line (Gave Up)"
                      : "In-Flight"}
                  </span>
                </div>
                <p className="text-[12px] text-gray-400 mt-0.5">
                  Arrival: t = {selectedJourney.arrivalTime.toFixed(1)}s • Total Door-to-Door Time:{" "}
                  {selectedJourney.totalCycleTime.toFixed(1)}s
                </p>
              </div>

              <div className="flex items-center gap-4 text-right">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">
                    Time Waiting in Line
                  </span>
                  <span className="text-[16px] font-black text-amber-600 tabular-nums">
                    {selectedJourney.totalWaitTime.toFixed(1)}s
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">
                    Time Being Served
                  </span>
                  <span className="text-[16px] font-black text-[#5742FF] tabular-nums">
                    {selectedJourney.totalServiceTime.toFixed(1)}s
                  </span>
                </div>
              </div>
            </div>

            {/* Stepper Flow */}
            <div className="space-y-4 my-4">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-400 block mb-2">
                Step-by-Step Station Path
              </span>

              <div className="space-y-3">
                {selectedJourney.steps.map((step, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-4 rounded-2xl bg-gray-50/80 border border-gray-100 flex items-start gap-4 hover:bg-[#FAF9FF] transition-all"
                  >
                    <div className="w-7 h-7 rounded-xl bg-indigo-50 text-[#5742FF] font-black text-[12px] flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[14px] font-extrabold text-gray-900">
                          {step.nodeLabel}
                        </h4>
                        <span className="text-[11px] font-bold text-gray-500">
                          t = {step.enteredAt.toFixed(1)}s → {step.exitedAt.toFixed(1)}s
                        </span>
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-[12px] text-gray-600">
                        {step.waitTime > 0 && (
                          <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                            Waited in Line: {step.waitTime.toFixed(1)}s
                          </span>
                        )}
                        {step.serviceTime > 0 && (
                          <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                            Service Duration: {step.serviceTime.toFixed(1)}s
                          </span>
                        )}
                        {step.status === "reneged" && (
                          <span className="font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                            Left Line (Wait Too Long)
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-gray-400">Select an item on the left to inspect its journey.</div>
        )}

        {/* Time Proportion Breakdown Bar at bottom */}
        {selectedJourney && (
          <div className="mt-6 pt-4 border-t border-gray-100">
            <span className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
              Time Proportion (Line Wait vs Service)
            </span>
            <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden flex">
              <div
                style={{
                  width: `${Math.min(
                    100,
                    (selectedJourney.totalWaitTime / Math.max(1, selectedJourney.totalCycleTime)) * 100
                  )}%`,
                }}
                className="bg-amber-400 h-full"
                title={`Wait Time: ${selectedJourney.totalWaitTime.toFixed(1)}s`}
              />
              <div
                style={{
                  width: `${Math.min(
                    100,
                    (selectedJourney.totalServiceTime / Math.max(1, selectedJourney.totalCycleTime)) * 100
                  )}%`,
                }}
                className="bg-[#5742FF] h-full"
                title={`Service Time: ${selectedJourney.totalServiceTime.toFixed(1)}s`}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 mt-1.5">
              <span>🟡 Time Waiting in Line ({selectedJourney.totalWaitTime.toFixed(1)}s)</span>
              <span>🟣 Time Being Served ({selectedJourney.totalServiceTime.toFixed(1)}s)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
