import type { KpiMetricDef } from "./simTypeRegistry";
import type { SimResult, NodeStats } from "./types";

export interface ResolvedKpi {
  key: string;
  label: string;
  unit: string;
  chartType: KpiMetricDef["chartType"];
  value: number | null;
  displayValue: string;
  series?: { name: string; value: number }[]; // for bar/line/pie, one entry per matching node
}

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

      if (m.unit.includes("/hr") || m.unit.includes("/hour")) {
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
    const allNodeStats = Object.entries(result.nodeStats ?? {});
    const filteredStats = allNodeStats.filter(([, stats]) => {
      if (!m.nodeTypes || m.nodeTypes.length === 0) return true;
      const nType = (stats as NodeStats).nodeType;
      return m.nodeTypes.includes(nType);
    });

    const series = filteredStats.map(([nodeId, stats]) => {
      const s = stats as NodeStats;
      let val = Number(s[m.key as keyof NodeStats] ?? 0);
      if (m.key === "utilization") {
        // If utilization is a 0-1 fraction, convert to percentage for chart display
        val = Math.round(val * 100);
      }
      return {
        name: s.label || nodeId,
        value: isNaN(val) ? 0 : parseFloat(val.toFixed(2)),
      };
    });

    let avg: number | null = null;
    let displayValue = "N/A";

    if (series.length > 0) {
      if (m.key === "droppedCount" || m.key === "lateCount" || m.key === "renegeCount") {
        // Sum total for error/dropped counts
        const total = series.reduce((sum, item) => sum + item.value, 0);
        avg = total;
        displayValue = `${total} ${m.unit}`;
      } else {
        const sum = series.reduce((acc, item) => acc + item.value, 0);
        avg = sum / series.length;
        if (m.key === "utilization" || m.unit === "%") {
          displayValue = `${Math.round(avg)}%`;
        } else if (m.unit === "ms" || m.unit === "s" || m.unit === "min") {
          displayValue = `${avg.toFixed(1)} ${m.unit}`;
        } else {
          displayValue = `${avg.toFixed(1)} ${m.unit}`;
        }
      }
    } else if (allNodeStats.length > 0) {
      // If node filter yielded 0 nodes (e.g. flow has no matching node type), fallback to overall node average
      displayValue = `0 ${m.unit}`;
      avg = 0;
    }

    return {
      key: String(m.key),
      label: m.label,
      unit: m.unit,
      chartType: m.chartType,
      value: avg,
      displayValue,
      series: series.length > 0 ? series : undefined,
    };
  });
}
