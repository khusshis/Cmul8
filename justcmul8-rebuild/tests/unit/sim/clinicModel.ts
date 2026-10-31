/** The clinic model shared by the complex end-to-end test and the on-demand AI evaluation. */
import { enrichSimResult } from "@/lib/simulation/analyticsEngine";
import type { SimGraph, SimResult } from "@/lib/simulation/types";
import { runPython } from "./simpyRunner";

export const MIN = 60;
export function clinic(doctorCapacity = 2, patience = true): SimGraph {
  return {
    nodes: [
      { id: "walk", nodeType: "source", label: "Walk-ins", params: { arrivalRate: 1 / MIN, distribution: "exponential" } },
      { id: "appt", nodeType: "source", label: "Appointments", params: { arrivalRate: 0.5 / MIN, distribution: "exponential" } },
      { id: "qrec", nodeType: "queue", label: "Reception Line", params: { capacity: -1, discipline: "FIFO", patienceDistribution: patience ? "exponential" : "none", patienceTimeout: 30 * MIN } },
      { id: "recA", nodeType: "resource", label: "Reception A", params: { capacity: 1, serviceTimeMean: 1 * MIN, serviceDistribution: "exponential" } },
      { id: "recB", nodeType: "resource", label: "Reception B", params: { capacity: 1, serviceTimeMean: 1 * MIN, serviceDistribution: "exponential" } },
      { id: "triage", nodeType: "decision", label: "Triage", params: { routes: [{ targetId: "qdoc", probability: 0.6 }, { targetId: "pharm", probability: 0.4 }] } },
      { id: "qdoc", nodeType: "queue", label: "Doctor Line", params: { capacity: 15, discipline: "FIFO" } },
      { id: "doc", nodeType: "resource", label: "Doctors", params: { capacity: doctorCapacity, serviceTimeMean: 4 * MIN, serviceDistribution: "exponential", meanTimeBetweenFailures: 120 * MIN, repairTimeMean: 10 * MIN } },
      { id: "pharm", nodeType: "service", label: "Pharmacy", params: { durationMean: 5 * MIN, distribution: "exponential" } },
      { id: "out", nodeType: "sink", label: "Discharged", params: { collectKPIs: true } },
    ],
    edges: [
      ["walk", "qrec"], ["appt", "qrec"], ["qrec", "recA"], ["qrec", "recB"], ["recA", "triage"], ["recB", "triage"],
      ["triage", "qdoc"], ["triage", "pharm"], ["qdoc", "doc"], ["doc", "out"], ["pharm", "out"],
    ].map(([source, target], i) => ({ id: `e${i}`, source, target })),
  };
}

export const T = 8 * 60 * MIN; // an 8-hour day
export function run(graph: SimGraph, seed: number): SimResult {
  const { result, stderr } = runPython(graph, T, seed);
  if (!result) throw new Error(stderr.slice(-500));
  return enrichSimResult({ ...result, simType: "human_queue" }, graph);
}
