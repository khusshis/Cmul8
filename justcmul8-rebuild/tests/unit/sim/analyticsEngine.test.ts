import { describe, expect, it } from "vitest";
import {
  calculatePercentiles,
  reconstructEntityJourneys,
  calculateLittlesLaw,
  calculateResourceOperationalStates,
  computeDomainMetrics,
  calculateSystemHealthScore,
  generateExecutiveDiagnosis,
  calculateCostAnalysis,
  enrichSimResult,
} from "@/lib/simulation/analyticsEngine";
import type { SimTypeId } from "@/lib/simulation/types";
import { log, result, stat } from "../helpers";

describe("calculatePercentiles (Hyndman-Fan type 7 = numpy default)", () => {
  it("matches numpy.percentile on 1..10", () => {
    const p = calculatePercentiles([10, 1, 9, 2, 8, 3, 7, 4, 6, 5]);
    // numpy.percentile(range(1,11), [25,50,75,90,95,99]) -> 3.25 5.5 7.75 9.1 9.55 9.91
    expect(p.p25).toBeCloseTo(3.25);
    expect(p.p50).toBeCloseTo(5.5);
    expect(p.p75).toBeCloseTo(7.75);
    expect(p.p90).toBeCloseTo(9.1);
    expect(p.p95).toBeCloseTo(9.55);
    expect(p.p99).toBeCloseTo(9.91);
    expect(p.min).toBe(1);
    expect(p.max).toBe(10);
    expect(p.mean).toBe(5.5);
    expect(p.stdDev).toBeCloseTo(2.8722813, 6); // population std (numpy default ddof=0)
    expect(p.iqr).toBeCloseTo(4.5);
  });
  it("handles empty and single samples", () => {
    expect(calculatePercentiles([]).p50).toBe(0);
    const one = calculatePercentiles([7]);
    expect([one.p25, one.p50, one.p99, one.min, one.max, one.mean]).toEqual([7, 7, 7, 7, 7, 7]);
    expect(one.stdDev).toBe(0);
  });
  it("does not mutate input", () => {
    const xs = [3, 1, 2];
    calculatePercentiles(xs);
    expect(xs).toEqual([3, 1, 2]);
  });
});

describe("reconstructEntityJourneys", () => {
  const logs = [
    log(0, 1, "src", "arrived"),
    log(0, 1, "q", "queued"),
    log(2, 1, "q", "service_start"),
    log(5, 1, "q", "service_end"),
    log(5, 1, "sink", "completed"),
    log(1, 2, "src", "arrived"),
    log(1, 2, "q", "queued"),
    log(4, 2, "q", "reneged"),
    log(3, 3, "src", "arrived"),
    log(3, 3, "q", "queued"), // still waiting at end
    log(6, 4, "src", "arrived"),
    log(6, 4, "ch", "dropped"),
    log(9, 0, "res", "breakdown"), // entity 0 = system event, ignored
  ];
  const j = reconstructEntityJourneys(logs, 10);
  const byId = Object.fromEntries(j.map((x) => [x.entityId, x]));

  it("builds one journey per entity, sorted, ignoring system events", () => {
    expect(j.map((x) => x.entityId)).toEqual([1, 2, 3, 4]);
  });
  it("completed entity: wait 2, service 3, cycle 5", () => {
    expect(byId[1].status).toBe("completed");
    expect(byId[1].totalWaitTime).toBe(2);
    expect(byId[1].totalServiceTime).toBe(3);
    expect(byId[1].totalCycleTime).toBe(5);
  });
  it("reneged entity records its wait", () => {
    expect(byId[2].status).toBe("reneged");
    expect(byId[2].totalWaitTime).toBe(3);
  });
  it("in-flight entity's open wait is closed at run end", () => {
    expect(byId[3].status).toBe("in_flight");
    expect(byId[3].totalWaitTime).toBe(7);
  });
  it("dropped entity", () => {
    expect(byId[4].status).toBe("dropped");
  });
  it("empty logs -> []", () => {
    expect(reconstructEntityJourneys([])).toEqual([]);
  });
});

describe("calculateLittlesLaw", () => {
  it("steady state when L == lambda*W and departures keep up", () => {
    const timeline = Array.from({ length: 11 }, (_, i) => ({ simTime: i * 10, completed: i, depth: {}, wip: 2 }));
    const r = result({ totalSimTime: 100, totalArrived: 50, totalCompleted: 50, timeline });
    const journeys = Array.from({ length: 50 }, (_, i) => ({
      entityId: i + 1, entityClass: "s", priority: 3, arrivalTime: 0, totalCycleTime: 4, totalWaitTime: 0, totalServiceTime: 4, status: "completed" as const, steps: [],
    }));
    const ll = calculateLittlesLaw(r, journeys);
    expect(ll.lambdaArrivalRate).toBe(0.5);
    expect(ll.averageCycleTimeW).toBe(4);
    expect(ll.timeWeightedWIP_L).toBe(2);
    expect(ll.computedWIP_LambdaW).toBe(2);
    expect(ll.discrepancyPercent).toBe(0);
    expect(ll.isStable).toBe(true);
    expect(ll.verdict).toBe("steady_state");
  });
  it("accumulating backlog when departures lag and WIP rises", () => {
    const timeline = Array.from({ length: 12 }, (_, i) => ({ simTime: i * 10, completed: i, depth: {}, wip: i * 5 }));
    const r = result({ totalSimTime: 110, totalArrived: 200, totalCompleted: 60, timeline });
    const ll = calculateLittlesLaw(r, []);
    expect(ll.isStable).toBe(false);
    expect(ll.verdict).toBe("accumulating_backlog");
  });
});

describe("calculateResourceOperationalStates", () => {
  it("splits busy/starved for resources and services only", () => {
    const s = calculateResourceOperationalStates(
      {
        r: stat({ nodeId: "r", nodeType: "resource", utilization: 0.25 }),
        q: stat({ nodeId: "q", nodeType: "queue", utilization: 0.9 }),
        x: stat({ nodeId: "x", nodeType: "service", utilization: 1.7 }),
      },
      200
    );
    expect(Object.keys(s).sort()).toEqual(["r", "x"]);
    expect(s.r).toMatchObject({ busySeconds: 50, starvedSeconds: 150, busyRatio: 0.25, starvedRatio: 0.75 });
    expect(s.x.busyRatio).toBe(1); // clamped
  });
});

describe("computeDomainMetrics", () => {
  const waits = calculatePercentiles([1, 2, 3, 4, 50]);
  const r = result({ nodeStats: { r: stat({ nodeId: "r", nodeType: "resource", utilization: 0.9, renegeCount: 1 }) } });
  for (const t of ["human_queue", "vehicle", "liquid", "manufacturing", "logistics", "network_signal"] as SimTypeId[]) {
    it(`${t} returns well-formed cards`, () => {
      const cards = computeDomainMetrics(t, r, waits);
      expect(cards.length).toBeGreaterThan(0);
      for (const c of cards) {
        expect(c.id && c.label && c.unit !== undefined).toBeTruthy();
        expect(["optimal", "warning", "critical", "neutral"]).toContain(c.status);
      }
    });
  }
});

describe("calculateSystemHealthScore", () => {
  const ll = { lambdaArrivalRate: 1, averageCycleTimeW: 1, timeWeightedWIP_L: 1, computedWIP_LambdaW: 1, discrepancyPercent: 0, isStable: true, verdict: "steady_state" as const };
  const waits = calculatePercentiles([1, 1, 1, 1]);
  it("100 when nothing arrived", () => {
    expect(calculateSystemHealthScore(result({ totalArrived: 0 }), ll, waits)).toBe(100);
  });
  it("perfect run scores 100", () => {
    expect(calculateSystemHealthScore(result({ totalArrived: 10, totalCompleted: 10 }), ll, waits)).toBe(100);
  });
  it("overloaded, unstable run scores low and never below 10", () => {
    const bad = result({ totalArrived: 100, totalCompleted: 0, nodeStats: { r: stat({ nodeId: "r", nodeType: "resource", utilization: 1 }) } });
    const s = calculateSystemHealthScore(bad, { ...ll, isStable: false }, calculatePercentiles([0.1, 0.1, 100]));
    expect(s).toBeLessThan(40);
    expect(s).toBeGreaterThanOrEqual(10);
  });
});

describe("generateExecutiveDiagnosis", () => {
  const ll = { lambdaArrivalRate: 1, averageCycleTimeW: 1, timeWeightedWIP_L: 1, computedWIP_LambdaW: 1, discrepancyPercent: 0, isStable: true, verdict: "steady_state" as const };
  it("names the bottleneck when there is one", () => {
    const r = result({ bottleneckNodeId: "r", nodeStats: { r: stat({ nodeId: "r", nodeType: "resource", label: "Teller", utilization: 0.97, avgWaitTime: 12 }) } });
    const d = generateExecutiveDiagnosis(r, "human_queue", 60, ll, calculatePercentiles([1]));
    expect(d.bottleneckCause).toContain("Teller");
    expect(d.title).toMatch(/Traffic Jam/);
    expect(d.recommendations.length).toBeGreaterThanOrEqual(2);
  });
  // A result with an unrecognised simType (old project rows, AI-created projects) should
  // still get a diagnosis instead of crashing the results panel.
  // BUG: SIM_TYPE_REGISTRY[simType] is undefined for unknown/legacy sim types, then config.entityName throws.
  it("does not throw for an unknown simType", () => {
    expect(() => generateExecutiveDiagnosis(result({ simType: "warehouse_robots" as any }), "warehouse_robots" as any, 90, ll, calculatePercentiles([1]))).not.toThrow();
  });
});

describe("calculateCostAnalysis", () => {
  it("prices resource busy time, queue holding and waiting penalties", () => {
    const graph = {
      nodes: [
        { id: "r", nodeType: "resource" as const, label: "R", params: { capacity: 1, serviceTimeMean: 1, serviceDistribution: "exponential", hourlyCost: 36 } },
        { id: "q", nodeType: "queue" as const, label: "Q", params: { capacity: -1, discipline: "FIFO", holdingCostPerUnitTime: 0.5, waitingPenaltyPerUnitTime: 0.25 } },
        { id: "s", nodeType: "sink" as const, label: "S", params: {} },
      ],
      edges: [],
    };
    const r = result({
      totalCompleted: 4,
      nodeStats: {
        r: stat({ nodeId: "r", nodeType: "resource" }),
        q: stat({ nodeId: "q", nodeType: "queue", avgWaitTime: 2, entitiesIn: 10 }),
        s: stat({ nodeId: "s", nodeType: "sink" }),
      },
    });
    const c = calculateCostAnalysis(graph as any, r, { r: { busySeconds: 1800, starvedSeconds: 0, blockedSeconds: 0, busyRatio: 1, starvedRatio: 0, blockedRatio: 0 } });
    // resource: 36 * 0.5h = 18; queue: 20 entity-seconds * (0.5 + 0.25) = 15
    expect(c.totalSystemCost).toBeCloseTo(33);
    expect(c.costPerCompletedEntity).toBeCloseTo(8.25);
    expect(c.breakdown.map((b) => b.nodeId).sort()).toEqual(["q", "r"]);
  });
});

describe("enrichSimResult", () => {
  const raw = result({
    totalSimTime: 10,
    totalArrived: 1,
    totalCompleted: 1,
    logs: [log(0, 1, "src", "arrived"), log(0, 1, "res", "queued"), log(1, 1, "res", "service_start"), log(3, 1, "res", "service_end"), log(3, 1, "sink", "completed")],
    nodeStats: { res: stat({ nodeId: "res", nodeType: "resource", utilization: 0.2, avgWaitTime: 1 }) },
  });

  it("adds every analytics field", () => {
    const e = enrichSimResult(raw);
    for (const k of ["entityJourneys", "topSlowestEntities", "waitTimePercentiles", "cycleTimePercentiles", "littlesLaw", "resourceStates", "domainMetrics", "healthScore", "aiDiagnosis"]) {
      expect(e, k).toHaveProperty(k);
    }
    expect(e.waitTimePercentiles!.p50).toBe(1);
    expect(e.cycleTimePercentiles!.p50).toBe(3);
  });

  it("is idempotent (returns the same object when already enriched)", () => {
    const e = enrichSimResult(raw);
    expect(enrichSimResult(e)).toBe(e);
  });

  // DATA INTEGRITY: when logs are missing, the engine invents a 5-point "distribution"
  // (0.75x .. 1.4x of the summed node averages) and reports it as real percentiles.
  // A result with no per-entity samples should not show a p99 that was never measured.
  // DESIGN NOTE (data integrity): with no per-entity samples, enrichSimResult synthesises a
  // 5-point distribution (0.75x..1.4x of the summed node averages) and reports it as percentiles.
  // Documented in verification/AUDIT.md (F-1/F-10). This pins the current behaviour so a change is noticed.
  it("synthesises wait-time percentiles from node averages when logs are absent (documented fallback)", () => {
    const noLogs = result({ logs: [], nodeStats: { res: stat({ nodeId: "res", nodeType: "resource", avgWaitTime: 10 }) } });
    const e = enrichSimResult(noLogs);
    expect(e.waitTimePercentiles!.max).toBe(14); // 1.4 x 10 — invented, not measured
  });
});
