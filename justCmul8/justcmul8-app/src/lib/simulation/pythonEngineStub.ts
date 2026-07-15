/**
 * PythonSimEngine — Future backend swap stub.
 *
 * Implements the SimulationEngine interface but routes simulation requests
 * to a Python FastAPI backend via Server-Sent Events (SSE).
 *
 * To activate: replace `new ClientSimEngine()` with `new PythonSimEngine()`
 * in the workspace page. Zero UI changes needed.
 *
 * Backend expected endpoints:
 *   POST /api/simulate/start   → { runId: string }
 *   GET  /api/simulate/stream?runId=xxx → SSE stream of SimTick + SimResult
 *   POST /api/simulate/stop    → { ok: true }
 */

import type { SimulationEngine, SimParams, SimTick, SimResult } from "./types";

export class PythonSimEngine implements SimulationEngine {
  private tickCallback: ((tick: SimTick) => void) | null = null;
  private completeCallback: ((result: SimResult) => void) | null = null;
  private errorCallback: ((error: string) => void) | null = null;
  private eventSource: EventSource | null = null;
  private runId: string | null = null;
  private running = false;

  onTick(callback: (tick: SimTick) => void): void {
    this.tickCallback = callback;
  }

  onComplete(callback: (result: SimResult) => void): void {
    this.completeCallback = callback;
  }

  onError(callback: (error: string) => void): void {
    this.errorCallback = callback;
  }

  async start(params: SimParams): Promise<void> {
    try {
      // Start the simulation on the backend
      const res = await fetch("/api/simulate/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const { runId, error } = await res.json();
      if (error) throw new Error(error);

      this.runId = runId;
      this.running = true;

      // Open SSE stream for tick events
      this.eventSource = new EventSource(`/api/simulate/stream?runId=${runId}`);

      this.eventSource.addEventListener("tick", (e) => {
        const tick: SimTick = JSON.parse((e as MessageEvent).data);
        this.tickCallback?.(tick);
      });

      this.eventSource.addEventListener("complete", (e) => {
        const result: SimResult = JSON.parse((e as MessageEvent).data);
        this.running = false;
        this.eventSource?.close();
        this.completeCallback?.(result);
      });

      this.eventSource.addEventListener("error", (e) => {
        const msg = (e as MessageEvent).data || "Backend simulation error";
        this.running = false;
        this.eventSource?.close();
        this.errorCallback?.(msg);
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start simulation";
      this.errorCallback?.(msg);
    }
  }

  pause(): void {
    // TODO: implement via POST /api/simulate/pause
    console.warn("[PythonSimEngine] pause() not yet implemented");
  }

  resume(): void {
    // TODO: implement via POST /api/simulate/resume
    console.warn("[PythonSimEngine] resume() not yet implemented");
  }

  stop(): void {
    this.running = false;
    this.eventSource?.close();
    this.eventSource = null;
    if (this.runId) {
      fetch("/api/simulate/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: this.runId }),
      }).catch(console.error);
      this.runId = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }
}
