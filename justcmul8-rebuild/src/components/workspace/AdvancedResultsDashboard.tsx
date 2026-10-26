"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { X, Download, FileText, Loader2, Printer, Info } from "lucide-react";
import type { SimResult, SimTypeId } from "@/lib/simulation/types";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import { toast } from "@/components/ui/Toast";
import TabStrip, { tabPanelProps } from "@/components/ui/TabStrip";
import { TONES } from "@/components/ui/chartTheme";
import { enrichSimResult } from "@/lib/simulation/analyticsEngine";
import { generateExecutiveHtmlReport } from "@/lib/simulation/reportGenerator";
import { generateExecutivePdfReport } from "@/lib/simulation/pdfReportGenerator";
import type { OptimizerFix } from "@/app/api/ai/optimize/route";

import ExecutiveTab from "./results-dashboard/ExecutiveTab";
import DeepAnalyticsTab from "./results-dashboard/DeepAnalyticsTab";
import FlowHeatmapTab from "./results-dashboard/FlowHeatmapTab";
import TimelineTab from "./results-dashboard/TimelineTab";
import BlocksTab from "./results-dashboard/BlocksTab";
import EntityTracerTab from "./results-dashboard/EntityTracerTab";
import LogsTab from "./results-dashboard/LogsTab";
import CostRoiTab from "./results-dashboard/CostRoiTab";

export type DashboardTab =
  | "executive"
  | "analytics"
  | "flow"
  | "timeline"
  | "blocks"
  | "entities"
  | "logs"
  | "cost";

/** Each tab carries one plain-English line: what it shows and how to read it. */
const TABS: { id: DashboardTab; label: string; intro: string }[] = [
  { id: "executive", label: "Executive Summary", intro: "The headline numbers and the biggest delay. Green means healthy, amber needs a look, red is congested." },
  { id: "analytics", label: "Flow & Balance Check", intro: "Checks that work leaves as fast as it arrives, and shows how waits stretch from a normal visit to the unlucky worst case." },
  { id: "flow", label: "Traffic Heatmap", intro: "One card per station, scored 0–100 for congestion. The higher the score, the more that station is holding things up." },
  { id: "timeline", label: "Line Buildup Timeline", intro: "How busy the system was over time. A line that keeps climbing means arrivals are outpacing service." },
  { id: "blocks", label: "Station Counters", intro: "Every station in a sortable table. Click a column to sort, or a row's Details button for its full numbers." },
  { id: "entities", label: "Person / Item Journey", intro: "Follow a single person or item through each station to see exactly where its time went." },
  { id: "logs", label: "Live Activity Log", intro: "Every event in time order. Filter by type or search by station or ID, then copy or export." },
  { id: "cost", label: "Cost & ROI", intro: "What the run cost, split into staff/machine time, held inventory and waiting penalties per station." },
];

export default function AdvancedResultsDashboard({
  open,
  onClose,
  result: rawResult,
  simType,
  projectId,
  onApplyFix,
  onCaptureCanvasSnapshot,
}: {
  open: boolean;
  onClose: () => void;
  result: SimResult | null;
  simType: SimTypeId;
  projectId: string;
  onApplyFix?: (fix: OptimizerFix) => void;
  onCaptureCanvasSnapshot?: () => Promise<string | null>;
}) {
  const [tab, setTab] = useState<DashboardTab>("executive");
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const simConfig = SIM_TYPE_REGISTRY[simType] || SIM_TYPE_REGISTRY.human_queue;

  // Ensure result has all deep mathematical and journey enrichments
  const result = useMemo(() => {
    if (!rawResult) return null;
    return enrichSimResult(rawResult);
  }, [rawResult]);

  // Escape closes the suite (unless a nested dialog, e.g. station details, handled it first).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if ((e.target as HTMLElement | null)?.closest?.("input, textarea, select")) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!result) return null;

  const health = result.healthScore ?? 85;
  const healthTone = health >= 80 ? TONES.good : health >= 60 ? TONES.warn : TONES.bad;
  const activeTab = TABS.find((t) => t.id === tab)!;

  function handlePrintReport() {
    if (!result) return;
    const html = generateExecutiveHtmlReport(result, simConfig.label + " Simulation");
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  }

  async function handleDownloadPdf() {
    if (!result) return;
    setPdfGenerating(true);
    try {
      const snapshot = onCaptureCanvasSnapshot ? await onCaptureCanvasSnapshot() : null;
      const blob = await generateExecutivePdfReport(result, simConfig.label + " Simulation", snapshot);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${simConfig.label.replace(/\s+/g, "_")}_Executive_Report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF Generation Error:", err);
      toast.error("Couldn't build the PDF. Try the HTML report instead.", "PDF failed");
    } finally {
      setPdfGenerating(false);
    }
  }

  async function handleCsvExport() {
    // CSV export is Pro-only: show the server's reason instead of navigating to an error body.
    const res = await fetch(`/api/projects/${projectId}/export?format=csv`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Export failed", res.status === 402 ? "Pro feature" : "Export failed");
      return;
    }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] || "results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const ghostBtn =
    "flex h-9 items-center gap-1.5 rounded-xl border border-ln-ecebf7 bg-surface px-2.5 sm:px-3.5 text-[12.5px] font-bold text-slate-700 transition-colors hover:border-ln-d9d3fb hover:bg-sf-f8f7ff hover:text-fg-5742ff focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ln-5742ff/50";

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-sf-161622/45 p-0 backdrop-blur-sm dark:bg-black/60 sm:p-6"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="results-suite-title"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="flex h-full w-full max-w-[1440px] flex-col overflow-hidden border border-ln-e7e3ff bg-sf-f8f7ff shadow-[0_25px_70px_rgba(22,22,34,0.3)] sm:rounded-[28px]"
            >
              {/* ── Header ── */}
              <div className="flex h-[64px] shrink-0 items-center justify-between gap-3 border-b border-ln-ecebf7 bg-surface px-4 sm:px-6">
                <div className="min-w-0">
                  <h1 id="results-suite-title" className="truncate text-[16px] font-black leading-tight tracking-tight text-fg-161622 sm:text-[17px]">
                    Simulation Analytics
                  </h1>
                  <p className="flex min-w-0 items-center gap-1.5 truncate text-[12px] font-semibold leading-tight text-slate-600">
                    <span className="truncate">{simConfig.label}</span>
                    <span aria-hidden className="text-slate-300">•</span>
                    <span className="hidden tabular-nums sm:inline">{result.totalSimTime.toFixed(1)}s simulated</span>
                    <span aria-hidden className="hidden text-slate-300 sm:inline">•</span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[11px] font-extrabold" style={{ background: healthTone.tint, color: healthTone.text }}>
                      Health {health}/100
                    </span>
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={handleDownloadPdf}
                    disabled={pdfGenerating}
                    aria-label="Download PDF report"
                    title="Download the executive PDF report, including a snapshot of your canvas"
                    className="flex h-9 items-center gap-1.5 rounded-xl border border-ln-8d80ff bg-linear-to-b from-sf-6a57ff to-sf-5742ff px-2.5 text-[12.5px] font-bold text-white shadow-[0_6px_16px_-8px_rgba(87,66,255,.8)] transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ln-5742ff/50 focus-visible:ring-offset-2 disabled:opacity-60 sm:px-3.5"
                  >
                    {pdfGenerating ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                    <span className="hidden sm:inline">{pdfGenerating ? "Building PDF…" : "Download PDF"}</span>
                  </button>
                  <button onClick={handlePrintReport} aria-label="Open printable HTML report" title="Open a printable HTML report" className={ghostBtn}>
                    <Printer size={14} />
                    <span className="hidden md:inline">HTML Report</span>
                  </button>
                  <button onClick={handleCsvExport} aria-label="Export results as CSV" title="Export results as CSV (Pro)" className={ghostBtn}>
                    <Download size={14} />
                    <span className="hidden md:inline">CSV</span>
                  </button>
                  <button
                    onClick={onClose}
                    aria-label="Close analytics"
                    title="Close (Esc)"
                    className="ml-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-ln-ecebf7 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ln-5742ff/50"
                  >
                    <X size={17} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* ── Tabs + plain-English intro ── */}
              <div className="shrink-0 border-b border-ln-ecebf7 bg-surface/95 px-4 pt-2 pb-2.5 sm:px-6">
                <TabStrip tabs={TABS} value={tab} onChange={setTab} layoutId="results-suite-tabs" label="Analytics sections" className="-mx-1 px-1 pb-1" />
                <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] leading-snug text-slate-600">
                  <Info size={13} className="mt-0.5 shrink-0 text-fg-5742ff" aria-hidden />
                  <span>{activeTab.intro}</span>
                </p>
              </div>

              {/* ── Content ── */}
              <div className="custom-scrollbar flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6" {...tabPanelProps("results-suite-tabs", tab)}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                  >
                    {tab === "executive" && <ExecutiveTab result={result} simType={simType} onApplyFix={onApplyFix} />}
                    {tab === "analytics" && <DeepAnalyticsTab result={result} simType={simType} />}
                    {tab === "flow" && <FlowHeatmapTab result={result} simType={simType} />}
                    {tab === "timeline" && <TimelineTab result={result} />}
                    {tab === "blocks" && <BlocksTab result={result} />}
                    {tab === "entities" && <EntityTracerTab result={result} simType={simType} />}
                    {tab === "logs" && <LogsTab result={result} />}
                    {tab === "cost" && <CostRoiTab result={result} simType={simType} />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
