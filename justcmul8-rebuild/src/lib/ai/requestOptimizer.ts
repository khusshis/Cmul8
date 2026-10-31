import { toast } from "@/components/ui/Toast";
import type { SimResult, SimTypeId } from "@/lib/simulation/types";
import type { OptimizerRecommendation } from "@/app/api/ai/optimize/route";

/**
 * The AI routes only read summary telemetry, so never upload logs, entity journeys or the timeline:
 * on a long run those are megabytes, and Vercel refuses bodies over 4.5 MB (413), which the panel
 * used to report as "Couldn't reach the optimizer".
 */
export function slimSimResult(r: SimResult | null | undefined) {
  if (!r) return undefined;
  const { logs: _l, entityJourneys: _j, topSlowestEntities: _t, timeline: _tl, ...summary } = r;
  return summary;
}

/** Asks /api/ai/optimize for recommendations on this run. Toasts and returns null on failure. */
export async function requestOptimizer(result: SimResult, simType: SimTypeId): Promise<OptimizerRecommendation[] | null> {
  let res: Response;
  try {
    res = await fetch("/api/ai/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result: slimSimResult(result), simType }),
    });
  } catch (err) {
    console.error("AI Optimizer Request Failed:", err);
    toast.error("Couldn't reach the optimizer. Check your connection and try again.", "Optimizer unavailable");
    return null;
  }
  // Errors from the platform (too large, timed out) are plain text, not JSON: say what happened.
  const data = await res.json().catch(() => null);
  if (Array.isArray(data?.recommendations)) return data.recommendations;
  const message =
    data?.error ??
    (res.status === 413 ? "This run is too large to send to the optimizer." : res.status === 504 ? "The optimizer took too long. Please try again." : `The optimizer failed (error ${res.status}). Please try again.`);
  toast.error(message, res.status === 402 ? "Out of credits" : "Optimizer unavailable");
  return null;
}
