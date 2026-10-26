import { describe, expect, it } from "vitest";
import { decisionChoices, effectiveShares } from "@/lib/simulation/decisionRouting";

const isNode = (id: string) => ["a", "b", "c"].includes(id);

describe("decisionChoices (Decision block paths)", () => {
  it("arrows with no routes split evenly", () => {
    expect(decisionChoices([], ["a", "b"], isNode)).toEqual([
      { targetId: "a", probability: 0.5 },
      { targetId: "b", probability: 0.5 },
    ]);
  });

  it("routes covering every arrow are returned unchanged", () => {
    const routes = [{ targetId: "a", probability: 0.25 }, { targetId: "b", probability: 0.75 }];
    expect(decisionChoices(routes, ["a", "b"], isNode)).toEqual(routes);
  });

  it("an unrouted arrow takes the leftover; empty or unknown targets are ignored", () => {
    const routes = [{ targetId: "", probability: 0.5 }, { targetId: "a", probability: 0.2 }, { targetId: "zzz", probability: 0.3 }];
    const shares = effectiveShares(decisionChoices(routes, ["a", "b", "c"], isNode));
    expect(shares.get("a")).toBeCloseTo(0.2);
    expect(shares.get("b")).toBeCloseTo(0.4);
    expect(shares.get("c")).toBeCloseTo(0.4);
  });

  it("effective shares follow the engine's cumulative pick", () => {
    // Over 1: the last path is cut short. Under 1 with nothing left to share: the first path gets the gap.
    expect(effectiveShares([{ targetId: "a", probability: 0.7 }, { targetId: "b", probability: 0.7 }]).get("b")).toBeCloseTo(0.3);
    expect(effectiveShares([{ targetId: "a", probability: 0.2 }, { targetId: "b", probability: 0.3 }]).get("a")).toBeCloseTo(0.7);
  });
});
