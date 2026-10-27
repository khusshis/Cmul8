import { describe, expect, it } from "vitest";
import { bestRateUnit, bestTimeUnit, fmtDuration, fmtPerTime, paramKind, tidy, unitSeconds } from "@/lib/simulation/units";

describe("human units for block inputs (engine stays in seconds)", () => {
  it("picks the unit a person would say", () => {
    expect(bestTimeUnit(45)).toBe("sec");
    expect(bestTimeUnit(300)).toBe("min");
    expect(bestTimeUnit(4 * 3600)).toBe("hr");
    expect(bestRateUnit(2)).toBe("sec");
    expect(bestRateUnit(2 / 60)).toBe("min");
    expect(bestRateUnit(30 / 3600)).toBe("hr");
  });

  it("round-trips a typed value without float noise", () => {
    const perSecond = 30 / unitSeconds("hr"); // "30 per hour" typed in the panel
    expect(tidy(perSecond * unitSeconds("hr"))).toBe(30);
    expect(tidy((5 * 60) / unitSeconds("min"))).toBe(5);
  });

  it("formats templates' values readably", () => {
    expect(fmtPerTime(2 / 60)).toBe("2 per minute");
    expect(fmtPerTime(30 / 3600)).toBe("30 per hour");
    expect(fmtDuration(5 * 60)).toBe("5 min");
    expect(fmtDuration(30)).toBe("30 sec");
  });

  it("knows which params are times and rates", () => {
    expect(paramKind("serviceTimeMean")).toBe("time");
    expect(paramKind("arrivalRate")).toBe("rate");
    expect(paramKind("capacity")).toBeNull();
  });
});
