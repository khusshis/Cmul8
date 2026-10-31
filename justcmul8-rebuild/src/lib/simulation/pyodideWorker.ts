/// <reference lib="webworker" />
/**
 * pyodideWorker.ts
 *
 * Persistent Web Worker that hosts the Pyodide WASM runtime.
 * Loaded ONCE at workspace mount. Receives "start/pause/stop" messages
 * and runs generated SimPy scripts inside the Python sandbox.
 */

import { generateSimPyScript } from "./codeGenerator";
import type { SimParams } from "./types";

// Keep in sync with the pyodide devDependency and scripts/vendor (copied by scripts/copy-pyodide.mjs).
const PYODIDE_BASE = "/pyodide/v0.24.1/";
const SIMPY_WHEEL = "simpy-4.1.2-py3-none-any.whl";

let pyodide: any = null;
let pyodideLoading: Promise<void> | null = null;
let stopped = false;

function emit(msg: object) {
  (self as any).postMessage(msg);
}

async function ensurePyodide(): Promise<void> {
  if (pyodide) return;
  if (pyodideLoading) return pyodideLoading;

  pyodideLoading = (async () => {
    emit({ type: "status", phase: "loading_runtime", message: "Loading Pyodide WASM runtime..." });

    // Served from our own origin (scripts/copy-pyodide.mjs), so a CDN or PyPI outage can't stop simulations.
    (self as any).importScripts(`${PYODIDE_BASE}pyodide.js`);
    const py = await (self as any).loadPyodide({ indexURL: PYODIDE_BASE });

    emit({ type: "status", phase: "loading_simpy", message: "Installing SimPy..." });
    await py.loadPackage(`${PYODIDE_BASE}${SIMPY_WHEEL}`);

    // Only publish the runtime once SimPy is installed: a "start" arriving mid-install used to see
    // `pyodide` set, skip the wait and fail with "No module named 'simpy'" (the Monte Carlo lab's
    // fresh engine sends its first run immediately).
    pyodide = py;
    emit({ type: "status", phase: "ready", message: "Pyodide + SimPy ready" });
  })();

  return pyodideLoading;
}

// Pre-load eagerly when worker is created
ensurePyodide().catch((err) => {
  emit({ type: "status", phase: "error", message: String(err) });
});

(self as any).onmessage = async (e: MessageEvent) => {
  const msg = e.data;

  switch (msg.type) {
    case "init":
      await ensurePyodide();
      break;

    case "start": {
      stopped = false;
      const params: SimParams = msg.params;

      try {
        await ensurePyodide();

        const { python } = generateSimPyScript(
          params.graph,
          params.durationSeconds,
          params.tickIntervalSeconds
        );

        // Register callbacks in Python's global namespace
        // Quiet (batch) runs get None: the script then skips building ticks entirely.
        pyodide.globals.set("emit_sim_tick", params.quiet ? null : (tickJson: string) => {
            if (!stopped) emit(JSON.parse(tickJson));
        });
        pyodide.globals.set("emit_sim_result", (resultJson: string) => {
            if (stopped) return;
            const msg = JSON.parse(resultJson);
            // The script labels every result "human_queue"; use the project's real type, or factory,
            // traffic and network runs got people-queue domain cards and wording.
            if (msg?.data) msg.data.simType = params.simType;
            emit(msg);
        });

        // Run the simulation synchronously in Python
        await pyodide.runPythonAsync(python);
        
      } catch (err: any) {
        if (!stopped) {
          emit({ type: "error", message: String(err?.message ?? err) });
        }
      }
      break;
    }

    case "stop":
      stopped = true;
      break;

    case "pause":
      emit({ type: "status", phase: "ready", message: "Pause not supported with SimPy sync mode" });
      break;

    case "resume":
      break;
  }
};
