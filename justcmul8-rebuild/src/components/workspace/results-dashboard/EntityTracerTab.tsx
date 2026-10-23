"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, User, X } from "lucide-react";
import type { SimResult, SimTypeId, EntityJourney } from "@/lib/simulation/types";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import { EmptyState } from "@/components/ui/ChartCard";
import { TONES, fmtSeconds } from "@/components/ui/chartTheme";

const STATUS: Record<EntityJourney["status"], { label: string; tone: (typeof TONES)[keyof typeof TONES] }> = {
  completed: { label: "Finished", tone: TONES.good },
  reneged: { label: "Gave up", tone: TONES.bad },
  dropped: { label: "Dropped", tone: TONES.bad },
  in_flight: { label: "Still inside", tone: TONES.warn },
};
const statusOf = (s: EntityJourney["status"]) => STATUS[s] ?? STATUS.in_flight;

const FILTERS = [
  { id: "slowest", label: "Longest delays" },
  { id: "all", label: "All" },
  { id: "reneged", label: "Gave up" },
] as const;

export default function EntityTracerTab({
  result,
  simType,
}: {
  result: SimResult;
  simType: SimTypeId;
}) {
  const entity = (SIM_TYPE_REGISTRY[simType] || SIM_TYPE_REGISTRY.human_queue).entityName;
  const allJourneys = useMemo(() => result.entityJourneys || [], [result.entityJourneys]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "slowest" | "reneged">("slowest");
  const [selectedEntityId, setSelectedEntityId] = useState<number | null>(allJourneys[0]?.entityId ?? null);

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
      <div className="rounded-[22px] border border-[#ECEBF7] bg-white">
        <EmptyState icon={User} title="No individual journeys recorded" hint="Run the simulation with tracking on to follow each person or item through the stations." />
      </div>
    );
  }

  // Share of time waiting vs being served. Uses wait + service as the whole, so short (<1s) trips still add up to 100%.
  const timeSplit = (j: EntityJourney) => {
    const whole = j.totalWaitTime + j.totalServiceTime;
    return whole > 0 ? { wait: (j.totalWaitTime / whole) * 100, service: (j.totalServiceTime / whole) * 100 } : { wait: 0, service: 0 };
  };
  const split = selectedJourney ? timeSplit(selectedJourney) : null;
  const maxStep = selectedJourney ? Math.max(0.0001, ...selectedJourney.steps.map((s) => s.waitTime + s.serviceTime)) : 1;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
      {/* ── Picker ── */}
      <section aria-label={`${entity} list`} className="flex h-[420px] flex-col overflow-hidden rounded-[22px] border border-[#ECEBF7] bg-white shadow-[0_14px_36px_-24px_rgba(87,66,255,.3)] lg:col-span-4 lg:h-[600px]">
        <div className="space-y-3 border-b border-[#F1F0FA] p-4">
          <label className="relative block">
            <span className="sr-only">Search by ID</span>
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${entity.toLowerCase()} #ID…`}
              className="h-10 w-full rounded-xl border border-[#E7E5F6] bg-[#FAFAFF] pl-10 pr-9 text-[13px] text-[#161622] outline-none placeholder:text-slate-500 focus:border-[#C4B5FD] focus:bg-white focus:shadow-[0_0_0_4px_rgba(139,92,246,.12)]"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
                <X size={13} />
              </button>
            )}
          </label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter journeys">
            {FILTERS.map((mode) => (
              <button
                key={mode.id}
                aria-pressed={filterMode === mode.id}
                onClick={() => setFilterMode(mode.id)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5742FF]/50 ${
                  filterMode === mode.id ? "bg-[#5742FF] text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto p-2">
          {filteredJourneys.length === 0 ? (
            <EmptyState compact icon={Search} title="No matches" hint={filterMode === "reneged" ? `No ${entity.toLowerCase()} gave up waiting. That's good news.` : "Try a different ID."} />
          ) : (
            filteredJourneys.map((journey) => {
              const isSelected = selectedJourney?.entityId === journey.entityId;
              const st = statusOf(journey.status);
              return (
                <button
                  key={journey.entityId}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedEntityId(journey.entityId)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5742FF]/50 ${
                    isSelected ? "border-[#5742FF]/40 bg-[#F6F4FF] shadow-sm" : "border-transparent hover:border-[#F1F0FA] hover:bg-[#FBFAFF]"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className={`flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg px-1.5 text-[11.5px] font-black tabular-nums ${isSelected ? "bg-[#5742FF] text-white" : "bg-slate-100 text-slate-700"}`}>
                      #{journey.entityId}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-bold text-[#161622]">{entity} #{journey.entityId}</span>
                      <span className="block text-[11.5px] text-slate-500">Arrived at {fmtSeconds(journey.arrivalTime)}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[13px] font-extrabold tabular-nums text-[#161622]">{fmtSeconds(journey.totalCycleTime)}</span>
                    <span className="inline-block rounded px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: st.tone.tint, color: st.tone.text }}>{st.label}</span>
                  </span>
                </button>
              );
            })
          )}
        </div>
        {allJourneys.length > 50 && (
          <p className="border-t border-[#F1F0FA] px-4 py-2 text-[11.5px] text-slate-500">Showing up to 50. Search by ID to find others.</p>
        )}
      </section>

      {/* ── Journey ── */}
      <section aria-label="Journey details" className="flex min-w-0 flex-col rounded-[22px] border border-[#ECEBF7] bg-white p-4 shadow-[0_14px_36px_-24px_rgba(87,66,255,.3)] sm:p-6 lg:col-span-8">
        {selectedJourney ? (
          <>
            <div className="mb-5 flex flex-col gap-3 border-b border-[#F1F0FA] pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[20px] font-black tracking-tight text-[#161622]">{entity} #{selectedJourney.entityId}</h3>
                  <span className="rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ background: statusOf(selectedJourney.status).tone.tint, color: statusOf(selectedJourney.status).tone.text }}>
                    {statusOf(selectedJourney.status).label}
                  </span>
                </div>
                <p className="mt-0.5 text-[12.5px] text-slate-600">
                  Arrived at {fmtSeconds(selectedJourney.arrivalTime)} · {fmtSeconds(selectedJourney.totalCycleTime)} door to door
                </p>
              </div>
              <dl className="flex gap-5 sm:text-right">
                <div>
                  <dt className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Waiting</dt>
                  <dd className="text-[17px] font-black tabular-nums" style={{ color: TONES.warn.text }}>{fmtSeconds(selectedJourney.totalWaitTime)}</dd>
                </div>
                <div>
                  <dt className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Being served</dt>
                  <dd className="text-[17px] font-black tabular-nums text-[#4331E0]">{fmtSeconds(selectedJourney.totalServiceTime)}</dd>
                </div>
              </dl>
            </div>

            <h4 className="mb-3 text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-slate-600">Step by step</h4>
            {selectedJourney.steps.length === 0 ? (
              <EmptyState compact title="No stations visited yet" />
            ) : (
              <ol className="relative space-y-2.5 before:absolute before:bottom-4 before:left-[13px] before:top-4 before:w-px before:bg-[#E7E3FF]">
                {selectedJourney.steps.map((step, idx) => {
                  const span = step.waitTime + step.serviceTime;
                  return (
                    <motion.li
                      key={idx}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                      className="relative flex items-start gap-3.5"
                    >
                      <span className="relative z-10 mt-2.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#5742FF] text-[11.5px] font-black text-white shadow-[0_0_0_3px_#EFEDFF]">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1 rounded-2xl border border-[#F1F0FA] bg-[#FBFAFF] p-3.5 transition-colors hover:border-[#E7E3FF]">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                          <span className="min-w-0 break-words text-[14px] font-extrabold text-[#161622]">{step.nodeLabel}</span>
                          <span className="text-[11.5px] font-semibold tabular-nums text-slate-500">
                            {fmtSeconds(step.enteredAt)} → {fmtSeconds(step.exitedAt)}
                          </span>
                        </div>
                        {/* Time bar, scaled to the longest step so steps compare at a glance */}
                        {span > 0 && (
                          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-100" style={{ width: `${Math.max(8, (span / maxStep) * 100)}%` }} aria-hidden>
                            <span className="h-full" style={{ width: `${(step.waitTime / span) * 100}%`, background: TONES.warn.solid }} />
                            <span className="h-full flex-1" style={{ background: "#5742FF" }} />
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px]">
                          {step.waitTime > 0 && (
                            <span className="rounded-md px-2 py-0.5 font-semibold" style={{ background: TONES.warn.tint, color: TONES.warn.text }}>Waited {fmtSeconds(step.waitTime)}</span>
                          )}
                          {step.serviceTime > 0 && (
                            <span className="rounded-md bg-[#EFEDFF] px-2 py-0.5 font-semibold text-[#4331E0]">Served {fmtSeconds(step.serviceTime)}</span>
                          )}
                          {step.status === "reneged" && (
                            <span className="rounded-md bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">Gave up waiting here</span>
                          )}
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </ol>
            )}

            {split && (
              <div className="mt-6 border-t border-[#F1F0FA] pt-4">
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Where the time went</span>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${Math.round(split.wait)}% waiting, ${Math.round(split.service)}% being served`}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${split.wait}%` }} transition={{ duration: 0.7 }} className="h-full" style={{ background: TONES.warn.solid }} />
                  <motion.div initial={{ width: 0 }} animate={{ width: `${split.service}%` }} transition={{ duration: 0.7, delay: 0.1 }} className="h-full bg-[#5742FF]" />
                </div>
                <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-[12px] font-semibold text-slate-600">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TONES.warn.solid }} aria-hidden /> Waiting in line {Math.round(split.wait)}%</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#5742FF]" aria-hidden /> Being served {Math.round(split.service)}%</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <EmptyState icon={User} title={`Pick a ${entity.toLowerCase()} on the left`} hint="You'll see each station it visited and how long it spent there." />
        )}
      </section>
    </div>
  );
}
