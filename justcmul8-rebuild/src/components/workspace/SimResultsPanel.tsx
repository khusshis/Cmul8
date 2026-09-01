"use client";
import React, { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { ChevronDown, ChevronUp, Activity, Users, Clock, AlertTriangle } from "lucide-react";
import type { SimResult } from "@/lib/simulation/types";
import type { SimTypeId } from "@/lib/simulation/types";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";

const THEME_COLORS = ["#2f6fed", "#8b5cf6", "#12a150", "#d9a400", "#ff6d5a", "#0ea5a5"];

interface SimResultsPanelProps {
  result: SimResult;
  simType: SimTypeId;
  onClose: () => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] shadow-md rounded p-2 text-xs">
      <p className="font-bold mb-1 text-[var(--color-text-primary)]">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-[var(--color-text-secondary)]">
          {p.name}: <span style={{ color: p.color || "#000" }}>{typeof p.value === "number" ? p.value.toFixed(2) : p.value}</span>
        </p>
      ))}
    </div>
  );
};

export default function SimResultsPanel({ result, simType, onClose }: SimResultsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const simConfig = SIM_TYPE_REGISTRY[simType];

  // Build chart data from nodeStats
  const statsEntries = Object.entries(result.nodeStats);
  
  // Utilization data (resources + services)
  const utilizationData = statsEntries
    .filter(([, s]) => s.nodeType === "resource" || s.nodeType === "service" || s.nodeType === "priority_resource")
    .map(([id, s]) => ({
      name: s.label.length > 12 ? s.label.substring(0, 12) + "…" : s.label,
      utilization: Math.round((s.utilization ?? 0) * 100),
      avgWait: parseFloat((s.avgWaitTime ?? 0).toFixed(2)),
      avgService: parseFloat((s.avgServiceTime ?? 0).toFixed(2)),
    }));

  // Queue depth data
  const queueData = statsEntries
    .filter(([, s]) => s.nodeType === "queue" || s.nodeType === "store")
    .map(([id, s]) => ({
      name: s.label.length > 12 ? s.label.substring(0, 12) + "…" : s.label,
      depth: s.currentDepth ?? 0,
      avgWait: parseFloat((s.avgWaitTime ?? 0).toFixed(2)),
      reneged: s.renegeCount ?? 0,
    }));

  // Pie data for utilization distribution
  const pieData = utilizationData.map((d, i) => ({ name: d.name, value: d.utilization }));

  const efficiencyRate = result.totalArrived > 0
    ? Math.round((result.totalCompleted / result.totalArrived) * 100)
    : 0;

  return (
    <div
      className="flex-shrink-0 border-t bg-[var(--color-surface)] border-[var(--color-border)]"
      style={{
        transition: "height 0.3s ease",
        height: collapsed ? "40px" : "260px",
        overflow: "hidden",
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center gap-3 px-4 h-10 cursor-pointer select-none"
        style={{ borderBottom: collapsed ? "none" : "1px solid var(--color-border)" }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <Activity size={16} className="text-[var(--color-info)]" />
        <span className="text-xs tracking-widest font-bold text-[var(--color-text-primary)] uppercase">
          SIMULATION RESULTS
        </span>
        <span className="text-[10px] text-[var(--color-text-secondary)] ml-1">
          {result.totalSimTime.toFixed(1)}s sim — {simConfig.entityName.toLowerCase()}s processed
        </span>
        <div className="flex-1" />
        {/* Summary KPIs inline */}
        {!collapsed && (
          <div className="flex items-center gap-4 mr-4">
            <KpiPill icon={<Users size={12} />} label="ARRIVED" value={result.totalArrived} color="var(--color-info)" />
            <KpiPill icon={<Users size={12} />} label="COMPLETED" value={result.totalCompleted} color="var(--color-success)" />
            <KpiPill icon={<Activity size={12} />} label="EFFICIENCY" value={`${efficiencyRate}%`} color="var(--color-warning)" />
            {result.bottleneckNodeId && (
              <KpiPill icon={<AlertTriangle size={12} />} label="BOTTLENECK" value={result.bottleneckLabel} color="var(--color-error)" />
            )}
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="text-xs px-2 py-0.5 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-sunken)]"
        >
          ✕
        </button>
        {collapsed ? <ChevronUp size={16} className="text-[var(--color-text-secondary)]" /> : <ChevronDown size={16} className="text-[var(--color-text-secondary)]" />}
      </div>

      {/* Charts Row */}
      {!collapsed && (
        <div className="flex gap-3 px-4 py-3 h-[calc(100%-40px)] overflow-x-auto bg-[var(--color-bg)]">
          
          {/* Utilization Bar Chart */}
          {utilizationData.length > 0 && (
            <ChartPanel title="RESOURCE UTILIZATION (%)" width={280}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={utilizationData} margin={{ top: 4, right: 8, bottom: 16, left: -10 }}>
                  <XAxis dataKey="name" tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="utilization" name="Utilization %" radius={[2, 2, 0, 0]}>
                    {utilizationData.map((_, i) => {
                      const util = utilizationData[i].utilization;
                      const color = util > 80 ? "var(--color-error)" : util > 50 ? "var(--color-warning)" : "var(--color-success)";
                      return <Cell key={i} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>
          )}

          {/* Avg Wait Time Bar */}
          {queueData.length > 0 && (
            <ChartPanel title={`AVG WAIT TIME (${simConfig.entityName}s)`} width={260}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={queueData} margin={{ top: 4, right: 8, bottom: 16, left: -10 }}>
                  <XAxis dataKey="name" tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }} />
                  <YAxis tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="avgWait" name="Avg Wait" fill="var(--color-warning)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>
          )}

          {/* Utilization Pie Chart */}
          {pieData.length > 0 && (
            <ChartPanel title="UTIL DISTRIBUTION" width={200}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={60}
                    dataKey="value"
                    nameKey="name"
                    paddingAngle={2}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={THEME_COLORS[i % THEME_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    iconSize={8}
                    wrapperStyle={{ fontSize: "10px", color: "var(--color-text-secondary)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartPanel>
          )}

          {/* Node Stats Table */}
          <ChartPanel title="BLOCK STATS" width={340} scrollable>
            <div style={{ overflowY: "auto", height: "100%" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem", textAlign: "left" }}>
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[var(--color-text-secondary)]">
                    <th className="font-bold py-1 px-2">Block</th>
                    <th className="font-bold py-1 px-2">Type</th>
                    <th className="font-bold py-1 px-2">In</th>
                    <th className="font-bold py-1 px-2">Out</th>
                    <th className="font-bold py-1 px-2">Util%</th>
                    <th className="font-bold py-1 px-2">Wait</th>
                  </tr>
                </thead>
                <tbody>
                  {statsEntries.map(([id, s]) => (
                    <tr
                      key={id}
                      className="border-b border-[var(--color-border)]"
                      style={{
                        background: result.bottleneckNodeId === id ? "var(--color-accent-soft)" : "transparent",
                      }}
                    >
                      <td className="py-1 px-2 font-medium" style={{ color: result.bottleneckNodeId === id ? "var(--color-error)" : "var(--color-text-primary)" }}>
                        {s.label.length > 14 ? s.label.substring(0, 14) + "…" : s.label}
                        {result.bottleneckNodeId === id && " 🔴"}
                      </td>
                      <td className="py-1 px-2 text-[var(--color-text-secondary)]">{s.nodeType}</td>
                      <td className="py-1 px-2 font-mono text-[var(--color-info)]">{s.entitiesIn}</td>
                      <td className="py-1 px-2 font-mono text-[var(--color-success)]">{s.entitiesOut}</td>
                      <td className="py-1 px-2 font-mono" style={{ color: s.utilization && s.utilization > 0.8 ? "var(--color-error)" : s.utilization && s.utilization > 0.5 ? "var(--color-warning)" : "var(--color-success)" }}>
                        {s.utilization !== undefined ? Math.round(s.utilization * 100) + "%" : "—"}
                      </td>
                      <td className="py-1 px-2 font-mono text-[var(--color-text-secondary)]">
                        {s.avgWaitTime ? s.avgWaitTime.toFixed(1) + "s" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartPanel>

        </div>
      )}
    </div>
  );
}

function KpiPill({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-control)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
      <span style={{ color }}>{icon}</span>
      <div>
        <div className="text-[10px] font-bold text-[var(--color-text-secondary)] leading-none">{label}</div>
        <div className="text-xs font-black mt-0.5 leading-none text-[var(--color-text-primary)]">{value}</div>
      </div>
    </div>
  );
}

function ChartPanel({ title, width, children, scrollable }: { title: string; width: number; children: React.ReactNode; scrollable?: boolean }) {
  return (
    <div
      className="flex flex-col flex-shrink-0 rounded-[var(--radius-card)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm"
      style={{
        width,
        height: "100%",
        overflow: "hidden",
      }}
    >
      <div className="px-3 py-2 border-b border-[var(--color-border)]">
        <span className="text-[10px] font-bold tracking-widest text-[var(--color-text-secondary)] uppercase">{title}</span>
      </div>
      <div style={{ flex: 1, padding: "8px 6px", overflow: scrollable ? "hidden" : "visible" }}>
        {children}
      </div>
    </div>
  );
}
