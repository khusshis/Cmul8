/** Runs the SimPy script generateSimPyScript() emits under local CPython + SimPy (the same text the Pyodide worker runs). */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { generateSimPyScript } from "@/lib/simulation/codeGenerator";
import type { SimGraph, SimResult } from "@/lib/simulation/types";

const PY = process.platform === "win32" ? "python" : "python3";
export const hasSimpy = spawnSync(PY, ["-c", "import simpy"]).status === 0;
const runner = path.resolve(__dirname, "../../fixtures/run_generated.py");
const dir = mkdtempSync(path.join(tmpdir(), "jc8-py-"));
let n = 0;

export function runPython(graph: SimGraph, duration: number, seed = 1): { result: SimResult; stdout: string; stderr: string; status: number | null } {
  const { python } = generateSimPyScript(graph, duration, duration / 1000);
  const file = path.join(dir, `sim${n++}.py`);
  writeFileSync(file, python);
  const r = spawnSync(PY, [runner, file, String(seed)], { encoding: "utf8", timeout: 120_000, maxBuffer: 256 * 1024 * 1024 });
  const last = r.stdout.trim().split("\n").pop() || "null";
  let result: any = null;
  try { result = JSON.parse(last); } catch { /* script failed */ }
  return { result, stdout: r.stdout, stderr: r.stderr, status: r.status };
}
