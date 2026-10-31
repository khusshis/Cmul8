/**
 * One model that uses most of the engine at once, run through the real SimPy script and checked end to end:
 * two arrival streams -> a shared reception line (with patience) -> 2 receptionists -> triage split ->
 * a capped doctor line (turns people away) -> doctors that break down, or -> a pharmacy delay -> exit.
 * Checks the raw counts, the theory where it applies, every card the results panel shows, and that
 * applying the suggested fix actually fixes the problem it names.
 */
import { describe, expect, it } from "vitest";
import { isServerNode, stillInsideCount, lostCount } from "@/lib/simulation/analyticsEngine";
import { resolveKpiMetrics } from "@/lib/simulation/resolveKpiMetrics";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import type { SimResult } from "@/lib/simulation/types";
import { mmc } from "../helpers";
import { hasSimpy } from "./simpyRunner";
import { MIN, T, clinic, run } from "./clinicModel";

describe.skipIf(!hasSimpy)("complex clinic model, end to end", () => {
  const seeds = [1, 2, 3];
  const runs = seeds.map((s) => run(clinic(), s));
  const ns = (r: SimResult) => r.nodeStats;

  it("every entity is accounted for", () => {
    for (const r of runs) {
      const st = Object.values(ns(r));
      expect(ns(r).walk.entitiesOut + ns(r).appt.entitiesOut).toBe(r.totalArrived);
      expect(ns(r).out.entitiesIn).toBe(r.totalCompleted);
      expect(r.totalCompleted + lostCount(r) + stillInsideCount(r)).toBe(r.totalArrived);
      for (const s of st.filter((s) => ["queue", "resource", "service"].includes(s.nodeType))) {
        expect(s.entitiesIn - s.entitiesOut - (s.droppedCount ?? 0) - (s.renegeCount ?? 0), s.label).toBe(s.currentDepth);
      }
      expect(r.timeline.at(-1)!.completed).toBe(r.totalCompleted);
    }
  });

  it("matches theory where it applies: arrivals, the shared reception line (M/M/2) and the triage split", () => {
    const avg = (f: (r: SimResult) => number, rs = runs) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
    // Plain M/M/2 has nobody leaving: with patience on, those who give up are the longest waiters and are
    // missing from "average wait (served)", so compare the same model with patience off.
    const patient = [1, 2, 3, 4].map((s) => run(clinic(2, false), s));
    for (const r of runs) expect(ns(r).qrec.renegeCount, "some give up when patience is on").toBeGreaterThan(0);
    for (const r of patient) expect(ns(r).qrec.renegeCount ?? 0).toBe(0);
    expect(avg((r) => r.totalArrived) / (1.5 * T / MIN)).toBeGreaterThan(0.95);
    expect(avg((r) => r.totalArrived) / (1.5 * T / MIN)).toBeLessThan(1.05);
    const th = mmc(1.5, 1, 2); // per minute: lambda 1.5, mu 1, 2 receptionists
    expect(Math.abs(avg((r) => ns(r).qrec.avgWaitTime, patient) / MIN - th.Wq) / th.Wq).toBeLessThan(0.2);
    expect(Math.abs(avg((r) => (ns(r).recA.utilization + ns(r).recB.utilization) / 2, patient) - th.rho)).toBeLessThan(0.05);
    // The receptionists share one line, so their waits match.
    for (const r of runs) expect(Math.abs(ns(r).recA.avgWaitTime - ns(r).recB.avgWaitTime)).toBeLessThan(0.25 * ns(r).qrec.avgWaitTime + 5);
    const split = avg((r) => ns(r).pharm.entitiesIn / ns(r).triage.entitiesOut);
    expect(Math.abs(split - 0.4)).toBeLessThan(0.03);
    expect(Math.abs(avg((r) => ns(r).pharm.avgServiceTime) - 5 * MIN) / (5 * MIN)).toBeLessThan(0.1);
  });

  it("the overloaded doctors are found and reported consistently", () => {
    for (const r of runs) {
      // Demand 0.9/min x 4 min = 3.6 doctors' worth of work against 2, with breakdowns on top.
      expect(r.bottleneckNodeId).toBe("doc");
      expect(ns(r).doc.utilization).toBeGreaterThan(0.85); // time broken down (~8%) isn't busy time
      expect(ns(r).qdoc.droppedCount).toBeGreaterThan(0);
      expect(ns(r).doc.breakdownCount).toBeGreaterThan(0);
      // Each doctor fails every ~120 min for ~10 min: ~8% down, reported per server (not summed over both).
      const down = r.aiDiagnosis!.recommendations.find((x) => x.title.startsWith("Reduce downtime"));
      if (down) expect(Number(down.impact.match(/(\d+)%/)![1])).toBeLessThanOrEqual(15);
      // Demand exceeds the doctors: the line sits full and turns people away, so the run is not balanced,
      // and the summary says how many left instead of hiding them.
      expect(r.littlesLaw!.isStable).toBe(false);
      expect(r.aiDiagnosis!.summary).toMatch(/left without being served/);
      expect(r.healthScore).toBeLessThan(80);
    }
  });

  it("every KPI card equals an independent calculation from the raw stats", () => {
    const r = runs[0];
    const k = Object.fromEntries(resolveKpiMetrics(SIM_TYPE_REGISTRY.human_queue.kpiMetrics, r).map((x) => [x.key, x]));
    const q = [ns(r).qrec, ns(r).qdoc];
    const wAvg = q.reduce((a, s) => a + s.avgWaitTime * s.entitiesOut, 0) / q.reduce((a, s) => a + s.entitiesOut, 0);
    expect(k.avgWaitTime.value).toBeCloseTo(wAvg / MIN, 1);
    expect(k.currentDepth.value).toBe(ns(r).qrec.currentDepth + ns(r).qdoc.currentDepth);
    const servers = Object.values(ns(r)).filter(isServerNode);
    const capW = servers.reduce((a, s) => a + (s.capacity ?? 1), 0);
    expect(k.utilization.value).toBeCloseTo((servers.reduce((a, s) => a + s.utilization * (s.capacity ?? 1), 0) / capW) * 100, 0);
    expect(k.totalCompleted.value).toBe(r.totalCompleted);
    // The pharmacy delay block has no "busy %", so it is not in the staff figure.
    expect(k.utilization.series!.map((s) => s.name)).not.toContain("Pharmacy");
  });

  it("applying the suggested capacity fix actually fixes the doctors", () => {
    const r = runs[0];
    const recs = r.aiDiagnosis!.recommendations;
    const cap = recs.find((x) => x.fix?.nodeId === "doc");
    expect(cap, JSON.stringify(recs.map((x) => x.title))).toBeTruthy();
    // 3.6 doctors' worth of demand at ~80% busy needs ~5; allow for breakdowns and noise.
    const target = Number(cap!.fix!.paramPatch.capacity);
    expect(target).toBeGreaterThanOrEqual(4);
    expect(target).toBeLessThanOrEqual(7);
    // Same seeds, fixed model: the line stops overflowing and the doctors drop out of overload.
    const after = seeds.map((s) => run(clinic(target), s));
    for (const [i, a] of after.entries()) {
      expect(ns(a).qdoc.droppedCount ?? 0).toBeLessThan(0.2 * (ns(runs[i]).qdoc.droppedCount ?? 0) + 2);
      expect(ns(a).doc.utilization).toBeLessThan(0.9);
      expect(ns(a).qdoc.avgWaitTime).toBeLessThan(ns(runs[i]).qdoc.avgWaitTime * 0.5);
      expect(a.totalCompleted).toBeGreaterThan(runs[i].totalCompleted);
      expect(a.healthScore!).toBeGreaterThan(runs[i].healthScore!);
    }
  });
});
