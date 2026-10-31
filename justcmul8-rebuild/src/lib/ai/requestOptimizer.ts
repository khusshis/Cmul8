import { toast } from "@/components/ui/Toast";
import type { SimResult, SimTypeId } from "@/lib/simulation/types";
import type { OptimizerRecommendation } from "@/app/api/ai/optimize/route";

/** Asks /api/ai/optimize for recommendations on this run. Toasts and returns null on failure. */
export async function requestOptimizer(result: SimResult, simType: SimTypeId): Promise<OptimizerRecommendation[] | null> {
  try {
    const res = await fetch("/api/ai/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result, simType }),
    });
    const data = await res.json();
    if (Array.isArray(data.recommendations)) return data.recommendations;
    if (data.error) toast.error(data.error, res.status === 402 ? "Out of credits" : "Optimizer unavailable");
  } catch (err) {
    console.error("AI Optimizer Request Failed:", err);
    toast.error("Couldn't reach the optimizer. Check your connection and try again.", "Optimizer unavailable");
  }
  return null;
}
