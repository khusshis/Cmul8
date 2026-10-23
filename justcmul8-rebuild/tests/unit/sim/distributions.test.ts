import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exponential, uniform, normal, deterministic, poisson, sample, sampleDistribution } from "@/lib/simulation/distributions";
import { seededRandom } from "../helpers";

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const draw = (n: number, f: () => number) => Array.from({ length: n }, f);

describe("distributions", () => {
  beforeEach(() => { vi.spyOn(Math, "random").mockImplementation(seededRandom(42)); });
  afterEach(() => vi.restoreAllMocks());

  it("exponential has the requested mean and is non-negative", () => {
    const xs = draw(50_000, () => exponential(4));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(mean(xs)).toBeCloseTo(4, 0);
    expect(Math.abs(mean(xs) - 4) / 4).toBeLessThan(0.02);
  });

  it("exponential(<=0) is 0", () => {
    expect(exponential(0)).toBe(0);
    expect(exponential(-3)).toBe(0);
  });

  it("uniform stays in [min,max] and degenerates to min", () => {
    const xs = draw(10_000, () => uniform(2, 5));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...xs)).toBeLessThanOrEqual(5);
    expect(Math.abs(mean(xs) - 3.5)).toBeLessThan(0.05);
    expect(uniform(5, 5)).toBe(5);
    expect(uniform(7, 3)).toBe(7);
  });

  it("normal is clamped at 0 and centred on the mean", () => {
    const xs = draw(20_000, () => normal(10, 2));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.abs(mean(xs) - 10)).toBeLessThan(0.1);
    expect(draw(200, () => normal(0.1, 5)).every((x) => x >= 0)).toBe(true);
  });

  it("deterministic is constant and clamped", () => {
    expect(deterministic(3.5)).toBe(3.5);
    expect(deterministic(-1)).toBe(0);
  });

  it("poisson inter-arrival has mean 1/lambda; lambda<=0 never arrives", () => {
    expect(Math.abs(mean(draw(20_000, () => poisson(2))) - 0.5)).toBeLessThan(0.02);
    expect(poisson(0)).toBe(Infinity);
  });

  it("sample() dispatches every DistributionType with the right mean", () => {
    for (const t of ["exponential", "uniform", "normal", "deterministic", "poisson"] as const) {
      expect(Math.abs(mean(draw(20_000, () => sample(t, 6))) - 6) / 6, t).toBeLessThan(0.03);
    }
    // unknown type falls back to exponential
    expect(Math.abs(mean(draw(20_000, () => sample("bogus" as any, 6))) - 6) / 6).toBeLessThan(0.03);
  });

  it("sampleDistribution uses explicit bounds for uniform", () => {
    const xs = draw(1000, () => sampleDistribution("uniform", 100, 1, 2));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...xs)).toBeLessThanOrEqual(2);
  });

  // BUG: legacyWorker passes arg3 = 0 for every service/arrival sample, which sample()
  // treats as stdDev = 0, so a "normal" service time has zero variance in the fallback engine.
  // BUG(fallback engine): legacyWorker calls sampleDistribution(dist, mean, 0); sample() treats
  // arg3=0 as stdDev=0, so a "normal" service/arrival time has ZERO variance in the fallback.
  it("sampleDistribution('normal', mean, 0) - as legacyWorker calls it - still has variance", () => {
    const xs = draw(1000, () => sampleDistribution("normal", 10, 0));
    expect(new Set(xs.map((x) => x.toFixed(6))).size).toBeGreaterThan(1);
  });
});
