import { describe, expect, it } from "vitest";
import { invalidParamMessage, invalidParamsChange } from "@/lib/simulation/paramRules";

describe("invalidParamMessage (TC-19: bad values in the properties panel)", () => {
  it("rejects a zero or negative capacity on a server", () => {
    expect(invalidParamMessage("resource", "capacity", 0)).toMatch(/at least 1/);
    expect(invalidParamMessage("resource", "capacity", -3)).toMatch(/at least 1/);
    expect(invalidParamMessage("resource", "capacity", 2.5)).toMatch(/whole number/);
    expect(invalidParamMessage("resource", "capacity", 3)).toBeNull();
  });

  it("lets lines use -1 for unlimited but nothing else below 1", () => {
    expect(invalidParamMessage("queue", "capacity", -1)).toBeNull();
    expect(invalidParamMessage("queue", "capacity", 0)).toMatch(/-1 for unlimited/);
    expect(invalidParamMessage("container", "capacity", 0)).toMatch(/greater than 0/);
  });

  it("rejects negative times and rates, allows zero", () => {
    expect(invalidParamMessage("resource", "serviceTimeMean", -1)).toMatch(/negative/);
    expect(invalidParamMessage("source", "arrivalRate", -0.2)).toMatch(/negative/);
    expect(invalidParamMessage("source", "arrivalRate", 0)).toBeNull();
    expect(invalidParamMessage("resource", "serviceTimeMean", Number.NaN)).toMatch(/number/);
  });

  it("only checks the keys an edit changed", () => {
    expect(invalidParamsChange("resource", { capacity: 0 }, { capacity: 0, serviceTimeMean: 4 })).toBeNull();
    expect(invalidParamsChange("resource", { capacity: 2 }, { capacity: 0 })).toMatch(/at least 1/);
  });
});
