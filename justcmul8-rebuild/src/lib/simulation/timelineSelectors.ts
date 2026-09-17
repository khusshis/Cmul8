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

export function buildDepthSeries(result: SimResult): { series: DepthSeriesPoint[]; nodeLabels: string[] } {
  const labelByNodeId: Record<string, string> = {};
  for (const [id, stat] of Object.entries(result.nodeStats)) {
    labelByNodeId[id] = stat.label;
  }
  const nodeLabelSet = new Set<string>();
  const series: DepthSeriesPoint[] = result.timeline.map((point) => {
    const row: DepthSeriesPoint = { simTime: Math.round(point.simTime) };
    for (const [nodeId, depth] of Object.entries(point.depth)) {
      const label = labelByNodeId[nodeId] || nodeId;
      nodeLabelSet.add(label);
      row[label] = depth;
    }
    return row;
  });
  return { series, nodeLabels: Array.from(nodeLabelSet) };
}
