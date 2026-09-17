import type { SimResult } from "./types";

export interface SimulationRunInsert {
  project_id: string;
  user_id: string;
  duration_seconds: number;
  sim_time_seconds: number;
  total_arrived: number;
  total_completed: number;
  bottleneck_node: string | null;
  result_json: SimResult;
  logs_json: SimResult["logs"];
}

export function toSimulationRunRow(
  projectId: string,
  userId: string,
  result: SimResult,
  durationSeconds: number
): SimulationRunInsert {
  return {
    project_id: projectId,
    user_id: userId,
    duration_seconds: Math.round(durationSeconds),
    sim_time_seconds: result.totalSimTime,
    total_arrived: result.totalArrived,
    total_completed: result.totalCompleted,
    bottleneck_node: result.bottleneckNodeId || null,
    result_json: result,
    logs_json: result.logs,
  };
}
