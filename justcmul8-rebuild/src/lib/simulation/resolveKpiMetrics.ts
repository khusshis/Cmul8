import type { KpiMetricDef } from "./simTypeRegistry";
import type { SimResult, NodeStats } from "./types";
import { isServerNode } from "./analyticsEngine";

export interface ResolvedKpi {
  key: string;
  label: string;
  unit: string;
  chartType: KpiMetricDef["chartType"];
  value: number | null;
  displayValue: string;
  series?: { name: string; value: number }[]; // for bar/line/pie, one entry per matching node
  /** What the headline averages over, when that differs from a customer's whole trip. */
  scope?: string;
}

// Counts that add up across blocks (total in line, total dropped), rather than averaging.
const SUMMED = new Set(["droppedCount", "lateCount", "renegeCount", "currentDepth"]);

export function resolveKpiMetrics(
  metrics: KpiMetricDef[],
  result: SimResult
): ResolvedKpi[] {
  if (!metrics || !Array.isArray(metrics)) return [];

  const durationHours = Math.max(1, result.totalSimTime || 0) / 3600;
  const durationSecs = Math.max(1, result.totalSimTime || 0);

  return metrics.map((m) => {
    if (m.key === "totalArrived") {
      const val = result.totalArrived ?? 0;
      return {
        key: m.key,
        label: m.label,
        unit: m.unit,
        chartType: m.chartType,
        value: val,
        displayValue: val.toLocaleString(),
      };
    }

    if (m.key === "totalCompleted") {
      let val = result.totalCompleted ?? 0;
      let displayValue = val.toLocaleString();

      // "Vehicles / hour" carries the rate in its label (unit "veh"), so check both.
      if (/\/\s*h(ou)?r/i.test(`${m.label} ${m.unit}`)) {
        const hourly = durationHours > 0 ? (val / durationHours) : val;
        displayValue = `${Math.round(hourly).toLocaleString()} ${m.unit}`;
        val = hourly;
      } else if (m.unit.includes("/sec")) {
        const perSec = durationSecs > 0 ? (val / durationSecs) : val;
        displayValue = `${perSec.toFixed(2)} ${m.unit}`;
        val = perSec;
      }

      return {
        key: m.key,
        label: m.label,
        unit: m.unit,
        chartType: m.chartType,
        value: val,
        displayValue,
      };
    }

    if (m.key === "bottleneck") {
      const bottleneckNode = result.bottleneckNodeId ? result.nodeStats?.[result.bottleneckNodeId] : null;
      return {
        key: m.key,
        label: m.label,
        unit: m.unit,
        chartType: m.chartType,
        value: bottleneckNode ? (bottleneckNode.utilization ?? 0) * 100 : null,
        displayValue: bottleneckNode ? bottleneckNode.label : "None",
        series: undefined,
      };
    }

    // Node-level stat lookup
    const allNodeStats = Object.values(result.nodeStats ?? {}) as NodeStats[];
    let nodes = allNodeStats.filter((s) => !m.nodeTypes || m.nodeTypes.length === 0 || m.nodeTypes.includes(s.nodeType));
    // Waiting can happen in front of a server with no separate Queue block (the server keeps its own line).
    // Without this, a flow with no Queue block showed "0 min" wait and "0 people" in line.
    const viaServers = nodes.length === 0 && (m.key === "avgWaitTime" || m.key === "currentDepth");
    if (viaServers) nodes = allNodeStats.filter(isServerNode);

    const raw = (s: NodeStats) => {
      // A server's depth is in service + waiting; only the waiting part is a queue.
      if (viaServers && m.key === "currentDepth") return Math.max(0, (s.currentDepth ?? 0) - Math.max(1, s.capacity ?? 1));
      return Number(s[m.key as keyof NodeStats] ?? 0);
    };
    // How much each block counts in the headline average: averages by the entities behind them,
    // utilization by number of servers, everything else equally.
    const weight = (s: NodeStats) =>
      m.key === "avgWaitTime" || m.key === "avgServiceTime" || m.key === "avgLatency"
        ? Math.max(0, s.entitiesOut ?? 0)
        : m.key === "utilization" && isServerNode(s)
        ? Math.max(1, s.capacity ?? 1)
        : 1;

    // Averages only count blocks that recorded samples (a sink has no latency, an idle server no service time).
    // If no block reports a finished count to weight by, every recorded block counts equally.
    const isAvgMetric = String(m.key).startsWith("avg");
    const recorded = isAvgMetric ? nodes.filter((s) => s[m.key as keyof NodeStats] != null) : nodes;
    const weighted = recorded.filter((s) => weight(s) > 0);
    const contributing = isAvgMetric && weighted.length > 0 ? weighted : recorded;

    const toUnit = (v: number) => {
      // The engine measures durations in seconds; convert to the unit the KPI is labelled with.
      if (m.key === "avgWaitTime" || m.key === "avgServiceTime" || m.key === "avgLatency") {
        if (m.unit === "min") return v / 60;
        if (m.unit === "hr" || m.unit === "hrs") return v / 3600;
        if (m.unit === "ms") return v * 1000;
      }
      if (m.key === "utilization") return v * 100;
      return v;
    };

    const series = contributing.map((s) => {
      const val = toUnit(raw(s));
      return { name: s.label || s.nodeId, value: isNaN(val) ? 0 : parseFloat(val.toFixed(2)) };
    });

    let value: number | null = null;
    let displayValue = "N/A";

    if (contributing.length > 0) {
      if (SUMMED.has(String(m.key))) {
        value = contributing.reduce((sum, s) => sum + raw(s), 0);
      } else {
        const w = contributing.reduce((sum, s) => sum + weight(s), 0);
        value = toUnit(
          w > 0
            ? contributing.reduce((sum, s) => sum + raw(s) * weight(s), 0) / w
            : contributing.reduce((sum, s) => sum + raw(s), 0) / contributing.length
        );
      }
      displayValue =
        m.key === "utilization" || m.unit === "%"
          ? `${Math.round(value)}%`
          : `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${m.unit}`;
    }

    return {
      key: String(m.key),
      label: m.label,
      unit: m.unit,
      chartType: m.chartType,
      value,
      displayValue,
      series: series.length > 0 ? series : undefined,
      // A trip can pass several stations, so this is shorter than the per-customer wait cards.
      scope: m.key === "avgWaitTime" || m.key === "avgServiceTime" ? "Per station visit" : undefined,
    };
  });
}
