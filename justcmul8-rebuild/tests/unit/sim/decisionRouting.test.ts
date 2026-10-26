import { describe, expect, it } from "vitest";
import { decisionChoices, effectiveShares, routingWarning } from "@/lib/simulation/decisionRouting";

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

describe("routingWarning (TC-21: chances that don't add up)", () => {
  it("warns when every arrow has a chance and they don't total 100%", () => {
    expect(routingWarning([{ targetId: "a", probability: 0.7 }, { targetId: "b", probability: 0.4 }], ["a", "b"], isNode)).toMatch(/110%/);
    expect(routingWarning([{ targetId: "a", probability: 0.5 }, { targetId: "b", probability: 0.3 }], ["a", "b"], isNode)).toMatch(/80%/);
  });

  it("warns when set chances leave nothing for Auto arrows", () => {
    expect(routingWarning([{ targetId: "a", probability: 1.2 }], ["a", "b"], isNode)).toMatch(/Auto get nothing/);
  });

  it("is quiet for valid routing, arrows-only decisions and rounding noise", () => {
    expect(routingWarning([{ targetId: "a", probability: 0.25 }, { targetId: "b", probability: 0.75 }], ["a", "b"], isNode)).toBeNull();
    expect(routingWarning([], ["a", "b"], isNode)).toBeNull();
    expect(routingWarning([{ targetId: "a", probability: 0.3 }], ["a", "b"], isNode)).toBeNull();
    expect(routingWarning([{ targetId: "a", probability: 0.333 }, { targetId: "b", probability: 0.333 }, { targetId: "c", probability: 0.334 }], ["a", "b", "c"], isNode)).toBeNull();
  });
});
