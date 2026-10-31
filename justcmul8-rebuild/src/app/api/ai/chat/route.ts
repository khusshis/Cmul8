import { withCredits } from "@/lib/billing/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import { hasUtilization } from "@/lib/simulation/analyticsEngine";
import type { SimTypeId } from "@/lib/simulation/types";
import { AIRouterError, extractJSON, generateJSON } from "@/lib/ai/modelRouter";
import { buildSystemPrompt, fenceUntrusted } from "@/lib/ai/systemPrompt";
import { normalizeAIResponse, summarizeCanvas } from "@/lib/ai/graphOps";
import { toPlainMarkdown } from "@/lib/ai/textFormat";
import { analyseFlow } from "@/lib/ai/flowAnalysis";

// Model calls plus fallbacks can legitimately take tens of seconds.
export const maxDuration = 120;

const MAX_PROMPT_CHARS = 4_000;
const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_CHARS = 1_500;
const MAX_CANVAS_NODES = 300;
const MAX_CANVAS_EDGES = 1_000;
const MAX_REPLY_CHARS = 12_000;
const MAX_WORKSPACE_CHARS = 250_000;
const SIM_STATES = ["idle", "running", "paused"];
// Per-user and global rate limits live in withCredits (Postgres-backed, shared
// across instances), so they run before any credit is charged.

/**
 * Validates the megaprompt's `simulationInsights` block. Free-text fields are
 * length-capped and bottleneckRisk is constrained to the three allowed values, so
 * whatever the UI eventually renders cannot be arbitrary model output.
 */
function sanitizeInsights(raw: any) {
  if (!raw || typeof raw !== "object") return undefined;
  const text = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
  const risk = typeof raw.bottleneckRisk === "string" ? raw.bottleneckRisk.trim().toLowerCase() : "";
  const insights = {
    estimatedThroughput: text(raw.estimatedThroughput, 60),
    bottleneckRisk:
      risk === "low" ? "Low" : risk === "moderate" ? "Moderate" : risk === "critical" ? "Critical" : undefined,
    keyRecommendation: text(raw.keyRecommendation, 240),
  };
  return Object.values(insights).some(Boolean) ? insights : undefined;
}

function errorResponse(
  status: number,
  errorCode: string,
  text: string,
  extra: { retryable?: boolean; retryAfterSeconds?: number } = {}
) {
  const headers: Record<string, string> = {};
  if (extra.retryAfterSeconds) headers["Retry-After"] = String(extra.retryAfterSeconds);
  return NextResponse.json(
    { ok: false, errorCode, text, retryable: extra.retryable ?? false, retryAfterSeconds: extra.retryAfterSeconds },
    { status, headers }
  );
}

/** Only the telemetry the model reasons about — never logs or entity journeys (megabytes). */
function summarizeTelemetry(simResult: any) {
  if (!simResult || typeof simResult !== "object") return null;
  const stats = simResult.nodeStats && typeof simResult.nodeStats === "object" ? simResult.nodeStats : {};
  const bottleneck = simResult.bottleneckNodeId ? stats[simResult.bottleneckNodeId] : null;
  const pct = (p: any) =>
    p ? { p50: p.p50, p90: p.p90, p95: p.p95, p99: p.p99, mean: p.mean } : undefined;

  return {
    engine: simResult.engine ?? "pyodide",
    simulatedSeconds: simResult.totalSimTime,
    totalArrived: simResult.totalArrived,
    totalCompleted: simResult.totalCompleted,
    healthScore: simResult.healthScore,
    bottleneck: bottleneck
      ? { id: simResult.bottleneckNodeId, label: bottleneck.label, utilization: bottleneck.utilization, avgWaitSeconds: bottleneck.avgWaitTime }
      : null,
    waitSeconds: pct(simResult.waitTimePercentiles),
    cycleSeconds: pct(simResult.cycleTimePercentiles),
    littlesLaw: simResult.littlesLaw
      ? {
          verdict: simResult.littlesLaw.verdict,
          isStable: simResult.littlesLaw.isStable,
          lambda: simResult.littlesLaw.lambdaArrivalRate,
          L: simResult.littlesLaw.timeWeightedWIP_L,
          W: simResult.littlesLaw.averageCycleTimeW,
        }
      : undefined,
    stations: Object.values(stats).map((s: any) => ({
      id: s.nodeId,
      label: s.label,
      nodeType: s.nodeType,
      in: s.entitiesIn,
      out: s.entitiesOut,
      inSystemAtEnd: s.currentDepth,
      utilization: hasUtilization(s) ? s.utilization : undefined, // never show a delay block as "100% busy"
      avgWaitSeconds: s.avgWaitTime,
      avgServiceSeconds: s.avgServiceTime,
      reneged: s.renegeCount || undefined,
      dropped: s.droppedCount || undefined,
    })),
  };
}

async function handle(req: Request) {
  // ── Auth: this route spends a paid quota and must not be open to the internet.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return errorResponse(401, "UNAUTHENTICATED", "Your session has expired. Please sign in again to use the AI assistant.");
  }

  // ── Input validation
  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "BAD_REQUEST", "That message couldn't be read. Please try sending it again.");
  }

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return errorResponse(400, "BAD_REQUEST", "Please type a message first.");
  if (prompt.length > MAX_PROMPT_CHARS) {
    return errorResponse(
      400,
      "PROMPT_TOO_LONG",
      `That message is ${prompt.length.toLocaleString()} characters; the limit is ${MAX_PROMPT_CHARS.toLocaleString()}. Please shorten it.`
    );
  }

  const simType: SimTypeId =
    typeof body?.simType === "string" && Object.hasOwn(SIM_TYPE_REGISTRY, body.simType) ? body.simType : "human_queue";
  const domain = SIM_TYPE_REGISTRY[simType];

  const rawNodes = Array.isArray(body?.currentGraph?.nodes) ? body.currentGraph.nodes : [];
  const rawEdges = Array.isArray(body?.currentGraph?.edges) ? body.currentGraph.edges : [];
  if (rawNodes.length > MAX_CANVAS_NODES || rawEdges.length > MAX_CANVAS_EDGES) {
    return errorResponse(
      400,
      "CANVAS_TOO_LARGE",
      `This model has ${rawNodes.length} blocks; the assistant can work with up to ${MAX_CANVAS_NODES} at a time.`
    );
  }
  const canvas = summarizeCanvas(rawNodes, rawEdges);

  const history = (Array.isArray(body?.conversationHistory) ? body.conversationHistory : [])
    .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m: any) => `${m.role.toUpperCase()}: ${m.content.slice(0, MAX_HISTORY_CHARS)}`)
    .join("\n");

  const workspace = {
    domain: simType,
    selectedBlockId: typeof body?.selectedNodeId === "string" ? body.selectedNodeId.slice(0, 128) : null,
    simulationState: SIM_STATES.includes(body?.simState) ? body.simState : "idle",
    canvas: { blockCount: canvas.nodes.length, linkCount: canvas.edges.length, ...canvas },
    // Computed here so the model never has to do the arithmetic itself. Its prose
    // was not reliably self-consistent (one reply asserted rho = 1.13 where the
    // figures it quoted gave 2.25), and free text cannot be validated after the
    // fact. These are facts it must quote rather than recompute.
    flowAnalysis: rawNodes.length > 0 ? analyseFlow(rawNodes, rawEdges) : null,
    telemetry: summarizeTelemetry(body?.simResult),
  };

  const workspaceJson = JSON.stringify(workspace);
  if (workspaceJson.length > MAX_WORKSPACE_CHARS) {
    return errorResponse(400, "CANVAS_TOO_LARGE", "This model is too large for the assistant to read in one go. Try simplifying block settings.");
  }

  // Everything but the user's own request is project data that collaborators (or
  // a pasted model) control, so it is fenced off as untrusted. See systemPrompt.ts.
  const chatPrompt = `CONVERSATION SO FAR:
${fenceUntrusted("conversation_history", history || "(none)")}

CURRENT WORKSPACE (JSON):
${fenceUntrusted("workspace_data", workspaceJson)}

USER REQUEST:
${prompt}`;

  // ── Model call with fallback chain
  let generation;
  try {
    generation = await generateJSON({
      systemInstruction: buildSystemPrompt(domain),
      prompt: chatPrompt,
    });
  } catch (err) {
    if (err instanceof AIRouterError) {
      return errorResponse(err.httpStatus, err.code, err.userMessage, {
        retryable: err.retryable,
        retryAfterSeconds: err.retryAfterSeconds,
      });
    }
    console.error("[api/ai/chat] unexpected error", err);
    return errorResponse(500, "INTERNAL", "Something went wrong on our side. Please try again.", { retryable: true });
  }

  // ── Parse
  const parsed = extractJSON(generation.text);
  if (!parsed || typeof parsed !== "object") {
    if (generation.finishReason === "MAX_TOKENS") {
      return errorResponse(
        502,
        "BAD_OUTPUT",
        "That change was too large to generate in one go. Try asking for it in smaller steps.",
        { retryable: false }
      );
    }
    // Prose instead of JSON: still useful as an answer, but never as a canvas edit.
    const looksLikeJSON = /^\s*[{[]/.test(generation.text);
    if (looksLikeJSON) {
      return errorResponse(502, "BAD_OUTPUT", "The assistant's reply came back garbled. Please try again.", { retryable: true });
    }
    return NextResponse.json({
      ok: true,
      text: toPlainMarkdown(generation.text.trim().slice(0, MAX_REPLY_CHARS)),
      actionType: "NONE",
      ops: null,
      warnings: [],
      modifiedNodeIds: [],
      simulationInsights: undefined,
      suggestedQuestions: [],
      model: generation.model,
    });
  }

  const { ops, warnings } = normalizeAIResponse(parsed, canvas.nodes.length, prompt, {
    confirmBulkDelete: body?.confirmBulkDelete === true,
  });

  const suggestedQuestions = (Array.isArray(parsed.suggestedQuestions) ? parsed.suggestedQuestions : [])
    .filter((q: unknown) => typeof q === "string" && q.trim())
    .map((q: string) => q.trim().slice(0, 160))
    .slice(0, 3);

  // The panel renders Markdown, not LaTeX, so math markup is converted rather
  // than shown to the user as raw "$rho = 0.75$".
  const text =
    typeof parsed.text === "string" && parsed.text.trim()
      ? toPlainMarkdown(parsed.text.trim().slice(0, MAX_REPLY_CHARS))
      : ops.actionType === "NONE"
        ? "I didn't have anything to add there — could you rephrase?"
        : "I've updated your model.";

  return NextResponse.json({
    ok: true,
    text,
    actionType: ops.actionType,
    ops,
    warnings,
    modifiedNodeIds: (Array.isArray(parsed.modifiedNodeIds) ? parsed.modifiedNodeIds : [])
      .filter((id: unknown) => typeof id === "string" && id.length <= 128)
      .slice(0, 60),
    simulationInsights: sanitizeInsights(parsed.simulationInsights),
    suggestedQuestions,
    model: generation.model,
  });
}

// Charged per call; refunded automatically if the handler fails.
export const POST = (req: Request) => withCredits("ai_chat", req, handle);
