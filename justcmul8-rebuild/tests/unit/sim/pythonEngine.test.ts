/**
 * The production engine: the SimPy script generateSimPyScript() emits (the same text the
 * Pyodide worker runs), executed under local CPython + SimPy and checked against
 * M/M/1 and M/M/c (Erlang C) theory. Skipped when python/simpy are not installed.
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { generateSimPyScript } from "@/lib/simulation/codeGenerator";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import type { SimGraph, SimResult } from "@/lib/simulation/types";
import { mm1, mmc, queueGraph } from "../helpers";

const PY = process.platform === "win32" ? "python" : "python3";
const hasSimpy = spawnSync(PY, ["-c", "import simpy"]).status === 0;
const runner = path.resolve(__dirname, "../../fixtures/run_generated.py");
const dir = mkdtempSync(path.join(tmpdir(), "jc8-py-"));
let n = 0;

function runPython(graph: SimGraph, duration: number, seed = 1): { result: SimResult; stdout: string; stderr: string; status: number | null } {
  const { python } = generateSimPyScript(graph, duration, duration / 1000);
  const file = path.join(dir, `sim${n++}.py`);
  writeFileSync(file, python);
  const r = spawnSync(PY, [runner, file, String(seed)], { encoding: "utf8", timeout: 120_000, maxBuffer: 256 * 1024 * 1024 });
  const last = r.stdout.trim().split("\n").pop() || "null";
  let result: any = null;
  try { result = JSON.parse(last); } catch { /* script failed */ }
  return { result, stdout: r.stdout, stderr: r.stderr, status: r.status };
}

describe.skipIf(!hasSimpy)("SimPy engine (generated script) vs queueing theory", () => {
  it("M/M/1 rho=0.8: utilisation +/-4%, Wq +/-15%", () => {
    const th = mm1(0.8, 1);
    const { result, stderr } = runPython(queueGraph(0.8, 1), 40_000, 3);
    expect(result, stderr).toBeTruthy();
    const res = result.nodeStats.res;
    expect(Math.abs(res.utilization - th.rho) / th.rho).toBeLessThan(0.04);
    expect(Math.abs(res.avgWaitTime - th.Wq) / th.Wq).toBeLessThan(0.15);
    expect(result.totalCompleted).toBeLessThanOrEqual(result.totalArrived);
  });

  it("M/M/3 rho=0.8: per-server utilisation +/-4%, Erlang-C Wq +/-15%", () => {
    const th = mmc(2.4, 1, 3);
    const { result, stderr } = runPython(queueGraph(2.4, 1, 3), 40_000, 4);
    expect(result, stderr).toBeTruthy();
    const res = result.nodeStats.res;
    expect(Math.abs(res.utilization - th.rho) / th.rho).toBeLessThan(0.04);
    expect(Math.abs(res.avgWaitTime - th.Wq) / th.Wq).toBeLessThan(0.15);
  });

  it("overloaded M/M/1 (rho=2) completes ~mu*T and builds a backlog", () => {
    const { result } = runPython(queueGraph(2, 1), 2000, 5);
    expect(result.totalCompleted / 2000).toBeGreaterThan(0.9);
    expect(result.totalCompleted / 2000).toBeLessThan(1.05);
    expect(result.totalArrived - result.totalCompleted).toBeGreaterThan(1500);
  });

  it("every registry starter template runs to completion", () => {
    for (const cfg of Object.values(SIM_TYPE_REGISTRY)) {
      for (const sc of cfg.subScenarios) {
        const graph: SimGraph = { nodes: sc.nodes as any, edges: sc.edges };
        const { result, stderr } = runPython(graph, 600, 1);
        expect(result, `${cfg.id} / ${sc.label}: ${stderr.slice(-400)}`).toBeTruthy();
        expect(result.totalSimTime, `${cfg.id} / ${sc.label}`).toBeGreaterThan(0);
      }
    }
  });

  // SECURITY: generateSimPyScript uses String.replace(pattern, string), which expands
  // "$`", "$'" and "$&" inside the replacement. A block label containing "$`" pastes the
  // template prefix (ending in r""") into the JSON literal, closing the Python string, so
  // the rest of the label runs as Python in every collaborator's Pyodide worker.
  it("a block label cannot inject Python into the generated script", () => {
    const g = queueGraph(0.5, 1);
    g.nodes[0].label = "$` if print('JC8_'+'INJECTED') else '{}');#"; // marker only appears if the code runs
    const { stdout } = runPython(g, 50, 1);
    expect(stdout).not.toContain("JC8_INJECTED");
  });
});
