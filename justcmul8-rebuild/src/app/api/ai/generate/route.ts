import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AIRouterError, extractJSON, generateJSON } from "@/lib/ai/modelRouter";
import { normalizeAIResponse, applyAIOps } from "@/lib/ai/graphOps";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import { SimTypeId } from "@/lib/simulation/types";

const BASE_SYSTEM_PROMPT = `You are a system architecture AI. Your job is to convert the user's plain English description of a process into a valid JustCmul8 JSON graph.

The graph MUST conform to this exact JSON schema:
{
  "nodes": [
    {
      "id": "unique_string_id",
      "nodeType": "<one of the 15 types below>",
      "label": "Human readable name",
      "position": { "x": number, "y": number },
      "params": { ... }
    }
  ],
  "edges": [
    {
      "id": "unique_edge_id",
      "source": "source_node_id",
      "target": "target_node_id"
    }
  ]
}

The 15 valid nodeTypes and their required params are:
1. source: { arrivalRate: number, distribution: "exponential"|"uniform"|"deterministic" }
2. queue: { capacity: number (-1 for infinite), discipline: "FIFO" }
3. resource: { capacity: number, serviceTimeMean: number, serviceDistribution: string }
4. priority_resource: { capacity: number, isPreemptive: boolean }
5. service: { durationMean: number, distribution: string }
6. decision: { routes: [{ targetId: string, probability: number }] }
7. sink: {}
8. container: { capacity: number, initialLevel: number }
9. store: { capacity: number }
10. event_trigger: { eventName: string }
11. any_of: { targetId: string }
12. all_of: { targetId: string }
13. channel: { bufferCapacity: number, propagationDelay: number, delayDistribution: string }
14. broadcaster: {}
15. interrupter: { targetNodeId: string, cause: string }

Rules:
1. Position x/y should lay out the graph logically (left to right, ~200px apart).
2. ONLY output valid JSON.
`;

export const maxDuration = 120;

/**
 * Plain-English description -> complete graph. No UI calls this today; it is kept
 * working (and now authenticated, on the shared model router) because it is a
 * public endpoint that spends the same paid quota as the chat route.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > 4_000) {
    return NextResponse.json({ error: "prompt must be 1-4000 characters" }, { status: 400 });
  }

  const domainPrompt = SIM_TYPE_REGISTRY[body?.simType as SimTypeId]?.aiSystemPrompt || "";
  const fullSystemPrompt = `${BASE_SYSTEM_PROMPT}

DOMAIN CONTEXT:
${domainPrompt}`;
  const currentNodesCount = Number(body?.currentNodesCount) || 0;

  try {
    const generation = await generateJSON({
      systemInstruction: fullSystemPrompt,
      prompt: `The current graph has ${currentNodesCount} nodes. User request: ${prompt}`,
    });
    const parsed = extractJSON(generation.text);
    if (!parsed) {
      return NextResponse.json({ error: "The model returned invalid JSON" }, { status: 502 });
    }
    // Same validation as the chat route: unknown block types, dangling links and
    // bad routing are repaired or dropped rather than passed through.
    const { ops, warnings } = normalizeAIResponse(
      { actionType: "REPLACE_GRAPH", graph: { nodes: parsed.nodes, edges: parsed.edges } },
      0,
      prompt
    );
    if (!ops.replaceGraph) {
      return NextResponse.json({ error: "The model produced no valid blocks", warnings }, { status: 502 });
    }
    const applied = applyAIOps([], [], ops);
    const positions = new Map(
      (Array.isArray(parsed.nodes) ? parsed.nodes : []).map((n: any) => [n?.id, n?.position])
    );
    return NextResponse.json({
      nodes: applied.nodes.map((n) => ({
        id: n.id,
        nodeType: n.data.nodeType,
        label: n.data.label,
        position: positions.get(n.id) ?? n.position,
        params: n.data.params,
      })),
      edges: applied.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
      warnings: [...warnings, ...applied.warnings],
    });
  } catch (err) {
    if (err instanceof AIRouterError) {
      return NextResponse.json(
        { error: err.userMessage, errorCode: err.code, retryable: err.retryable },
        { status: err.httpStatus }
      );
    }
    console.error("[api/ai/generate] unexpected error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
