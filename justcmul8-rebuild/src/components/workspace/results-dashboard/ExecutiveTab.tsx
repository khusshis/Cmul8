"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Users,
  CheckCircle2,
  Gauge,
  AlertTriangle,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  Clock,
  UserMinus,
  Factory,
  Timer,
  Boxes,
  Car,
  Zap,
  Radio,
  Activity,
  Check,
} from "lucide-react";
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import type { SimResult, SimTypeId, DomainMetricCard } from "@/lib/simulation/types";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import { useCountUp } from "@/lib/hooks/useCountUp";

const ICON_MAP: Record<string, any> = {
  Clock,
  UserMinus,
  Activity,
  Factory,
  Timer,
  Boxes,
  Car,
  TrendingUp,
  Zap,
  Radio,
};

function HeroStatCard({
  icon: Icon,
  label,
  value,
  decimals = 0,
  suffix = "",
  subtext,
  color,
  delay,
}: {
  icon: any;
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  subtext?: string;
  color: string;
  delay: number;
}) {
  const animated = useCountUp(value, 900, decimals);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
      className="rounded-[20px] bg-white border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-5 flex flex-col justify-between relative overflow-hidden group hover:border-indigo-200 hover:shadow-[0_12px_28px_-6px_rgba(87,66,255,0.12)] transition-all"
    >
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
          style={{ background: `${color}15`, color }}
        >
          <Icon size={20} strokeWidth={2.3} />
        </div>
        <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-gray-400">
          KEY NUMBER
        </span>
      </div>

      <div className="mt-4">
        <div className="text-[28px] font-black text-gray-900 leading-none tabular-nums tracking-tight">
          {animated}
          {suffix}
        </div>
        <div className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mt-1.5">
          {label}
        </div>
        {subtext && (
          <div className="text-[11px] font-medium text-gray-400 mt-1">{subtext}</div>
        )}
      </div>
    </motion.div>
  );
}

export default function ExecutiveTab({
  result,
  simType,
}: {
  result: SimResult;
  simType: SimTypeId;
  }) {
  const simConfig = SIM_TYPE_REGISTRY[simType];
  const efficiencyRate =
    result.totalArrived > 0
      ? Math.round((result.totalCompleted / result.totalArrived) * 100)
      : 100;

  const healthScore = result.healthScore ?? 85;
  const aiDiagnosis = result.aiDiagnosis;
  const domainMetrics = result.domainMetrics || [];
  const bottleneck = result.bottleneckNodeId ? result.nodeStats[result.bottleneckNodeId] : null;

  return (
    <div className="space-y-6">
      {/* ── Top Row: Health Scorecard & AI Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* System Health Scorecard (4 cols) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }}
          className="lg:col-span-4 rounded-[24px] bg-gradient-to-br from-white to-[#F9F8FF] border border-indigo-100/80 shadow-[0_8px_30px_-6px_rgba(87,66,255,0.08)] p-6 flex flex-col justify-between relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#5742FF]">
              System Health Score
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                healthScore >= 80
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200/60"
                  : healthScore >= 60
                  ? "bg-amber-50 text-amber-600 border border-amber-200/60"
                  : "bg-red-50 text-red-600 border border-red-200/60"
              }`}
            >
              {healthScore >= 80 ? "Running Great" : healthScore >= 60 ? "Needs Attention" : "Heavy Congestion"}
            </span>
          </div>

          <div className="flex items-center justify-center my-4 relative">
            <div className="w-36 h-36 relative">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="75%"
                  outerRadius="100%"
                  data={[{ value: healthScore }]}
                  startAngle={90}
                  endAngle={-270}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar
                    dataKey="value"
                    fill={healthScore >= 80 ? "#10B981" : healthScore >= 60 ? "#F59E0B" : "#EF4444"}
                    cornerRadius={10}
                    background={{ fill: "#ECEBFA" }}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[32px] font-black text-gray-900 leading-none">
                  {healthScore}
                </span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                  / 100
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-indigo-50 text-[12px] text-gray-600">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Check size={13} className="text-emerald-500" /> Completion Rate
              </span>
              <span className="font-bold text-gray-900">{efficiencyRate}% Finished</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Check size={13} className="text-indigo-500" /> Flow Balance
              </span>
              <span className="font-bold text-gray-900">
                {result.littlesLaw?.isStable ? "Smooth Flow" : "Traffic Jam Forming"}
              </span>
            </div>
          </div>
        </motion.div>

        {/* AI Summary & Slowest Choke Point (8 cols) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="lg:col-span-8 rounded-[24px] bg-white border border-gray-100 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.06)] p-6 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-50 text-[#5742FF] flex items-center justify-center">
                <Sparkles size={14} />
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#5742FF]">
                AI Performance Summary & Choke Points
              </span>
            </div>
            <h2 className="text-[20px] font-extrabold text-gray-900 tracking-tight mb-2">
              {aiDiagnosis?.title || "System Performance Overview"}
            </h2>
            <p className="text-[13.5px] text-gray-600 leading-relaxed">
              {aiDiagnosis?.summary ||
                `Simulation ran for ${result.totalSimTime.toFixed(1)}s across ${
                  Object.keys(result.nodeStats).length
                } stations.`}
            </p>
          </div>

          {/* Bottleneck Spotlight Box */}
          <div
            className={`mt-4 p-4 rounded-xl border flex items-start gap-3.5 ${
              bottleneck
                ? "bg-amber-50/60 border-amber-200/80 text-amber-950"
                : "bg-emerald-50/60 border-emerald-200/80 text-emerald-950"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                bottleneck ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
              }`}
            >
              <AlertTriangle size={17} />
            </div>
            <div className="text-[12.5px] leading-relaxed">
              <span className="font-extrabold block text-[13px] mb-0.5">
                {bottleneck ? `Slowest Choke Point (Biggest Delay): "${bottleneck.label}"` : "Even Flow Across All Stations"}
              </span>
              <p className="text-gray-700">
                {aiDiagnosis?.bottleneckCause ||
                  (bottleneck
                    ? `Working at ${Math.round(
                        (bottleneck.utilization ?? 0) * 100
                      )}% capacity with ${bottleneck.avgWaitTime.toFixed(1)}s average wait time.`
                    : "Work is moving smoothly with no big lines forming.")}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Middle Row: 4 Core Headline KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <HeroStatCard
          icon={Users}
          label={`${simConfig.entityName}s Arrived`}
          value={result.totalArrived}
          color="#3B82F6"
          delay={0.1}
          subtext={`Arrival speed: ${(result.totalArrived / Math.max(1, result.totalSimTime)).toFixed(2)} /s`}
        />
        <HeroStatCard
          icon={CheckCircle2}
          label={`${simConfig.entityName}s Finished`}
          value={result.totalCompleted}
          color="#10B981"
          delay={0.15}
          subtext={`Output speed: ${(result.totalCompleted / Math.max(1, result.totalSimTime)).toFixed(2)} /s`}
        />
        <HeroStatCard
          icon={Gauge}
          label="Completion Rate"
          value={efficiencyRate}
          suffix="%"
          color="#8B5CF6"
          delay={0.2}
          subtext={`${result.totalArrived - result.totalCompleted} still in system`}
        />
        <HeroStatCard
          icon={Clock}
          label="Typical Wait Time (p50)"
          value={result.waitTimePercentiles?.p50 ?? 0}
          decimals={1}
          suffix="s"
          color="#F59E0B"
          delay={0.25}
          subtext={`Worst-case wait (p95): ${(result.waitTimePercentiles?.p95 ?? 0).toFixed(1)}s`}
        />
      </div>

      {/* ── Bottom Row: Domain Operations Tiles + Top Optimizations ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Domain-Specific Operations Cards (6 cols) */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500">
              Specific Performance Metrics: {simConfig.label}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {domainMetrics.map((dm) => {
              const IconComp = ICON_MAP[dm.iconName] || Activity;
              return (
                <div
                  key={dm.id}
                  className="rounded-2xl bg-white border border-gray-100 p-4 flex flex-col justify-between shadow-sm hover:border-indigo-100 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#5742FF] flex items-center justify-center">
                      <IconComp size={16} />
                    </div>
                    <span
                      className={`text-[9.5px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        dm.status === "optimal"
                          ? "bg-emerald-50 text-emerald-600"
                          : dm.status === "warning"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      {dm.status === "optimal" ? "Good" : dm.status === "warning" ? "Notice" : "High Delay"}
                    </span>
                  </div>
                  <div>
                    <div className="text-[20px] font-black text-gray-900 leading-tight">
                      {dm.value}
                    </div>
                    <div className="text-[11px] font-bold text-gray-700 mt-0.5 line-clamp-1">
                      {dm.label}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">{dm.benchmark}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Actionable Optimizations (6 cols) */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#5742FF]">
              Smart Recommendations to Speed Up Flow
            </span>
          </div>

          <div className="space-y-2.5">
            {aiDiagnosis?.recommendations?.map((rec, i) => (
              <div
                key={i}
                className="rounded-2xl bg-white border border-gray-100 p-4 flex items-start gap-3.5 shadow-sm hover:border-indigo-200 transition-all group"
              >
                <div className="w-7 h-7 rounded-lg bg-[#F5F3FF] text-[#5742FF] font-black text-[12px] flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[13px] font-extrabold text-gray-900 group-hover:text-[#5742FF] transition-colors">
                      {rec.title}
                    </h4>
                    <span className="text-[10.5px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                      {rec.confidence}% recommended
                    </span>
                  </div>
                  <p className="text-[12px] text-gray-600 mt-1">{rec.action}</p>
                  <p className="text-[11px] font-medium text-indigo-600 mt-1">
                    Expected Benefit: {rec.impact}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
