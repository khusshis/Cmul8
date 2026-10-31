/**
 * The AI optimizer: turns a finished run into telemetry, asks the model for recommendations and
 * sanitises them. SERVER ONLY (uses the model router). The /api/ai/optimize route adds auth and
 * credits around it; tests call it directly.
 */
import { generateJSON, extractJSON } from "@/lib/ai/modelRouter";
import type { SimResult, SimTypeId } from "@/lib/simulation/types";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import { hasUtilization, isServerNode } from "@/lib/simulation/analyticsEngine";
import { UNTRUSTED_DATA_RULES, fenceUntrusted } from "@/lib/ai/systemPrompt";

export interface OptimizerFix {
  nodeId: string;
  paramPatch: Record<string, number | string | boolean>;
  description: string; // e.g. "Increase capacity from 1 to 2"
}

export interface OptimizerRecommendation {
  title: string;
  action: string;
  impact: string;
  confidence: number;
  fix?: OptimizerFix;
}

/** The model answered, but not with usable recommendations. */
export class OptimizerResponseError extends Error {}

const PATCH_LIMITS: Record<string, [number, number]> = {
  capacity: [1, 10_000],
  serviceTimeMean: [0.0001, 1e7],
  durationMean: [0.0001, 1e7],
  arrivalRate: [0.0001, 1e6],
  fillRate: [0.0001, 1e7],
};
const clip = (v: unknown, fallback: string, max: number) =>
  (typeof v === "string" && v.trim() ? v.trim() : fallback).slice(0, max);
const r1 = (v: number | undefined) => Math.round((v || 0) * 10) / 10;

/** Concise run summary for the model (no log blobs). Everything a capacity decision needs. */
export function buildOptimizerTelemetry(result: SimResult, simType: SimTypeId) {
  const config = Object.hasOwn(SIM_TYPE_REGISTRY, simType) ? SIM_TYPE_REGISTRY[simType] : SIM_TYPE_REGISTRY.human_queue;
  const bottleneck = result.bottleneckNodeId ? result.nodeStats[result.bottleneckNodeId] : null;
  return {
    domain: config.label,
    entityName: config.entityName,
    totalSimTimeSeconds: result.totalSimTime,
    totalArrived: result.totalArrived,
    totalCompleted: result.totalCompleted,
    completionRatePct: result.totalArrived > 0 ? Math.round((result.totalCompleted / result.totalArrived) * 100) : 0,
    healthScore: result.healthScore,
    bottleneckNodeId: bottleneck ? result.bottleneckNodeId : null,
    allNodes: Object.entries(result.nodeStats || {}).map(([id, s]) => ({
      id,
      label: s.label,
      nodeType: s.nodeType,
      // Servers: parallel servers now. A capacity fix sets the NEW TOTAL for this block.
      capacity: isServerNode(s) ? Math.max(1, s.capacity ?? 1) : undefined,
      // How many servers' worth of work it actually did (utilization x capacity). Near capacity = saturated.
      busyServers: isServerNode(s) ? r1((s.utilization || 0) * Math.max(1, s.capacity ?? 1)) : undefined,
      isBottleneck: id === result.bottleneckNodeId || undefined,
      // Servers behind the same queue share one line: size them together.
      sharesLineFromQueue: s.fedBy,
      utilizationPct: hasUtilization(s) ? Math.round((s.utilization || 0) * 100) : undefined,
      entitiesIn: s.entitiesIn,
      entitiesOut: s.entitiesOut,
      stillInsideAtEnd: s.currentDepth,
      avgWaitSeconds: r1(s.avgWaitTime),
      avgServiceSeconds: s.avgServiceTime > 0 ? r1(s.avgServiceTime) : undefined,
      turnedAway: s.droppedCount || undefined,
      gaveUpWaiting: s.renegeCount || undefined,
    })),
    littlesLawStable: result.littlesLaw?.isStable,
    medianWaitSeconds: result.waitTimePercentiles?.p50,
    p95WaitSeconds: result.waitTimePercentiles?.p95,
  };
}

const SYSTEM_INSTRUCTION = `You are a discrete-event-simulation optimization engine for JustCmul8.
Given telemetry from a completed simulation run, diagnose system choke points and propose 1-3 concrete, actionable recommendations.
Where possible, attach a mechanically applicable "fix" object specifying the exact node ID and parameter change.

Respond with STRICT JSON matching this schema:
{
  "recommendations": [
    {
      "title": "string, short concise title <= 60 chars",
      "action": "string, clear operational action explanation",
      "impact": "string, expected quantitative improvement e.g. 'Cuts wait time by 45%'",
      "confidence": number (0-100),
      "fix": {
        "nodeId": "string, must match a valid nodeId from allNodes",
        "paramPatch": {
          "capacity": number (optional, for resource or queue),
          "serviceTimeMean": number (optional, for resource),
          "durationMean": number (optional, for service),
          "arrivalRate": number (optional, for source)
        },
        "description": "string, e.g. 'Increase Staff Capacity to 2'"
      }
    }
  ]
}

Rules:
1. Only attach a "fix" object if you can identify a specific node and valid numeric parameter to optimize.
2. Valid paramPatch keys: 'capacity' (>=1), 'serviceTimeMean' (>0), 'durationMean' (>0), 'arrivalRate' (>0).
3. A capacity patch is the NEW TOTAL for that block and must be larger than its current "capacity" when adding staff.
4. Size capacity from demand: servers needed ~= (arrivals per second x avgServiceSeconds) / 0.8. Servers that share a line
   from the same queue form one pool; arrivals to that queue are the pool's demand.
5. Blocks without a capacity (service delays, tanks, routers) cannot take a capacity fix.
6. Fix the bottleneck first. Only add capacity where utilizationPct >= 85, or where people are turned away or give up
   because of the wait there. Adding capacity upstream of a saturated station does not help: it only sends work into
   the bottleneck faster. Never recommend more staff for a station under ~80% busy.
7. Make impact claims consistent with the numbers: don't promise to eliminate turn-aways or walk-outs that happen elsewhere.
8. Be direct, precise, and practical for real-world operations.

${UNTRUSTED_DATA_RULES}`;

/** Asks the model for recommendations on this run. Throws AIRouterError (model unavailable) or OptimizerResponseError. */
export async function optimizeRecommendations(result: SimResult, simType: SimTypeId): Promise<OptimizerRecommendation[]> {
  const telemetry = buildOptimizerTelemetry(result, simType);
  const { text } = await generateJSON({
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: `Simulation Telemetry:\n${fenceUntrusted("simulation_telemetry", JSON.stringify(telemetry, null, 2))}`,
    // 1024 cut off three recommendations with fixes mid-JSON (thinking models spend part of the budget).
    maxOutputTokens: 4096,
    temperature: 0.25,
  });

  const parsed = extractJSON(text);
  if (!parsed?.recommendations || !Array.isArray(parsed.recommendations)) {
    throw new OptimizerResponseError("AI response did not contain valid recommendations");
  }

  const nodes = result.nodeStats || {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- model output, validated field by field
  return parsed.recommendations.slice(0, 3).map((r: any) => {
    let validFix: OptimizerFix | undefined = undefined;
    if (r?.fix && typeof r.fix.nodeId === "string" && Object.hasOwn(nodes, r.fix.nodeId) && r.fix.paramPatch && typeof r.fix.paramPatch === "object") {
      const target = nodes[r.fix.nodeId];
      const patch: Record<string, number> = {};
      for (const [k, v] of Object.entries(r.fix.paramPatch)) {
        const range = Object.hasOwn(PATCH_LIMITS, k) ? PATCH_LIMITS[k] : undefined;
        if (!range || typeof v !== "number" || !Number.isFinite(v)) continue;
        // Capacity only means something on servers and queues; elsewhere it would be a no-op "fix".
        if (k === "capacity" && !isServerNode(target) && target.nodeType !== "queue") continue;
        const clamped = Math.min(range[1], Math.max(range[0], v));
        patch[k] = k === "capacity" ? Math.round(clamped) : clamped;
      }
      if (Object.keys(patch).length > 0) {
        validFix = {
          nodeId: r.fix.nodeId,
          paramPatch: patch,
          description: typeof r.fix.description === "string" ? r.fix.description.slice(0, 80) : "Apply parameter update",
        };
      }
    }

    return {
      title: clip(r?.title, "Flow Optimization", 70),
      action: clip(r?.action, "Adjust node configuration to balance workflow.", 600),
      impact: clip(r?.impact, "Improves overall throughput.", 200),
      confidence: Math.min(100, Math.max(1, Number(r?.confidence) || 90)),
      fix: validFix,
    };
  });
}
