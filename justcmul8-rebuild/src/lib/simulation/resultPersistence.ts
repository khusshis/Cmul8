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
    // U-7: store a summary, not the whole enriched object. `entityJourneys` and
    // `topSlowestEntities` are reconstructable from `logs_json` via
    // reconstructEntityJourneys(), and `logs` would otherwise be persisted twice —
    // once inside result_json and once as logs_json. On a long run that is several
    // MB per insert. Rehydrate with:
    //   enrichSimResult({ ...row.result_json, logs: row.logs_json })
    result_json: stripReconstructable(result),
    logs_json: result.logs,
  };
}

/**
 * Removes the fields that can be rebuilt from the raw log stream, so a persisted
 * run stays small. Everything the CSV export and the results panels read directly
 * (nodeStats, timeline, percentiles, littlesLaw, healthScore, aiDiagnosis, …) is
 * retained.
 */
function stripReconstructable(result: SimResult): SimResult {
  const { entityJourneys, topSlowestEntities, logs, ...summary } = result;
  void entityJourneys;
  void topSlowestEntities;
  void logs;
  return summary as SimResult;
}
