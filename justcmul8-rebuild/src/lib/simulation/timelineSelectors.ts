import type { SimResult } from "./types";

export interface ThroughputPoint {
  simTime: number;
  completed: number;
  completedPerMin: number;
}

export function buildThroughputSeries(result: SimResult): ThroughputPoint[] {
  const { timeline } = result;
  return timeline.map((point, i) => {
    const prev = timeline[i - 1];
    const dt = prev ? point.simTime - prev.simTime : point.simTime;
    const dCompleted = prev ? point.completed - prev.completed : point.completed;
    return {
      simTime: Math.round(point.simTime),
      completed: point.completed,
      completedPerMin: dt > 0 ? parseFloat(((dCompleted / dt) * 60).toFixed(2)) : 0,
    };
  });
}

export interface DepthSeriesPoint {
  simTime: number;
  [nodeLabel: string]: number;
}

/**
 * How many are WAITING at each block over time. A queue/store's depth is all waiting; a server's
 * depth includes those being served, so its capacity is taken off. Blocks where nobody waits
 * (service delays, tanks, channels, sources, sinks, routers) are left out.
 */
export function buildDepthSeries(result: SimResult): { series: DepthSeriesPoint[]; nodeLabels: string[] } {
  const waiting: Record<string, { label: string; inService: number }> = {};
  for (const [id, stat] of Object.entries(result.nodeStats)) {
    if (stat.nodeType === "queue" || stat.nodeType === "store") waiting[id] = { label: stat.label, inService: 0 };
    else if (stat.nodeType === "resource" || stat.nodeType === "priority_resource") waiting[id] = { label: stat.label, inService: Math.max(1, stat.capacity ?? 1) };
  }
  const nodeLabelSet = new Set<string>();
  const series: DepthSeriesPoint[] = result.timeline.map((point) => {
    const row: DepthSeriesPoint = { simTime: Math.round(point.simTime) };
    for (const [nodeId, depth] of Object.entries(point.depth)) {
      const w = waiting[nodeId];
      if (!w) continue;
      nodeLabelSet.add(w.label);
      row[w.label] = Math.max(0, depth - w.inService);
    }
    return row;
  });
  return { series, nodeLabels: Array.from(nodeLabelSet) };
}
