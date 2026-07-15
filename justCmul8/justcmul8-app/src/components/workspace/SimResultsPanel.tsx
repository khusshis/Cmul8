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

const NEON_COLORS = ["#00f2ff", "#ff00ff", "#10b981", "#fbbf24", "#f97316", "#7000ff"];

interface SimResultsPanelProps {
  result: SimResult;
  simType: SimTypeId;
  onClose: () => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(0,0,0,0.85)", border: "1px solid rgba(0,242,255,0.3)", borderRadius: 4, padding: "8px 12px" }}>
      <p style={{ color: "#00f2ff", fontFamily: "var(--font-mono)", fontSize: "0.7rem", marginBottom: 4 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || "#fff", fontFamily: "var(--font-mono)", fontSize: "0.7rem" }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
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
      className="flex-shrink-0 border-t"
      style={{
        borderColor: "rgba(0,242,255,0.15)",
        background: "var(--bg-secondary)",
        transition: "height 0.3s ease",
        height: collapsed ? "40px" : "260px",
        overflow: "hidden",
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center gap-3 px-4 h-10 cursor-pointer select-none"
        style={{ borderBottom: collapsed ? "none" : "1px solid rgba(0,242,255,0.08)" }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <Activity size={12} style={{ color: "var(--neon-cyan)" }} />
        <span className="text-xs tracking-widest font-bold" style={{ fontFamily: "var(--font-mono)", color: "var(--neon-cyan)" }}>
          SIMULATION RESULTS
        </span>
        <span className="text-[10px]" style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginLeft: 4 }}>
          {result.totalSimTime.toFixed(1)}s sim — {simConfig.entityName.toLowerCase()}s processed
        </span>
        <div className="flex-1" />
        {/* Summary KPIs inline */}
        {!collapsed && (
          <div className="flex items-center gap-4 mr-4">
            <KpiPill icon={<Users size={10} />} label="ARRIVED" value={result.totalArrived} color="var(--neon-cyan)" />
            <KpiPill icon={<Users size={10} />} label="COMPLETED" value={result.totalCompleted} color="var(--neon-green)" />
            <KpiPill icon={<Activity size={10} />} label="EFFICIENCY" value={`${efficiencyRate}%`} color="var(--neon-yellow)" />
            {result.bottleneckNodeId && (
              <KpiPill icon={<AlertTriangle size={10} />} label="BOTTLENECK" value={result.bottleneckLabel} color="var(--neon-red)" />
            )}
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="text-xs px-2 py-0.5 rounded"
          style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "0.6rem" }}
        >
          ✕
        </button>
        {collapsed ? <ChevronUp size={14} style={{ color: "var(--text-muted)"}} /> : <ChevronDown size={14} style={{ color: "var(--text-muted)"}} />}
      </div>

      {/* Charts Row */}
      {!collapsed && (
        <div className="flex gap-3 px-4 py-3 h-[calc(100%-40px)] overflow-x-auto">
          
          {/* Utilization Bar Chart */}
          {utilizationData.length > 0 && (
            <ChartPanel title="RESOURCE UTILIZATION (%)" width={280}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={utilizationData} margin={{ top: 4, right: 8, bottom: 16, left: -10 }}>
                  <XAxis dataKey="name" tick={{ fill: "#4b5563", fontSize: 9, fontFamily: "monospace" }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#4b5563", fontSize: 9, fontFamily: "monospace" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="utilization" name="Utilization %" radius={[2, 2, 0, 0]}>
                    {utilizationData.map((_, i) => {
                      const util = utilizationData[i].utilization;
                      const color = util > 80 ? "#ef4444" : util > 50 ? "#fbbf24" : "#10b981";
                      return <Cell key={i} fill={color} fillOpacity={0.85} />;
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
                  <XAxis dataKey="name" tick={{ fill: "#4b5563", fontSize: 9, fontFamily: "monospace" }} />
                  <YAxis tick={{ fill: "#4b5563", fontSize: 9, fontFamily: "monospace" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="avgWait" name="Avg Wait" fill="#fbbf24" fillOpacity={0.85} radius={[2, 2, 0, 0]} />
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
                      <Cell key={i} fill={NEON_COLORS[i % NEON_COLORS.length]} fillOpacity={0.8} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    iconSize={8}
                    wrapperStyle={{ fontSize: "9px", fontFamily: "monospace", color: "#6b7280" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartPanel>
          )}

          {/* Node Stats Table */}
          <ChartPanel title="NODE STATS" width={340} scrollable>
            <div style={{ overflowY: "auto", height: "100%" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.65rem", fontFamily: "var(--font-mono)" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(0,242,255,0.1)" }}>
                    {["Node", "Type", "In", "Out", "Util%", "Wait"].map((h) => (
                      <th key={h} style={{ color: "var(--neon-cyan)", textAlign: "left", padding: "2px 6px", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {statsEntries.map(([id, s]) => (
                    <tr
                      key={id}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.03)",
                        background: result.bottleneckNodeId === id ? "rgba(239,68,68,0.08)" : "transparent",
                      }}
                    >
                      <td style={{ padding: "2px 6px", color: result.bottleneckNodeId === id ? "#ef4444" : "#fff" }}>
                        {s.label.length > 14 ? s.label.substring(0, 14) + "…" : s.label}
                        {result.bottleneckNodeId === id && " 🔴"}
                      </td>
                      <td style={{ padding: "2px 6px", color: "var(--text-muted)" }}>{s.nodeType}</td>
                      <td style={{ padding: "2px 6px", color: "var(--neon-cyan)" }}>{s.entitiesIn}</td>
                      <td style={{ padding: "2px 6px", color: "var(--neon-green)" }}>{s.entitiesOut}</td>
                      <td style={{ padding: "2px 6px", color: s.utilization && s.utilization > 0.8 ? "#ef4444" : s.utilization && s.utilization > 0.5 ? "#fbbf24" : "#10b981" }}>
                        {s.utilization !== undefined ? Math.round(s.utilization * 100) + "%" : "—"}
                      </td>
                      <td style={{ padding: "2px 6px", color: "var(--text-muted)" }}>
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
    <div className="flex items-center gap-1.5 px-3 py-1 rounded" style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${color}30` }}>
      <span style={{ color }}>{icon}</span>
      <div>
        <div style={{ color: "var(--text-muted)", fontSize: "0.55rem", fontFamily: "var(--font-mono)", lineHeight: 1 }}>{label}</div>
        <div style={{ color, fontSize: "0.7rem", fontFamily: "var(--font-mono)", fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
      </div>
    </div>
  );
}

function ChartPanel({ title, width, children, scrollable }: { title: string; width: number; children: React.ReactNode; scrollable?: boolean }) {
  return (
    <div
      className="flex flex-col flex-shrink-0 rounded"
      style={{
        width,
        height: "100%",
        background: "rgba(0,0,0,0.3)",
        border: "1px solid rgba(0,242,255,0.08)",
        overflow: "hidden",
      }}
    >
      <div className="px-3 py-1.5" style={{ borderBottom: "1px solid rgba(0,242,255,0.06)" }}>
        <span style={{ color: "var(--text-muted)", fontSize: "0.6rem", fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>{title}</span>
      </div>
      <div style={{ flex: 1, padding: "6px 4px", overflow: scrollable ? "hidden" : "visible" }}>
        {children}
      </div>
    </div>
  );
}
