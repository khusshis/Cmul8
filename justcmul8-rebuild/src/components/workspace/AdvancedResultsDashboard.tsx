"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  LayoutGrid,
  TrendingUp,
  Table2,
  ScrollText,
  Download,
  Scale,
  Flame,
  User,
  FileText,
  Sparkles,
} from "lucide-react";
import type { SimResult, SimTypeId } from "@/lib/simulation/types";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import { enrichSimResult } from "@/lib/simulation/analyticsEngine";
import { generateExecutiveHtmlReport } from "@/lib/simulation/reportGenerator";

import ExecutiveTab from "./results-dashboard/ExecutiveTab";
import DeepAnalyticsTab from "./results-dashboard/DeepAnalyticsTab";
import FlowHeatmapTab from "./results-dashboard/FlowHeatmapTab";
import TimelineTab from "./results-dashboard/TimelineTab";
import BlocksTab from "./results-dashboard/BlocksTab";
import EntityTracerTab from "./results-dashboard/EntityTracerTab";
import LogsTab from "./results-dashboard/LogsTab";

export type DashboardTab =
  | "executive"
  | "analytics"
  | "flow"
  | "timeline"
  | "blocks"
  | "entities"
  | "logs";

const TABS: { id: DashboardTab; label: string; icon: any }[] = [
  { id: "executive", label: "Executive Summary", icon: LayoutGrid },
  { id: "analytics", label: "Flow & Balance Check", icon: Scale },
  { id: "flow", label: "Traffic Heatmap", icon: Flame },
  { id: "timeline", label: "Line Buildup Timeline", icon: TrendingUp },
  { id: "blocks", label: "Station Counters", icon: Table2 },
  { id: "entities", label: "Person / Item Journey", icon: User },
  { id: "logs", label: "Live Activity Log", icon: ScrollText },
];

export default function AdvancedResultsDashboard({
  open,
  onClose,
  result: rawResult,
  simType,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  result: SimResult | null;
  simType: SimTypeId;
  projectId: string;
}) {
  const [tab, setTab] = useState<DashboardTab>("executive");
  const simConfig = SIM_TYPE_REGISTRY[simType] || SIM_TYPE_REGISTRY.human_queue;

  // Ensure result has all deep mathematical and journey enrichments
  const result = useMemo(() => {
    if (!rawResult) return null;
    return enrichSimResult(rawResult);
  }, [rawResult]);

  if (!result) return null;

  function handlePrintReport() {
    if (!result) return;
    const html = generateExecutiveHtmlReport(result, simConfig.label + " Simulation");
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full h-full max-w-[1440px] bg-[#F8F7FF] rounded-[28px] shadow-[0_25px_70px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col border border-indigo-100"
          >
            {/* ── Top Header Bar ── */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 h-[72px] bg-white border-b border-gray-100 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-[#5742FF] flex items-center justify-center font-bold">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h1 className="text-[17px] font-black text-gray-900 tracking-tight leading-tight">
                    Simulation Analytics Suite
                  </h1>
                  <p className="text-[11.5px] font-semibold text-gray-400 leading-tight">
                    {simConfig.label} • {result.totalSimTime.toFixed(1)}s Sim Clock • Health Score:{" "}
                    <span className="text-[#5742FF] font-extrabold">{result.healthScore ?? 85}/100</span>
                  </p>
                </div>
              </div>

              {/* 7 Tab Switcher */}
              <div className="hidden xl:flex items-center gap-1 bg-gray-100/80 rounded-full p-1 border border-gray-200/50">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`relative px-3.5 py-1.5 rounded-full text-[12px] font-bold flex items-center gap-1.5 transition-all ${
                      tab === t.id ? "text-white" : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {tab === t.id && (
                      <motion.div
                        layoutId="active-dashboard-tab"
                        className="absolute inset-0 rounded-full bg-[#5742FF] shadow-sm"
                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                      />
                    )}
                    <t.icon size={13} className="relative z-10" />
                    <span className="relative z-10">{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintReport}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-[12px] font-bold text-gray-700 hover:bg-gray-50 hover:text-[#5742FF] shadow-xs transition-all"
                  title="Generate print-ready executive PDF report"
                >
                  <FileText size={14} />
                  <span className="hidden sm:inline">Executive PDF</span>
                </button>

                <a
                  href={`/api/projects/${projectId}/export?format=csv`}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-[12px] font-bold text-gray-700 hover:bg-gray-50 shadow-xs transition-all"
                >
                  <Download size={14} />
                  <span className="hidden sm:inline">CSV Export</span>
                </a>

                <button
                  onClick={onClose}
                  className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-all ml-1"
                >
                  <X size={17} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Mobile / Tablet Tab Switcher (Scrollable) */}
            <div className="xl:hidden flex items-center gap-1.5 p-2 bg-white border-b border-gray-100 overflow-x-auto custom-scrollbar">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-1.5 rounded-xl text-[11.5px] font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                    tab === t.id
                      ? "bg-[#5742FF] text-white shadow-sm"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  <t.icon size={12} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* ── Main Content Area ── */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  {tab === "executive" && (
                    <ExecutiveTab result={result} simType={simType} />
                  )}
                  {tab === "analytics" && (
                    <DeepAnalyticsTab result={result} simType={simType} />
                  )}
                  {tab === "flow" && (
                    <FlowHeatmapTab result={result} simType={simType} />
                  )}
                  {tab === "timeline" && <TimelineTab result={result} />}
                  {tab === "blocks" && <BlocksTab result={result} />}
                  {tab === "entities" && (
                    <EntityTracerTab result={result} simType={simType} />
                  )}
                  {tab === "logs" && <LogsTab result={result} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
