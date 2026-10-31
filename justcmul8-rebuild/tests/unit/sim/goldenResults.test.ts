/**
 * Golden results: every starter template, run through the real SimPy script with a fixed seed,
 * must reproduce the saved numbers exactly. Any engine or generator change that shifts results
 * (even slightly) fails here, so it can't happen silently.
 *
 * An intended change: re-record with  UPDATE_GOLDEN=1 npx vitest run tests/unit/sim/goldenResults.test.ts
 * and review the fixture diff before committing it.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import type { SimGraph, SimResult } from "@/lib/simulation/types";
import { hasSimpy, runPython } from "./simpyRunner";

const FIXTURE = path.resolve(__dirname, "../../fixtures/golden-results.json");
const SEED = 1;
const SECONDS = 3600;
const r = (v: number | undefined, dp: number) => Number((v ?? 0).toFixed(dp));

/** The numbers a user sees, rounded so float noise in the last digits doesn't matter. */
function fingerprint(res: SimResult) {
  return {
    arrived: res.totalArrived,
    completed: res.totalCompleted,
    bottleneck: res.bottleneckNodeId,
    nodes: Object.fromEntries(
      Object.entries(res.nodeStats)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, s]) => [id, {
          in: s.entitiesIn, out: s.entitiesOut, depth: s.currentDepth,
          util: r(s.utilization, 4), wait: r(s.avgWaitTime, 3), service: r(s.avgServiceTime, 3),
          dropped: s.droppedCount ?? 0, reneged: s.renegeCount ?? 0,
        }])
    ),
  };
}

const cases = Object.values(SIM_TYPE_REGISTRY).flatMap((cfg) =>
  cfg.subScenarios.filter((sc) => sc.nodes.length > 0).map((sc) => ({ key: `${cfg.id} / ${sc.label}`, graph: { nodes: sc.nodes, edges: sc.edges } as SimGraph }))
);

describe.skipIf(!hasSimpy)("golden results (fixed seed, every template)", () => {
  const actual = Object.fromEntries(cases.map(({ key, graph }) => {
    const { result, stderr } = runPython(graph, SECONDS, SEED);
    if (!result) throw new Error(`${key}: ${stderr.slice(-300)}`);
    return [key, fingerprint(result)];
  }));

  if (process.env.UPDATE_GOLDEN === "1" || !existsSync(FIXTURE)) {
    writeFileSync(FIXTURE, JSON.stringify(actual, null, 2) + "\n");
  }
  const golden = JSON.parse(readFileSync(FIXTURE, "utf8"));

  it("covers every template", () => {
    expect(Object.keys(golden).sort()).toEqual(Object.keys(actual).sort());
  });
  for (const { key } of cases) {
    it(`${key} reproduces its saved results`, () => {
      expect(actual[key]).toEqual(golden[key]);
    });
  }
});
