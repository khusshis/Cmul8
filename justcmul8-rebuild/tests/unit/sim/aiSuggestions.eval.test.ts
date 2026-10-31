/**
 * On-demand check of the real AI optimizer (uses the Gemini key and quota, answers vary):
 *   RUN_AI_EVAL=1 npx vitest run tests/unit/sim/aiSuggestions.eval.test.ts
 * Asks the model about the overloaded clinic, applies every fix it proposes, re-runs the same seeds
 * and checks each fix is valid and actually helps.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { optimizeRecommendations } from "@/lib/ai/optimizer";
import type { SimGraph, SimResult } from "@/lib/simulation/types";
import { hasSimpy } from "./simpyRunner";
import { clinic, run } from "./clinicModel";

const enabled = process.env.RUN_AI_EVAL === "1" && hasSimpy;
if (enabled && !process.env.GEMINI_API_KEY) {
  for (const l of readFileSync(path.resolve(__dirname, "../../../.env.local"), "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*(GEMINI_[A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const seeds = [1, 2, 3];
const summary = (rs: SimResult[]) => {
  const avg = (f: (r: SimResult) => number) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
  return {
    completed: avg((r) => r.totalCompleted),
    turnedAway: avg((r) => r.nodeStats.qdoc.droppedCount ?? 0),
    doctorLineWaitMin: avg((r) => r.nodeStats.qdoc.avgWaitTime) / 60,
    health: avg((r) => r.healthScore ?? 0),
  };
};
const patched = (g: SimGraph, nodeId: string, patch: Record<string, unknown>): SimGraph => ({
  ...g,
  nodes: g.nodes.map((n) => (n.id === nodeId ? { ...n, params: { ...n.params, ...patch } } : n)),
});

describe.skipIf(!enabled)("AI optimizer suggestions on the clinic model", () => {
  it("every proposed fix is valid and improves the run", { timeout: 300_000 }, async () => {
    const base = seeds.map((s) => run(clinic(), s));
    const before = summary(base);
    const recs = await optimizeRecommendations(base[0], "human_queue");
    console.log("BEFORE", JSON.stringify(before));
    expect(recs.length).toBeGreaterThan(0);
    const fixes = recs.filter((r) => r.fix);
    expect(fixes.length, "the model should propose at least one applicable fix").toBeGreaterThan(0);

    for (const r of recs) {
      console.log(`\nAI: ${r.title}\n    ${r.action}\n    impact: ${r.impact}\n    fix: ${JSON.stringify(r.fix ?? null)}`);
      if (!r.fix) continue;
      const node = clinic().nodes.find((n) => n.id === r.fix!.nodeId)!;
      const cap = r.fix.paramPatch.capacity;
      if (typeof cap === "number" && (node.nodeType === "resource" || node.nodeType === "priority_resource")) {
        expect(cap, `${r.title}: a capacity fix must add servers`).toBeGreaterThan(Number((node.params as { capacity?: number }).capacity ?? 1));
      }
      const after = summary(seeds.map((s) => run(patched(clinic(), r.fix!.nodeId, r.fix!.paramPatch), s)));
      console.log("    AFTER", JSON.stringify(after));
      expect(after.completed, `${r.title}: should not finish fewer`).toBeGreaterThanOrEqual(before.completed * 0.98);
      expect(after.health, `${r.title}: should not lower health`).toBeGreaterThanOrEqual(before.health - 2);
    }
    // The real problem is the doctors; at least one fix must clearly fix it.
    const best = Math.max(
      ...(await Promise.all(fixes.map(async (r) => summary(seeds.map((s) => run(patched(clinic(), r.fix!.nodeId, r.fix!.paramPatch), s))).completed)))
    );
    expect(best, "some AI fix should clearly raise how many finish").toBeGreaterThan(before.completed * 1.1);
  });
});
