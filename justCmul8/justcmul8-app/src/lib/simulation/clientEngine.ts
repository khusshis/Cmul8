/**
 * clientEngine.ts
 *
 * Implements the SimulationEngine interface using a local Web Worker.
 * This runs the simulation heavy lifting off the main thread, keeping the UI
 * absolutely smooth while allowing thousands of events per second.
 */

import type { SimulationEngine, SimParams, SimTick, SimResult } from "./types";

export class ClientSimEngine implements SimulationEngine {
  private worker: Worker | null = null;
  private running = false;

  private onTickCallbacks = new Set<(tick: SimTick) => void>();
  private onCompleteCallbacks = new Set<(result: SimResult) => void>();
  private onErrorCallbacks = new Set<(error: string) => void>();

  /** Start or restart the simulation with new params */
  start(params: SimParams): void {
    this.stop(); // clear old worker if exists

    // Initialize Web Worker
    this.worker = new Worker(new URL("./legacyWorker.ts", import.meta.url), { type: "module" });

    this.worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      switch (msg.type) {
        case "tick":
          this.onTickCallbacks.forEach(cb => cb(msg.data));
          break;
        case "complete":
          this.running = false;
          this.onCompleteCallbacks.forEach(cb => cb(msg.data));
          this.terminateWorker();
          break;
        case "error":
          this.running = false;
          this.onErrorCallbacks.forEach(cb => cb(msg.message));
          this.terminateWorker();
          break;
      }
    };

    this.worker.onerror = (e) => {
        this.running = false;
        this.onErrorCallbacks.forEach(cb => cb(e.message));
        this.terminateWorker();
    }

    this.running = true;
    this.worker.postMessage({ type: "start", params });
  }

  onTick(callback: (tick: SimTick) => void): void {
    this.onTickCallbacks.add(callback);
  }

  onComplete(callback: (result: SimResult) => void): void {
    this.onCompleteCallbacks.add(callback);
  }

  onError(callback: (error: string) => void): void {
    this.onErrorCallbacks.add(callback);
  }

  pause(): void {
    if (!this.running || !this.worker) return;
    this.worker.postMessage({ type: "pause" });
  }

  resume(): void {
    if (!this.running || !this.worker) return;
    this.worker.postMessage({ type: "resume" });
  }

  updateSpeed(multiplier: number): void {
    if (!this.worker) return;
    this.worker.postMessage({ type: "set_speed", multiplier });
  }

  stop(): void {
    if (this.worker) {
      this.worker.postMessage({ type: "stop" });
      this.terminateWorker();
    }
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  private terminateWorker() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
