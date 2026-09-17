/**
 * modelRouter.ts — resilient Gemini calls with an ordered model fallback chain.
 *
 * SERVER ONLY. Imports the API key; never import this from a client component.
 *
 * Why this exists: the chat route hard-coded `gemini-2.5-flash` with a
 * `gemini-2.0-flash` fallback. Both were retired (HTTP 404), so every request
 * failed and the UI blamed the API key — which was valid all along. A single
 * probe of this project's key also returned 429 (quota) on the pro models and
 * 503 (overloaded) on the newest flash models, so a production chat has to
 * survive all four failure classes, not just one.
 *
 * Failure handling per attempt:
 *   404 retired model      → skipped for 6 h, try the next one
 *   400 rejected request   → skipped for 60 s (may be this request's fault), try the next one
 *   429 quota              → model cooled down (honours retryDelay), try the next one
 *   5xx / timeout / network→ model cooled down briefly, try the next one
 *   bad API key (401/403)  → stop immediately: no other model can succeed
 *   safety block           → stop immediately: rewording is the fix, not retrying
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Verified against this project's key: every entry returned HTTP 200 for a JSON
 * generation. Override with GEMINI_MODEL (primary) and GEMINI_FALLBACK_MODELS
 * (comma-separated) without a code change when Google retires the next one.
 */
const DEFAULT_MODEL_CHAIN = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
];

export type AIErrorCode =
  | "AUTH"
  | "QUOTA"
  | "OVERLOADED"
  | "TIMEOUT"
  | "NETWORK"
  | "MODELS_UNAVAILABLE"
  | "SAFETY"
  | "BAD_OUTPUT"
  | "CONFIG";

export class AIRouterError extends Error {
  constructor(
    public code: AIErrorCode,
    public userMessage: string,
    public httpStatus: number,
    public retryable: boolean,
    public retryAfterSeconds?: number,
    public attempts: AttemptLog[] = []
  ) {
    super(`${code}: ${userMessage}`);
  }
}

export interface AttemptLog {
  model: string;
  outcome: "ok" | FailureClass;
  ms: number;
  detail?: string;
}

type FailureClass = "unavailable" | "rejected" | "quota" | "overloaded" | "timeout" | "network" | "auth" | "safety" | "unknown";

// ─── Model health cache (per server instance) ─────────────────────────────────

const health = new Map<string, { until: number; reason: FailureClass }>();
const UNAVAILABLE_TTL_MS = 6 * 60 * 60 * 1000; // retired models: re-check every 6 h
const OVERLOADED_TTL_MS = 20 * 1000;
/** A 400 may be caused by this request rather than the model, so it must never earn the 6 h TTL. */
const REJECTED_TTL_MS = 60 * 1000;
const DEFAULT_QUOTA_TTL_MS = 60 * 1000;

function isHealthy(model: string, now: number) {
  const h = health.get(model);
  return !h || h.until <= now;
}

function markUnhealthy(model: string, reason: FailureClass, ttlMs: number) {
  health.set(model, { reason, until: Date.now() + ttlMs });
}

export function modelChain(): string[] {
  const primary = process.env.GEMINI_MODEL?.trim();
  const extra = (process.env.GEMINI_FALLBACK_MODELS || "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return [...new Set([primary, ...extra, ...DEFAULT_MODEL_CHAIN].filter(Boolean) as string[])];
}

// ─── Error classification ─────────────────────────────────────────────────────

/** Parses Google's RetryInfo detail ("12s") into seconds. */
function retryDelaySeconds(err: any): number | undefined {
  const details = Array.isArray(err?.errorDetails) ? err.errorDetails : [];
  for (const d of details) {
    const raw = d?.retryDelay;
    if (typeof raw === "string") {
      const s = parseFloat(raw);
      if (Number.isFinite(s)) return Math.ceil(s);
    }
  }
  return undefined;
}

function classify(err: any): FailureClass {
  const status: number | undefined = err?.status;
  const msg = String(err?.message || "");
  const name = String(err?.name || "");

  if (name.includes("AbortError") || /aborted|timed? ?out|timeout/i.test(msg)) return "timeout";
  if (/API key not valid|API_KEY_INVALID|PERMISSION_DENIED.*key|invalid api key/i.test(msg)) return "auth";
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "unavailable";
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) return "quota";
  if (status && status >= 500) return "overloaded";
  // 400: either a model-specific rejection (e.g. system instructions unsupported)
  // or a problem with this particular request. Can't tell which, so treat it as
  // short-lived and move on.
  if (status === 400) return "rejected";
  if (name.includes("ResponseError") && /SAFETY|blocked|PROHIBITED|RECITATION/i.test(msg)) return "safety";
  if (/fetch failed|ECONNRESET|ENOTFOUND|EAI_AGAIN|network/i.test(msg)) return "network";
  return "unknown";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface GenerateOptions {
  systemInstruction: string;
  prompt: string;
  /** Per-attempt ceiling. */
  attemptTimeoutMs?: number;
  /** Total budget across every model in the chain. */
  deadlineMs?: number;
  maxOutputTokens?: number;
  temperature?: number;
}

export interface GenerateResult {
  text: string;
  model: string;
  finishReason?: string;
  attempts: AttemptLog[];
}

export async function generateJSON(opts: GenerateOptions): Promise<GenerateResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new AIRouterError(
      "CONFIG",
      "The AI assistant isn't configured on this server yet (GEMINI_API_KEY is missing).",
      503,
      false
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  // Budgets sized so a slow first model still leaves room for two fallbacks
  // inside the route's 120 s ceiling (the client gives up at 110 s).
  const attemptTimeoutMs = opts.attemptTimeoutMs ?? 35_000;
  const deadline = Date.now() + (opts.deadlineMs ?? 100_000);
  const attempts: AttemptLog[] = [];

  // Healthy models first; if the cache says everything is down, try them anyway
  // rather than failing on stale state.
  const chain = modelChain();
  const now = Date.now();
  const ordered = [...chain.filter((m) => isHealthy(m, now)), ...chain.filter((m) => !isHealthy(m, now))];

  let lastQuotaRetryAfter: number | undefined;

  for (const modelName of ordered) {
    const remaining = deadline - Date.now();
    if (remaining < 2_000) break;

    const started = Date.now();
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: opts.systemInstruction,
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: opts.maxOutputTokens ?? 16_384,
          temperature: opts.temperature ?? 0.4,
        },
      });

      // Belt and braces on the timeout. The SDK does honour `timeout` by aborting
      // the fetch, but a single hung attempt holds a serverless invocation (and the
      // user's chat) open, so we also drive our own AbortController and race a
      // wall-clock timer. An observed attempt once ran for 39 minutes when the host
      // suspended mid-request and the SDK's timer never fired.
      const budget = Math.max(1_000, Math.min(attemptTimeoutMs, remaining));
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
        model.generateContent(opts.prompt, { timeout: budget, signal: controller.signal }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(Object.assign(new Error(`Attempt timed out after ${budget}ms`), { name: "AbortError" }));
          }, budget);
        }),
      ]).finally(() => clearTimeout(timer));
      const response = result.response;
      const finishReason = response.candidates?.[0]?.finishReason;
      // .text() throws GoogleGenerativeAIResponseError when the output was blocked.
      const text = response.text();

      if (!text || !text.trim()) {
        attempts.push({ model: modelName, outcome: "unknown", ms: Date.now() - started, detail: `empty (${finishReason})` });
        markUnhealthy(modelName, "overloaded", OVERLOADED_TTL_MS);
        continue;
      }

      attempts.push({ model: modelName, outcome: "ok", ms: Date.now() - started });
      return { text, model: modelName, finishReason, attempts };
    } catch (err: any) {
      const cls = classify(err);
      attempts.push({
        model: modelName,
        outcome: cls,
        ms: Date.now() - started,
        detail: String(err?.message || err).slice(0, 200),
      });

      if (cls === "auth") {
        throw new AIRouterError(
          "AUTH",
          "The AI service rejected this server's API key. An administrator needs to check GEMINI_API_KEY.",
          502,
          false,
          undefined,
          attempts
        );
      }
      if (cls === "safety") {
        throw new AIRouterError(
          "SAFETY",
          "I can't respond to that request as it's phrased. Try rewording it.",
          422,
          false,
          undefined,
          attempts
        );
      }
      if (cls === "unavailable") markUnhealthy(modelName, cls, UNAVAILABLE_TTL_MS);
      else if (cls === "rejected") markUnhealthy(modelName, cls, REJECTED_TTL_MS);
      else if (cls === "quota") {
        const s = retryDelaySeconds(err);
        lastQuotaRetryAfter = s ?? lastQuotaRetryAfter;
        markUnhealthy(modelName, cls, (s ?? DEFAULT_QUOTA_TTL_MS / 1000) * 1000);
      } else {
        markUnhealthy(modelName, cls, OVERLOADED_TTL_MS);
      }
      // fall through to the next model
    }
  }

  // Every model failed: report the most actionable cause.
  const outcomes = new Set(attempts.map((a) => a.outcome));
  console.error("[ai/modelRouter] all models failed", attempts);

  if (attempts.length === 0) {
    throw new AIRouterError("TIMEOUT", "The AI assistant ran out of time. Please try again.", 504, true, 5, attempts);
  }
  if ([...outcomes].every((o) => o === "unavailable")) {
    throw new AIRouterError(
      "MODELS_UNAVAILABLE",
      "None of the configured AI models are available to this API key. An administrator needs to update GEMINI_MODEL.",
      503,
      false,
      undefined,
      attempts
    );
  }
  if ([...outcomes].every((o) => o === "unavailable" || o === "rejected")) {
    throw new AIRouterError(
      "BAD_OUTPUT",
      "The AI service couldn't process that request. Try a shorter or simpler message.",
      502,
      false,
      undefined,
      attempts
    );
  }
  if (outcomes.has("quota") && !outcomes.has("overloaded") && !outcomes.has("timeout")) {
    const wait = lastQuotaRetryAfter ?? 60;
    throw new AIRouterError(
      "QUOTA",
      `The AI usage limit has been reached. Please try again in about ${wait} seconds.`,
      429,
      true,
      wait,
      attempts
    );
  }
  if (outcomes.has("timeout")) {
    throw new AIRouterError("TIMEOUT", "The AI assistant took too long to respond. Please try again.", 504, true, 5, attempts);
  }
  if (outcomes.has("network")) {
    throw new AIRouterError("NETWORK", "The server couldn't reach the AI service. Please try again shortly.", 502, true, 10, attempts);
  }
  throw new AIRouterError("OVERLOADED", "The AI service is busy right now. Please try again in a moment.", 503, true, 10, attempts);
}

// ─── Tolerant JSON extraction ─────────────────────────────────────────────────

/**
 * JSON mode is not a guarantee: models still occasionally wrap output in code
 * fences or add a sentence before it. Strips fences, then falls back to the
 * first balanced top-level object (string-aware, so braces inside strings do
 * not confuse it).
 */
export function extractJSON(raw: string): any | undefined {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const attempt = (s: string) => {
    try {
      return JSON.parse(s);
    } catch {
      try {
        return JSON.parse(repairEscapes(s));
      } catch {
        return undefined;
      }
    }
  };

  const whole = attempt(text);
  if (whole !== undefined) return whole;

  const start = text.indexOf("{");
  if (start < 0) return undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      return attempt(text.slice(start, i + 1));
    }
  }
  return undefined;
}

/**
 * Escapes stray backslashes that JSON does not allow.
 *
 * Observed repeatedly from Gemini 3 flash: the reply contains LaTeX, and while it
 * usually escapes it correctly ("\\rho"), it intermittently emits a bare
 * backslash — e.g. `($\ mu = 0.667$)` — which is an invalid JSON escape and fails
 * the whole parse. Only reached after a strict parse has already failed, so valid
 * output is never touched.
 */
function repairEscapes(s: string): string {
  return s.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
}
