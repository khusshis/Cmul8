import { test, expect } from "vitest";
import { mmcWait } from "./analyticsEngine";

test("M/M/c queue wait matches textbook values", () => {
  expect(mmcWait(1, 0.8, 1)).toBeCloseTo(4); // M/M/1: rho/(mu - lambda) = 0.8/0.2
  expect(mmcWait(2, 1.5, 1)).toBeCloseTo(4.5 / 7 / 0.5); // Erlang C = 4.5/7
  expect(mmcWait(2, 2, 1)).toBe(Infinity); // saturated
  expect(mmcWait(3, 0, 1)).toBe(0);
});
