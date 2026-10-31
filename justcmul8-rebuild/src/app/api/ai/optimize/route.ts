import { withCredits } from "@/lib/billing/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AIRouterError } from "@/lib/ai/modelRouter";
import type { SimResult, SimTypeId } from "@/lib/simulation/types";
import { optimizeRecommendations, OptimizerResponseError } from "@/lib/ai/optimizer";

export type { OptimizerFix, OptimizerRecommendation } from "@/lib/ai/optimizer";

export const maxDuration = 60;

// Per-user and global rate limits run in withCredits, before credits are charged.
const MAX_NODES = 300;

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

  try {
    return NextResponse.json({ recommendations: await optimizeRecommendations(result, simType) });
  } catch (err) {
    if (err instanceof AIRouterError) {
      return NextResponse.json({ error: err.userMessage }, { status: err.httpStatus });
    }
    if (err instanceof OptimizerResponseError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error("AI Optimizer Error:", err);
    return NextResponse.json({ error: "Optimization engine temporarily unavailable" }, { status: 500 });
  }
}

// Charged per call; refunded automatically if the handler fails.
export const POST = (req: Request) => withCredits("ai_optimize", req, handle);
