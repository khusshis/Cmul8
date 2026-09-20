import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateJSON, extractJSON, AIRouterError } from "@/lib/ai/modelRouter";
import type { SimResult, SimTypeId } from "@/lib/simulation/types";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";

export const maxDuration = 60;

// ─── Best-effort per-user rate limit (per server instance) ────────────────────
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
const recent = new Map<string, number[]>();

function rateLimited(userId: string): number | null {
  const now = Date.now();
  const hits = (recent.get(userId) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) {
    recent.set(userId, hits);
    return Math.ceil((RATE_WINDOW_MS - (now - hits[0])) / 1000);
  }
  hits.push(now);
  recent.set(userId, hits);
  return null;
}

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

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const retryAfter = rateLimited(user.id);
  if (retryAfter !== null) {
    return NextResponse.json(
      { error: `Too many optimization requests. Please wait ${retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const body = await req.json();
  const result: SimResult = body.result;
  const simType: SimTypeId = body.simType;

  if (!result || !simType) {
    return NextResponse.json({ error: "Missing result or simType" }, { status: 400 });
  }

  const config = SIM_TYPE_REGISTRY[simType] || SIM_TYPE_REGISTRY.human_queue;
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
      utilizationPct: Math.round((stats.utilization || 0) * 100),
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
3. Be direct, precise, and practical for real-world operations.`;

  try {
    const { text } = await generateJSON({
      systemInstruction,
      prompt: `Simulation Telemetry:\n${JSON.stringify(telemetrySummary, null, 2)}`,
      maxOutputTokens: 1024,
      temperature: 0.25,
    });

    const parsed = extractJSON(text);
    if (!parsed?.recommendations || !Array.isArray(parsed.recommendations)) {
      return NextResponse.json({ error: "AI response did not contain valid recommendations" }, { status: 502 });
    }

    // Sanitize recommendations
    const validNodeIds = new Set(Object.keys(result.nodeStats || {}));
    const sanitizedRecommendations: OptimizerRecommendation[] = parsed.recommendations.map((r: any) => {
      let validFix: OptimizerFix | undefined = undefined;
      if (
        r.fix &&
        typeof r.fix.nodeId === "string" &&
        validNodeIds.has(r.fix.nodeId) &&
        typeof r.fix.paramPatch === "object"
      ) {
        const patch: Record<string, any> = {};
        for (const [k, v] of Object.entries(r.fix.paramPatch)) {
          if (["capacity", "serviceTimeMean", "durationMean", "arrivalRate", "fillRate"].includes(k) && typeof v === "number" && !isNaN(v)) {
            patch[k] = v;
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
        title: String(r.title || "Flow Optimization").slice(0, 70),
        action: String(r.action || "Adjust node configuration to balance workflow."),
        impact: String(r.impact || "Improves overall throughput."),
        confidence: Math.min(100, Math.max(1, Number(r.confidence) || 90)),
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
