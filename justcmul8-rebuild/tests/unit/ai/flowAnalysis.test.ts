import { describe, expect, it } from "vitest";
import { analyseFlow } from "@/lib/ai/flowAnalysis";
import { near } from "../helpers";

const node = (id: string, nodeType: string, params: any = {}) => ({ id, nodeType, label: id, params });

describe("analyseFlow", () => {
  it("computes lambda, mu, rho for a simple M/M/1", () => {
    const fa = analyseFlow(
      [node("s", "source", { arrivalRate: 0.8 }), node("r", "resource", { capacity: 1, serviceTimeMean: 1 }), node("k", "sink")],
      [{ source: "s", target: "r" }, { source: "r", target: "k" }]
    );
    expect(fa.converged).toBe(true);
    const r = fa.stations.find((x) => x.id === "r")!;
    expect(r.lambda).toBeCloseTo(0.8);
    expect(r.mu).toBeCloseTo(1);
    expect(r.rho).toBeCloseTo(0.8);
    expect(fa.bottleneck!.id).toBe("r");
    expect(fa.unstable).toEqual([]);
    expect(near(fa.headroomFactor!, 1.25, 0.01)).toBe(true);
  });

  it("splits flow at a decision by probability", () => {
    const fa = analyseFlow(
      [
        node("s", "source", { arrivalRate: 1 }),
        node("d", "decision", { routes: [{ targetId: "a", probability: 0.25 }, { targetId: "b", probability: 0.75 }] }),
        node("a", "resource", { capacity: 1, serviceTimeMean: 1 }),
        node("b", "resource", { capacity: 1, serviceTimeMean: 1 }),
      ],
      [{ source: "s", target: "d" }, { source: "d", target: "a" }, { source: "d", target: "b" }]
    );
    expect(fa.stations.find((x) => x.id === "a")!.lambda).toBeCloseTo(0.25);
    expect(fa.stations.find((x) => x.id === "b")!.lambda).toBeCloseTo(0.75);
  });

  it("a broadcaster clones full rate to every output", () => {
    const fa = analyseFlow(
      [node("s", "source", { arrivalRate: 2 }), node("bc", "broadcaster", {}), node("a", "resource", { capacity: 1, serviceTimeMean: 0.1 }), node("b", "resource", { capacity: 1, serviceTimeMean: 0.1 })],
      [{ source: "s", target: "bc" }, { source: "bc", target: "a" }, { source: "bc", target: "b" }]
    );
    expect(fa.stations.find((x) => x.id === "a")!.lambda).toBeCloseTo(2);
    expect(fa.stations.find((x) => x.id === "b")!.lambda).toBeCloseTo(2);
  });

  it("flags an unstable station (rho >= 1)", () => {
    const fa = analyseFlow(
      [node("s", "source", { arrivalRate: 2 }), node("r", "resource", { capacity: 1, serviceTimeMean: 1 }), node("k", "sink")],
      [{ source: "s", target: "r" }, { source: "r", target: "k" }]
    );
    expect(fa.unstable.map((u) => u.id)).toContain("r");
    expect(fa.headroomFactor!).toBeLessThan(1);
  });

  it("reports non-convergence on a 100% feedback loop and suppresses figures", () => {
    const fa = analyseFlow(
      [node("s", "source", { arrivalRate: 1 }), node("r", "resource", { capacity: 1, serviceTimeMean: 1 })],
      [{ source: "s", target: "r" }, { source: "r", target: "r" }] // self-loop returns all flow
    );
    // self-loops are kept here (flowAnalysis doesn't strip them like repairGraph), so it diverges
    expect(fa.converged).toBe(false);
    expect(fa.warnings.join(" ")).toMatch(/loop/i);
    expect(fa.stations.every((s) => s.rho === undefined)).toBe(true);
  });

  it("empty graph is handled", () => {
    const fa = analyseFlow([], []);
    expect(fa.totalSourceRate).toBe(0);
    expect(fa.stations).toEqual([]);
  });
});
