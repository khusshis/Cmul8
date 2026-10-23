/**
 * pyodideEngine.ts
 *
 * SimulationEngine implementation that routes simulation runs through
 * the persistent pyodideWorker.ts (Pyodide + SimPy runtime).
 */

import type { SimulationEngine, SimParams, SimTick, SimResult, PyodideStatus } from "./types";
import { ClientSimEngine } from "./clientEngine";

type WorkerMessage =
  | { type: "tick"; data: SimTick }
  | { type: "complete"; data: SimResult }
  | { type: "error"; message: string }
  | ({ type: "status" } & PyodideStatus);

export class PyodideSimEngine implements SimulationEngine {
  private worker: Worker | null = null;
  private running = false;
  private useFallback = false;
  /** The fallback engine of the current run, so stop()/destroy() can reach it. */
  private legacy: ClientSimEngine | null = null;

  private onTickCallbacks    = new Set<(tick: SimTick) => void>();
  private onCompleteCallbacks = new Set<(result: SimResult) => void>();
  private onErrorCallbacks   = new Set<(error: string) => void>();
  private onStatusCallbacks  = new Set<(status: PyodideStatus) => void>();

  init(): void {
    if (this.worker) return;
    this.worker = new Worker(
      new URL("./pyodideWorker.ts", import.meta.url),
      { type: "module" }
    );
    this.worker.onmessage = (e: MessageEvent) => this.handleMessage(e.data);
    this.worker.onerror = (e) => {
      this.onErrorCallbacks.forEach(cb => cb(e.message));
    };
    this.worker.postMessage({ type: "init" });
  }

  private handleMessage(msg: WorkerMessage) {
    switch (msg.type) {
      case "tick":
        this.onTickCallbacks.forEach(cb => cb(msg.data));
        break;
      case "complete":
        this.running = false;
        this.onCompleteCallbacks.forEach(cb => cb({ ...msg.data, engine: "pyodide" }));
        break;
      case "error":
        this.running = false;
        this.onErrorCallbacks.forEach(cb => cb(msg.message));
        break;
      case "status": {
        const statusMsg = { ...msg };
        if (msg.phase === "error") {
          console.warn("[PyodideSimEngine] Falling back to legacy TS engine due to pyodide init error");
          this.useFallback = true;
          statusMsg.fallbackActive = true;
        }
        this.onStatusCallbacks.forEach(cb => cb(statusMsg));
        break;
      }
    }
  }

  start(params: SimParams): void {
    if (this.useFallback) {
      console.log("Using legacy fallback engine");
      this.legacy?.stop();
      const legacy = new ClientSimEngine();
      this.legacy = legacy;
      legacy.onTick(tick => this.onTickCallbacks.forEach(cb => cb(tick)));
      legacy.onComplete(res => this.onCompleteCallbacks.forEach(cb => cb({ ...res, engine: "legacy" })));
      legacy.onError(err => this.onErrorCallbacks.forEach(cb => cb(err)));
      legacy.start(params);
      return;
    }
    
    if (!this.worker) this.init();
    this.running = true;
    this.worker!.postMessage({ type: "start", params });
  }

  // Each register call returns an unsubscribe function, so short-lived listeners
  // (e.g. one Monte Carlo batch) don't pile up on a long-lived engine.
  onTick(callback: (tick: SimTick) => void): () => void {
    this.onTickCallbacks.add(callback);
    return () => { this.onTickCallbacks.delete(callback); };
  }

  onComplete(callback: (result: SimResult) => void): () => void {
    this.onCompleteCallbacks.add(callback);
    return () => { this.onCompleteCallbacks.delete(callback); };
  }

  onError(callback: (error: string) => void): () => void {
    this.onErrorCallbacks.add(callback);
    return () => { this.onErrorCallbacks.delete(callback); };
  }

  onStatus(callback: (status: PyodideStatus) => void): () => void {
    this.onStatusCallbacks.add(callback);
    return () => { this.onStatusCallbacks.delete(callback); };
  }

  pause(): void {
    this.worker?.postMessage({ type: "pause" });
  }

  resume(): void {
    this.worker?.postMessage({ type: "resume" });
  }

  stop(): void {
    this.running = false;
    this.legacy?.stop();
    this.legacy = null;
    this.worker?.postMessage({ type: "stop" });
  }

  isRunning(): boolean {
    return this.running;
  }

  updateSpeed(multiplier: number): void {
    this.worker?.postMessage({ type: "set_speed", multiplier });
  }

  destroy(): void {
    this.stop();
    this.worker?.terminate();
    this.worker = null;
  }
}
