/**
 * Pure RNG distribution functions for the simulation engine.
 * All functions return a non-negative sample in simulation time units.
 * Seeded via Math.random() — deterministic seed can be added later.
 */

import type { DistributionType } from "./types";

/** Exponential distribution: mean = 1/lambda */
export function exponential(mean: number): number {
  if (mean <= 0) return 0;
  return -mean * Math.log(1 - Math.random());
}

/** Uniform distribution: sample in [min, max] */
export function uniform(min: number, max: number): number {
  if (min >= max) return min;
  return min + Math.random() * (max - min);
}

/** Normal distribution (Box-Muller transform) */
export function normal(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const sample = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return Math.max(0, mean + stdDev * sample);
}

/** Deterministic (constant) — no randomness */
export function deterministic(value: number): number {
  return Math.max(0, value);
}

/** Poisson inter-arrival time (exponential with rate lambda) */
export function poisson(lambda: number): number {
  if (lambda <= 0) return Infinity;
  return exponential(1 / lambda);
}

/**
 * Sample from a named distribution.
 * @param type  Distribution type from DistributionType
 * @param mean  Mean / primary parameter
 * @param std   Standard deviation (for 'normal' only)
 */
export function sample(
  type: DistributionType,
  mean: number,
  std: number = mean * 0.3
): number {
  switch (type) {
    case "exponential": return exponential(mean);
    case "uniform":     return uniform(mean * 0.5, mean * 1.5);
    case "normal":      return normal(mean, std);
    case "deterministic": return deterministic(mean);
    case "poisson":     return poisson(1 / mean);
    default:            return exponential(mean);
  }
}

/**
 * Compatible wrapper used by worker.ts
 */
export function sampleDistribution(
  type: DistributionType = "exponential",
  mean: number,
  arg3?: number,
  arg4?: number
): number {
  if (type === "uniform" && arg3 !== undefined && arg4 !== undefined) {
    return uniform(arg3, arg4);
  }
  return sample(type, mean, arg3);
}
