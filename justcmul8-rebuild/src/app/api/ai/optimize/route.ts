import { withCredits } from "@/lib/billing/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateJSON, extractJSON, AIRouterError } from "@/lib/ai/modelRouter";
import type { SimResult, SimTypeId } from "@/lib/simulation/types";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import { hasUtilization } from "@/lib/simulation/analyticsEngine";
import { UNTRUSTED_DATA_RULES, fenceUntrusted } from "@/lib/ai/systemPrompt";

export const maxDuration = 60;

// Per-user and global rate limits run in withCredits, before credits are charged.
const MAX_NODES = 300;
const PATCH_LIMITS: Record<string, [number, number]> = {
  capacity: [1, 10_000],
  serviceTimeMean: [0.0001, 1e7],
  durationMean: [0.0001, 1e7],
  arrivalRate: [0.0001, 1e6],
  fillRate: [0.0001, 1e7],
};
const clip = (v: unknown, fallback: string, max: number) =>
  (typeof v === "string" && v.trim() ? v.trim() : fallback).slice(0, max);

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

async function handle(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const result: SimResult = body?.result;
  const simType: SimTypeId = body?.simType;

  if (!result || typeof result !== "object" || typeof simType !== "string") {
    return NextResponse.json({ error: "Missing result or simType" }, { status: 400 });
  }
  if (!result.nodeStats || typeof result.nodeStats !== "object" || Object.keys(result.nodeStats).length > MAX_NODES) {
    return NextResponse.json({ error: "Invalid simulation result" }, { status: 400 });
  }

  const config = Object.hasOwn(SIM_TYPE_REGISTRY, simType) ? SIM_TYPE_REGISTRY[simType] : SIM_TYPE_REGISTRY.human_queue;
  const bottleneck = result.bottleneckNodeId ? result.nodeStats[result.bottleneckNodeId] : null;

  // Build concise telemetry summary (no heavy log blobs)
  const telemetrySummary = {
    domain: config.label,
    entityName: config.entityName,
    totalSimTimeSeconds: result.totalSimTime,
    totalArrived: result.totalArrived,
    totalCompleted: result.totalCompleted,
    completionRatePct: result.totalArrived > 0 ? Math.round((result.totalCompleted / result.totalArrived) * 100) : 0,
    healthScore: result.healthScore,
    bottleneck: bottleneck
      ? {
          nodeId: result.bottleneckNodeId,
          label: bottleneck.label,
          nodeType: bottleneck.nodeType,
          utilizationPct: Math.round((bottleneck.utilization || 0) * 100),
          avgWaitTimeSeconds: Math.round((bottleneck.avgWaitTime || 0) * 10) / 10,
          avgServiceTimeSeconds: Math.round((bottleneck.avgServiceTime || 0) * 10) / 10,
          currentQueueDepth: bottleneck.currentDepth || 0,
        }
      : null,
    allNodes: Object.entries(result.nodeStats || {}).map(([id, stats]) => ({
      id,
      label: stats.label,
      nodeType: stats.nodeType,
      utilizationPct: hasUtilization(stats) ? Math.round((stats.utilization || 0) * 100) : undefined,
      avgWaitTime: Math.round((stats.avgWaitTime || 0) * 10) / 10,
    })),
    littlesLawStable: result.littlesLaw?.isStable,
    medianWaitSeconds: result.waitTimePercentiles?.p50,
    p95WaitSeconds: result.waitTimePercentiles?.p95,
  };

  const systemInstruction = `You are a discrete-event-simulation optimization engine for JustCmul8.
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
3. Be direct, precise, and practical for real-world operations.

${UNTRUSTED_DATA_RULES}`;

  try {
    const { text } = await generateJSON({
      systemInstruction,
      prompt: `Simulation Telemetry:\n${fenceUntrusted("simulation_telemetry", JSON.stringify(telemetrySummary, null, 2))}`,
      maxOutputTokens: 1024,
      temperature: 0.25,
    });

    const parsed = extractJSON(text);
    if (!parsed?.recommendations || !Array.isArray(parsed.recommendations)) {
      return NextResponse.json({ error: "AI response did not contain valid recommendations" }, { status: 502 });
    }

    // Sanitize recommendations
    const validNodeIds = new Set(Object.keys(result.nodeStats || {}));
    const sanitizedRecommendations: OptimizerRecommendation[] = parsed.recommendations.slice(0, 3).map((r: any) => {
      let validFix: OptimizerFix | undefined = undefined;
      if (
        r?.fix &&
        typeof r.fix.nodeId === "string" &&
        validNodeIds.has(r.fix.nodeId) &&
        r.fix.paramPatch &&
        typeof r.fix.paramPatch === "object"
      ) {
        const patch: Record<string, any> = {};
        for (const [k, v] of Object.entries(r.fix.paramPatch)) {
          const range = Object.hasOwn(PATCH_LIMITS, k) ? PATCH_LIMITS[k] : undefined;
          if (range && typeof v === "number" && Number.isFinite(v)) {
            const clamped = Math.min(range[1], Math.max(range[0], v));
            patch[k] = k === "capacity" ? Math.round(clamped) : clamped;
          }
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

    return NextResponse.json({ recommendations: sanitizedRecommendations });
  } catch (err) {
    if (err instanceof AIRouterError) {
      return NextResponse.json({ error: err.userMessage }, { status: err.httpStatus });
    }
    console.error("AI Optimizer Error:", err);
    return NextResponse.json({ error: "Optimization engine temporarily unavailable" }, { status: 500 });
  }
}

// Charged per call; refunded automatically if the handler fails.
export const POST = (req: Request) => withCredits("ai_optimize", req, handle);
