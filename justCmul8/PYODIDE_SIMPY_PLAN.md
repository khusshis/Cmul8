# JustCmul8 — Pyodide + SimPy Engine Implementation Plan

> **Purpose**: Step-by-step technical specification for replacing the TypeScript DES engine
> (`src/lib/simulation/worker.ts`) with a real in-browser Pyodide + SimPy runtime, while
> keeping the entire UI layer **unchanged**. Any agent can read this document and execute
> the plan without prior context of the codebase.

---

## Background & Architecture Context

### What Exists Today

```
┌─────────────────────────────────────────────────────────────┐
│ UI Layer (Next.js + React)                                   │
│   WorkspacePage → ClientSimEngine → Web Worker (worker.ts)  │
│                                           │                  │
│                     TypeScript DES Engine │ (hand-rolled)    │
│   SimTick / SimResult ◄──────────────────┘                  │
│   ViewportPanel (Pixi.js) ← SceneManager ← EntityAnimator   │
└─────────────────────────────────────────────────────────────┘
```

### What We Are Building

```
┌─────────────────────────────────────────────────────────────┐
│ UI Layer (unchanged)                                         │
│   WorkspacePage → PyodideSimEngine → pyodideWorker.ts       │
│                                           │                  │
│                        Pyodide WASM Runtime                  │
│                        + micropip install simpy              │
│                        + Python codegen from SimGraph        │
│   SimTick / SimResult ◄──────────────────┘                  │
│   ViewportPanel (Pixi.js) ← SceneManager ← EntityAnimator   │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Principles
1. **Zero UI changes**: `SimulationEngine` interface in `types.ts` is the contract.
   The new `PyodideSimEngine` implements it exactly like `ClientSimEngine`.
2. **Single Web Worker**: Pyodide WASM runtime is heavy (~10 MB). Load it once per
   session in a dedicated persistent worker, not per-run.
3. **Python code is generated from `SimGraph`**:  A TypeScript function translates
   the user's node graph → a self-contained SimPy Python script string,
   which is injected into Pyodide at runtime.
4. **SimLog parity**: The generated Python program emits the exact same `SimLog`
   event names (`arrived`, `queued`, `service_start`, ...) as the current TS engine,
   so `SceneManager`/`EntityAnimator` need zero changes.
5. **Fallback**: Keep `worker.ts` (TypeScript engine) available as `legacyWorker.ts`.
   If Pyodide fails to load (e.g., no internet for CDN), fall back gracefully.

---

## File Inventory

### Files to CREATE (new)
| File | Role |
|------|------|
| `src/lib/simulation/pyodideWorker.ts` | New Web Worker: loads Pyodide + SimPy, runs generated Python |
| `src/lib/simulation/pyodideEngine.ts` | `SimulationEngine` implementation that talks to `pyodideWorker.ts` |
| `src/lib/simulation/codeGenerator.ts` | Converts `SimGraph` → Python/SimPy script string |
| `src/lib/simulation/simTemplates/` | Directory of reusable Python SimPy code snippets |
| `src/lib/simulation/simTemplates/base.py` | Base SimPy helpers (distributions, logger class) |
| `src/lib/simulation/simTemplates/nodes/source.py` | Source node template |
| `src/lib/simulation/simTemplates/nodes/queue.py` | Queue/Resource node templates |
| `src/lib/simulation/simTemplates/nodes/resource.py` | Resource template |
| `src/lib/simulation/simTemplates/nodes/sink.py` | Sink + KPI collector |
| `src/lib/simulation/simTemplates/nodes/decision.py` | Probabilistic router |
| `public/pyodide-init.js` | (Optional) Custom preload script — not needed if using CDN |

### Files to MODIFY (existing)
| File | Change |
|------|--------|
| `src/app/dashboard/project/[id]/page.tsx` | Swap `ClientSimEngine` → `PyodideSimEngine` import |
| `src/lib/simulation/clientEngine.ts` | No change needed — keep as legacy fallback |
| `src/lib/simulation/worker.ts` | Rename → `legacyWorker.ts` for fallback use |
| `src/lib/simulation/types.ts` | Add `PyodideStatus` type for loading state events |
| `next.config.ts` | Add headers for `Cross-Origin-Opener-Policy` (required for SharedArrayBuffer) |
| `src/components/workspace/ViewportPanel.tsx` | Show Pyodide loading spinner/status while WASM loads |
| `src/components/layout/PreLoader.tsx` | Update "LOADING PYODIDE WASM..." to be genuinely accurate |

### Files to LEAVE UNCHANGED
- `src/lib/pixi/sceneManager.ts` — consumes `SimTick.recentLogs`, no changes needed
- `src/lib/pixi/entityAnimator.ts` — no changes needed
- `src/lib/simulation/types.ts` (mostly) — only adding new status type
- All React components except WorkspacePage and ViewportPanel

---

## Step-by-Step Implementation

---

### STEP 1 — Add COOP/COEP Headers to Next.js Config

**File**: `next.config.ts`

Pyodide requires `SharedArrayBuffer` for full functionality, which requires
`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`
headers. Without this, Pyodide still works but is ~30% slower.

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
```

> **Warning**: COEP `require-corp` can break third-party scripts/iframes (Supabase auth, 
> Google Fonts CDN, etc.). Test thoroughly after adding. If it breaks auth redirects,
> use `credentialless` instead of `require-corp`. SharedArrayBuffer is a nice-to-have;
> Pyodide works fine without it.

---

### STEP 2 — Add Pyodide Status Type to `types.ts`

**File**: `src/lib/simulation/types.ts`

Add at the bottom:

```typescript
// ─── Pyodide Runtime Status ───────────────────────────────────────────────────
// Emitted by PyodideSimEngine so the UI can show a loading indicator
// while the ~10 MB WASM binary is being downloaded and initialized.

export interface PyodideStatus {
  phase: "idle" | "loading_runtime" | "loading_simpy" | "ready" | "error";
  message?: string;        // Human-readable status e.g. "Installing simpy..."
  progress?: number;       // 0–100 (optional progress for loading bar)
}
```

---

### STEP 3 — Write the Python Code Generator

**File**: `src/lib/simulation/codeGenerator.ts`

This is the most critical piece. It translates the `SimGraph` data structure into
a self-contained Python SimPy simulation script string.

#### 3a. Understand the SimGraph structure

A `SimGraph` has:
```typescript
interface SimGraph {
  nodes: SimNode[];   // id, nodeType, label, params, position
  edges: SimEdge[];   // id, source (nodeId), target (nodeId)
}
```

#### 3b. Python script structure to generate

The generated script must:
1. `import simpy, random, json, sys` — standard imports
2. Define a `LOG_BUFFER = []` list and a `log(entity_id, node_id, node_label, event)` helper
3. Define helper functions for each distribution (exponential, uniform, normal, etc.)
4. Define SimPy `process` functions for each node type (source, resource, queue, sink, decision)
5. Define a `setup(env, graph_config)` function that instantiates SimPy resources per node
6. Run `env.run(until=DURATION)`
7. Print a JSON result dict to stdout that the JS side parses

#### 3c. Full codeGenerator.ts specification

```typescript
// src/lib/simulation/codeGenerator.ts

import type { SimGraph, SimNode, SimEdge, NodeType } from "./types";

export interface GeneratedScript {
  python: string;         // The complete Python script string
  nodeIdMap: Record<string, string>;  // JS node ID → Python-safe variable name
}

/**
 * Translate a SimGraph → a self-contained SimPy Python script string.
 * The script will:
 *  - Run the full DES simulation
 *  - Emit log lines as JSON to a log buffer
 *  - Print a final result JSON to stdout when done
 *
 * @param graph     The user's simulation graph
 * @param duration  Simulation duration in sim-time units
 * @param tickInterval  How often to checkpoint (for live ticking)
 * @param speedMultiplier  Ignored in Python (Pyodide runs as fast as possible)
 */
export function generateSimPyScript(
  graph: SimGraph,
  duration: number,
  tickInterval: number,
  speedMultiplier: number
): GeneratedScript {
  // ... implementation below
}
```

#### 3d. Python template to generate

The top-level generated script looks like this (as a template):

```python
# AUTO-GENERATED by JustCmul8 codeGenerator.ts — DO NOT EDIT
import simpy
import random
import json
import sys
import math

# ── Configuration ──────────────────────────────────────────────────────────────
DURATION = {DURATION}
TICK_INTERVAL = {TICK_INTERVAL}
NODE_CONFIG = {NODE_CONFIG_JSON}     # dict of nodeId -> {nodeType, label, params}
EDGES = {EDGES_JSON}                 # list of {id, source, target}

# ── Log Buffer ─────────────────────────────────────────────────────────────────
log_buffer = []
tick_buffer = []     # list of tick snapshots for the JS side
entity_counter = [0]
stats = {}           # nodeId -> dict of running stats

def next_entity_id():
    entity_counter[0] += 1
    return entity_counter[0]

def log_event(sim_time, entity_id, node_id, node_label, event):
    log_buffer.append({
        "simTime": sim_time,
        "entityId": entity_id,
        "nodeId": node_id,
        "nodeLabel": node_label,
        "event": event
    })

# ── Distributions ──────────────────────────────────────────────────────────────
def sample(dist_type, mean, std=None):
    if dist_type == "exponential":
        return random.expovariate(1.0 / mean) if mean > 0 else 0
    elif dist_type == "uniform":
        return random.uniform(mean * 0.5, mean * 1.5)
    elif dist_type == "normal":
        s = std if std is not None else mean * 0.3
        return max(0, random.gauss(mean, s))
    elif dist_type == "deterministic":
        return max(0, mean)
    elif dist_type == "poisson":
        return random.expovariate(1.0 / mean) if mean > 0 else 0
    else:
        return random.expovariate(1.0 / mean) if mean > 0 else 0

# ── Build adjacency ────────────────────────────────────────────────────────────
out_edges = {}   # nodeId -> [targetNodeId, ...]
for edge in EDGES:
    src = edge["source"]
    if src not in out_edges:
        out_edges[src] = []
    out_edges[src].append(edge["target"])

rr_counters = {}  # round-robin per node
def get_next_target(node_id):
    targets = out_edges.get(node_id, [])
    if not targets:
        return None
    if len(targets) == 1:
        return targets[0]
    if node_id not in rr_counters:
        rr_counters[node_id] = 0
    idx = rr_counters[node_id] % len(targets)
    rr_counters[node_id] += 1
    return targets[idx]

def get_target_for_decision(node_id):
    cfg = NODE_CONFIG[node_id]
    routes = cfg["params"].get("routes", [])
    r = random.random()
    cum = 0.0
    for route in routes:
        cum += route["probability"]
        if r <= cum:
            return route["targetId"]
    return routes[0]["targetId"] if routes else None

# ── Stats helpers ──────────────────────────────────────────────────────────────
def init_stats():
    for nid, cfg in NODE_CONFIG.items():
        stats[nid] = {
            "nodeId": nid,
            "nodeType": cfg["nodeType"],
            "label": cfg["label"],
            "entitiesIn": 0,
            "entitiesOut": 0,
            "currentDepth": 0,
            "busyCount": 0,
            "capacity": cfg["params"].get("capacity", 1),
            "waits": [],
            "services": [],
            "utilization": 0.0,
            "avgWaitTime": 0.0,
            "avgServiceTime": 0.0,
        }

def snapshot_stats(env):
    snap = {}
    for nid, s in stats.items():
        util = s["busyCount"] / max(1, s["capacity"]) if s["capacity"] > 0 else 0
        snap[nid] = {
            "nodeId": nid,
            "nodeType": s["nodeType"],
            "label": s["label"],
            "entitiesIn": s["entitiesIn"],
            "entitiesOut": s["entitiesOut"],
            "currentDepth": s["currentDepth"],
            "utilization": min(1.0, util),
            "avgWaitTime": sum(s["waits"]) / len(s["waits"]) if s["waits"] else 0,
            "avgServiceTime": sum(s["services"]) / len(s["services"]) if s["services"] else 0,
        }
    return snap

# ── SimPy Processes ────────────────────────────────────────────────────────────

def entity_process(env, eid, node_id, resources):
    """Route an entity through the graph from the given node."""
    cfg = NODE_CONFIG.get(node_id)
    if cfg is None:
        return

    node_type = cfg["nodeType"]
    label = cfg["label"]
    s = stats[node_id]
    s["entitiesIn"] += 1
    s["currentDepth"] += 1

    if node_type == "source":
        # Source just passes through immediately
        log_event(env.now, eid, node_id, label, "arrived")
        s["currentDepth"] -= 1
        s["entitiesOut"] += 1
        next_id = get_next_target(node_id)
        if next_id:
            yield env.process(entity_process(env, eid, next_id, resources))

    elif node_type == "queue":
        log_event(env.now, eid, node_id, label, "queued")
        # Queue is pass-through; resource below holds entity
        s["currentDepth"] -= 1
        s["entitiesOut"] += 1
        next_id = get_next_target(node_id)
        if next_id:
            yield env.process(entity_process(env, eid, next_id, resources))

    elif node_type in ("resource", "priority_resource"):
        params = cfg["params"]
        res = resources[node_id]
        queued_at = env.now
        log_event(env.now, eid, node_id, label, "queued")
        with res.request() as req:
            yield req
            wait_time = env.now - queued_at
            s["waits"].append(wait_time)
            s["busyCount"] += 1
            svc_time = sample(
                params.get("serviceDistribution", "exponential"),
                params.get("serviceTimeMean", 1)
            )
            log_event(env.now, eid, node_id, label, "service_start")
            yield env.timeout(svc_time)
            s["services"].append(svc_time)
            s["busyCount"] -= 1
            log_event(env.now, eid, node_id, label, "service_end")
        s["currentDepth"] -= 1
        s["entitiesOut"] += 1
        next_id = get_next_target(node_id)
        if next_id:
            yield env.process(entity_process(env, eid, next_id, resources))

    elif node_type == "service":
        params = cfg["params"]
        svc_time = sample(
            params.get("distribution", "exponential"),
            params.get("durationMean", 1)
        )
        log_event(env.now, eid, node_id, label, "service_start")
        yield env.timeout(svc_time)
        log_event(env.now, eid, node_id, label, "service_end")
        s["currentDepth"] -= 1
        s["entitiesOut"] += 1
        next_id = get_next_target(node_id)
        if next_id:
            yield env.process(entity_process(env, eid, next_id, resources))

    elif node_type == "decision":
        log_event(env.now, eid, node_id, label, "routed")
        s["currentDepth"] -= 1
        s["entitiesOut"] += 1
        target_id = get_target_for_decision(node_id)
        if target_id:
            yield env.process(entity_process(env, eid, target_id, resources))

    elif node_type == "sink":
        log_event(env.now, eid, node_id, label, "completed")
        s["currentDepth"] -= 1
        s["entitiesOut"] += 1

    else:
        # Unknown node type — pass through
        s["currentDepth"] -= 1
        s["entitiesOut"] += 1
        next_id = get_next_target(node_id)
        if next_id:
            yield env.process(entity_process(env, eid, next_id, resources))


def source_process(env, node_id, resources, total_arrived):
    """Generate entities at source node based on arrival params."""
    cfg = NODE_CONFIG[node_id]
    params = cfg["params"]
    arrival_rate = params.get("arrivalRate", 1)
    distribution = params.get("distribution", "exponential")
    max_entities = params.get("maxEntities", None)
    count = 0

    while True:
        inter_arrival = sample(distribution, 1.0 / arrival_rate if arrival_rate > 0 else 1.0)
        yield env.timeout(inter_arrival)
        if env.now > DURATION:
            break
        eid = next_entity_id()
        total_arrived[0] += 1
        count += 1
        env.process(entity_process(env, eid, node_id, resources))
        if max_entities and count >= max_entities:
            break


def tick_emitter(env, resources, total_arrived, total_completed):
    """Emit a SimTick-compatible snapshot every TICK_INTERVAL sim-time units."""
    while True:
        yield env.timeout(TICK_INTERVAL)
        snap = snapshot_stats(env)
        # Drain log buffer for this tick
        recent = list(log_buffer)
        log_buffer.clear()
        tick = {
            "type": "tick",
            "data": {
                "simTime": env.now,
                "wallElapsed": 0,
                "totalArrived": total_arrived[0],
                "totalCompleted": stats_total_completed(snap),
                "nodeStats": snap,
                "recentLogs": recent,
            }
        }
        tick_buffer.append(json.dumps(tick))
        # Signal JS by printing a special line
        print("__TICK__:" + tick_buffer[-1], flush=True)

def stats_total_completed(snap):
    for nid, s in snap.items():
        if NODE_CONFIG[nid]["nodeType"] == "sink":
            return s["entitiesOut"]
    return 0

# ── Main setup ─────────────────────────────────────────────────────────────────
def run_simulation():
    env = simpy.Environment()
    resources = {}
    total_arrived = [0]

    init_stats()

    # Build SimPy Resources from graph
    for nid, cfg in NODE_CONFIG.items():
        if cfg["nodeType"] in ("resource", "priority_resource"):
            cap = cfg["params"].get("capacity", 1)
            resources[nid] = simpy.Resource(env, capacity=max(1, cap))

    # Start source processes
    for nid, cfg in NODE_CONFIG.items():
        if cfg["nodeType"] == "source":
            env.process(source_process(env, nid, resources, total_arrived))

    # Start tick emitter
    env.process(tick_emitter(env, resources, total_arrived, None))

    # Run
    env.run(until=DURATION)

    # Final result
    snap = snapshot_stats(env)
    remaining_logs = list(log_buffer)

    # Find bottleneck (highest wait time resource/queue)
    bottleneck_id = ""
    bottleneck_label = ""
    max_wait = -1
    for nid, s in snap.items():
        if NODE_CONFIG[nid]["nodeType"] in ("resource", "queue"):
            if s["avgWaitTime"] > max_wait:
                max_wait = s["avgWaitTime"]
                bottleneck_id = nid
                bottleneck_label = NODE_CONFIG[nid]["label"]

    result = {
        "type": "complete",
        "data": {
            "simType": "human_queue",
            "totalSimTime": env.now,
            "totalArrived": total_arrived[0],
            "totalCompleted": stats_total_completed(snap),
            "bottleneckNodeId": bottleneck_id,
            "bottleneckLabel": bottleneck_label,
            "nodeStats": snap,
            "timeline": [],
            "logs": remaining_logs,
        }
    }
    print("__RESULT__:" + json.dumps(result), flush=True)

run_simulation()
```

#### 3e. codeGenerator.ts implementation logic

The TypeScript `generateSimPyScript` function must:
1. Build `NODE_CONFIG_JSON` by iterating `graph.nodes` → create a dict `{ [nodeId]: { nodeType, label, params } }`
2. Build `EDGES_JSON` by iterating `graph.edges` → `[{ id, source, target }]`
3. Also inject the `simType` into the result's `"simType"` field
4. Return the completed Python string with all placeholders filled in

```typescript
export function generateSimPyScript(graph: SimGraph, duration: number, tickInterval: number): GeneratedScript {
  const nodeConfig: Record<string, object> = {};
  for (const node of graph.nodes) {
    nodeConfig[node.id] = {
      nodeType: node.nodeType,
      label: node.label,
      params: node.params,
    };
  }

  const edges = graph.edges.map(e => ({ id: e.id, source: e.source, target: e.target }));

  const python = PYTHON_TEMPLATE
    .replace("{DURATION}", String(duration))
    .replace("{TICK_INTERVAL}", String(tickInterval))
    .replace("{NODE_CONFIG_JSON}", JSON.stringify(nodeConfig))
    .replace("{EDGES_JSON}", JSON.stringify(edges));

  return { python, nodeIdMap: {} };
}

const PYTHON_TEMPLATE = `... the big python string above ...`;
```

---

### STEP 4 — Write the Pyodide Web Worker

**File**: `src/lib/simulation/pyodideWorker.ts`

This is a **persistent** Web Worker (not recreated per run). It:
1. Loads Pyodide from CDN on startup
2. Installs `simpy` via `micropip`
3. Listens for `{ type: "start", params }` messages
4. Generates+runs Python using `codeGenerator.ts`
5. Forwards tick and result messages back to the main thread

```typescript
/// <reference lib="webworker" />
/**
 * pyodideWorker.ts
 *
 * Persistent Web Worker that hosts the Pyodide WASM runtime.
 * Loaded ONCE at workspace mount. Receives "start/pause/stop" messages
 * and runs generated SimPy scripts inside the Python sandbox.
 *
 * Message Protocol (identical to worker.ts for drop-in compatibility):
 *   IN:  { type:'init' } | { type:'start', params: SimParams } |
 *        { type:'pause' } | { type:'resume' } | { type:'stop' }
 *   OUT: { type:'status', phase, message } |
 *        { type:'tick', data: SimTick } |
 *        { type:'complete', data: SimResult } |
 *        { type:'error', message: string }
 */

import { generateSimPyScript } from "./codeGenerator";
import type { SimParams, SimTick, SimResult } from "./types";

// ─── Pyodide global (loaded once) ────────────────────────────────────────────
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

    // Import Pyodide from CDN
    // Note: importScripts is available in workers
    (self as any).importScripts("https://cdn.jsdelivr.net/pyodide/v0.29.3/full/pyodide.js");
    pyodide = await (self as any).loadPyodide();

    emit({ type: "status", phase: "loading_simpy", message: "Installing SimPy..." });
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    await micropip.install("simpy");

    emit({ type: "status", phase: "ready", message: "Pyodide + SimPy ready" });
  })();

  return pyodideLoading;
}

// Pre-load eagerly when worker is created
ensurePyodide().catch((err) => {
  emit({ type: "status", phase: "error", message: String(err) });
});

// ─── Message handler ──────────────────────────────────────────────────────────
(self as any).onmessage = async (e: MessageEvent) => {
  const msg = e.data;

  switch (msg.type) {
    case "init":
      // Pre-warm (already started above), just re-emit ready when done
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

        // Register a stdout handler that intercepts __TICK__ and __RESULT__ lines
        pyodide.setStdout({
          batched: (text: string) => {
            if (stopped) return;
            const lines = text.split("\n");
            for (const line of lines) {
              if (line.startsWith("__TICK__:")) {
                try {
                  const tickMsg = JSON.parse(line.slice(9));
                  emit(tickMsg);
                } catch {}
              } else if (line.startsWith("__RESULT__:")) {
                try {
                  const resultMsg = JSON.parse(line.slice(11));
                  emit(resultMsg);
                } catch {}
              }
            }
          }
        });

        // Run the simulation synchronously in Python
        // (SimPy is synchronous/event-driven, no asyncio needed)
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
      // Cannot interrupt running Python synchronously but next tick will check
      break;

    case "pause":
      // SimPy runs synchronously so we can't pause mid-execution.
      // For now, just stop and indicate pause (limitation to document).
      emit({ type: "status", phase: "ready", message: "Pause not supported with SimPy sync mode" });
      break;

    case "resume":
      // N/A for sync run
      break;
  }
};
```

**Critical note on pause/resume with SimPy:**
SimPy in Pyodide runs synchronously — it blocks the Worker thread until `env.run()` completes.
True pause/resume requires either:
- **Option A (simple)**: Re-generate + re-run simulation from scratch (discard current run)
- **Option B (advanced)**: Use Python generators and `env.step()` in a loop with periodic
  `yield` points back to JS, checking a `paused` flag each tick interval

Implement **Option A** first. Document Option B for a future enhancement.

---

### STEP 5 — Write the PyodideSimEngine

**File**: `src/lib/simulation/pyodideEngine.ts`

This implements the `SimulationEngine` interface exactly like `ClientSimEngine` does,
so the UI page can swap it in with a single import change.

```typescript
/**
 * pyodideEngine.ts
 *
 * SimulationEngine implementation that routes simulation runs through
 * the persistent pyodideWorker.ts (Pyodide + SimPy runtime).
 *
 * Drop-in replacement for ClientSimEngine:
 *   import { PyodideSimEngine } from "@/lib/simulation/pyodideEngine";
 */

import type { SimulationEngine, SimParams, SimTick, SimResult } from "./types";

export class PyodideSimEngine implements SimulationEngine {
  private worker: Worker | null = null;
  private running = false;

  // Multi-listener sets (matching ClientSimEngine refactor)
  private onTickCallbacks    = new Set<(tick: SimTick) => void>();
  private onCompleteCallbacks = new Set<(result: SimResult) => void>();
  private onErrorCallbacks   = new Set<(error: string) => void>();
  private onStatusCallbacks  = new Set<(status: { phase: string; message?: string }) => void>();

  /** Initialize the persistent worker (call this at workspace mount, not per-run). */
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
    // Kick off pre-warming
    this.worker.postMessage({ type: "init" });
  }

  private handleMessage(msg: any) {
    switch (msg.type) {
      case "tick":
        this.onTickCallbacks.forEach(cb => cb(msg.data));
        break;
      case "complete":
        this.running = false;
        this.onCompleteCallbacks.forEach(cb => cb(msg.data));
        break;
      case "error":
        this.running = false;
        this.onErrorCallbacks.forEach(cb => cb(msg.message));
        break;
      case "status":
        this.onStatusCallbacks.forEach(cb => cb(msg));
        break;
    }
  }

  start(params: SimParams): void {
    if (!this.worker) this.init();
    this.running = true;
    this.worker!.postMessage({ type: "start", params });
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

  /** Additional callback for loading status (Pyodide-specific). */
  onStatus(callback: (status: { phase: string; message?: string }) => void): void {
    this.onStatusCallbacks.add(callback);
  }

  pause(): void {
    this.worker?.postMessage({ type: "pause" });
  }

  resume(): void {
    this.worker?.postMessage({ type: "resume" });
  }

  stop(): void {
    this.running = false;
    this.worker?.postMessage({ type: "stop" });
  }

  isRunning(): boolean {
    return this.running;
  }

  /** Fully destroy worker (call on workspace unmount). */
  destroy(): void {
    this.stop();
    this.worker?.terminate();
    this.worker = null;
  }
}
```

---

### STEP 6 — Integrate PyodideSimEngine into WorkspacePage

**File**: `src/app/dashboard/project/[id]/page.tsx`

Make these targeted changes:

#### 6a. Change the import
```typescript
// OLD:
import { ClientSimEngine } from "@/lib/simulation/clientEngine";

// NEW:
import { PyodideSimEngine } from "@/lib/simulation/pyodideEngine";
```

#### 6b. Change the engine ref type
```typescript
// OLD:
const engineRef = React.useRef<ClientSimEngine | null>(null);

// NEW:
const engineRef = React.useRef<PyodideSimEngine | null>(null);
```

#### 6c. Change the engine initialization in `useEffect`
```typescript
React.useEffect(() => {
  // NEW: Create persistent engine and pre-warm Pyodide
  const engine = new PyodideSimEngine();
  engine.init();  // starts loading Pyodide immediately
  engineRef.current = engine;

  engine.onTick((tick) => setSimTick(tick));
  engine.onComplete((result) => {
    setSimResult(result);
    setSimState("idle");
    setBottleneckNodeId(result.bottleneckNodeId || "");
  });
  engine.onError((err) => {
    console.error("[PyodideSimEngine Error]", err);
    setSimState("idle");
  });
  // NEW: Handle status updates for loading indicator
  engine.onStatus((status) => {
    console.log("[Pyodide Status]", status.phase, status.message);
    setPyodideStatus(status);
  });

  return () => {
    engine.destroy();  // terminate worker on unmount
  };
}, []);
```

#### 6d. Add pyodideStatus state
```typescript
const [pyodideStatus, setPyodideStatus] = React.useState<{ phase: string; message?: string }>({ phase: "idle" });
```

#### 6e. Show loading indicator on toolbar
In the toolbar JSX, when `pyodideStatus.phase !== "ready"` and `pyodideStatus.phase !== "idle"`,
show a small pulsing indicator next to the RUN button:

```tsx
{(pyodideStatus.phase === "loading_runtime" || pyodideStatus.phase === "loading_simpy") && (
  <span className="text-[10px] animate-pulse" style={{ color: "var(--neon-yellow)", fontFamily: "var(--font-mono)" }}>
    ⚙ {pyodideStatus.message}
  </span>
)}
```

#### 6f. Disable RUN while loading
```tsx
<button
  onClick={handleRun}
  disabled={simState !== "idle" || pyodideStatus.phase !== "ready"}
  ...
>
```

---

### STEP 7 — Update ViewportPanel Loading State

**File**: `src/components/workspace/ViewportPanel.tsx`

The `ViewportPanel` receives `engine` as a prop. Add an optional prop for status:

```typescript
interface ViewportPanelProps {
  // ... existing props
  pyodideStatus?: { phase: string; message?: string };
}
```

Show an overlay in the canvas area when Pyodide is loading:

```tsx
{pyodideStatus && pyodideStatus.phase !== "ready" && pyodideStatus.phase !== "idle" && (
  <div className="absolute inset-0 flex flex-col items-center justify-center z-10"
       style={{ background: "rgba(6, 14, 26, 0.85)" }}>
    <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mb-3" />
    <p className="text-xs font-mono" style={{ color: "var(--neon-cyan)" }}>
      {pyodideStatus.message ?? "Initializing..."}
    </p>
  </div>
)}
```

---

### STEP 8 — Update the PreLoader Component (Optional but Nice)

**File**: `src/components/layout/PreLoader.tsx`

The landing-page preloader already says "LOADING PYODIDE WASM RUNTIME..." as a fake status.
Now it can reflect the real status if we expose the engine globally, or we can just leave it
as-is since the preloader is on the marketing page, not the workspace.

---

### STEP 9 — Handle SimPy Async Limitation (Tick-by-Tick Mode)

The key limitation of running SimPy synchronously in Pyodide:
- `env.run(until=DURATION)` blocks until complete — we can't stream ticks progressively
- Our workaround: emit ticks **within** the Python script via `print("__TICK__:...")` at each `TICK_INTERVAL`
- This works because `setStdout` in Pyodide fires the callback **synchronously** whenever Python prints

For large simulations (duration >> 100), this approach succeeds because:
1. Python-side print is captured immediately by the JS stdout handler
2. The JS handler calls `emit()` which posts the `tick` message to the main thread
3. Main thread updates the UI

> **Caveat**: The main thread will only update UI AFTER the entire `pyodide.runPythonAsync()` call completes
> **UNLESS** we use `pyodide.runPythonAsync()` with proper async boundaries. To get true
> real-time tick streaming, use this pattern:

```typescript
// In pyodideWorker.ts — async streaming approach
// Instead of collecting logs in Python and printing at tick boundaries,
// register a JS callback that Python can call directly:

await pyodide.runPythonAsync(`
  import js
  js.emit_tick(...)  # calls JS function directly
`);

// Register the function in pyodide's JS namespace:
pyodide.globals.set("emit_tick_js", (tickJson: string) => {
  if (!stopped) emit(JSON.parse(tickJson));
});
```

This callback-based approach gives true streaming. The Python script does:
```python
import js
js.emit_tick_js(json.dumps(tick_payload))
```

Use this callback pattern (not the `print` approach) for production quality.

---

### STEP 10 — Rename Legacy Engine

**File**: `src/lib/simulation/worker.ts` → `src/lib/simulation/legacyWorker.ts`

Update the reference in `clientEngine.ts`:
```typescript
// OLD:
this.worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
// NEW:
this.worker = new Worker(new URL("./legacyWorker.ts", import.meta.url), { type: "module" });
```

Keep `ClientSimEngine` available. This can be used as a quick fallback.

---

### STEP 11 — Add Fallback Logic

In `PyodideSimEngine`, if Pyodide fails to load (network error, CDN down):

```typescript
// In handleMessage:
case "status":
  if (msg.phase === "error") {
    console.warn("[PyodideSimEngine] Falling back to legacy TS engine");
    this.useFallback = true;
  }
  break;

// In start():
if (this.useFallback) {
  // Spin up legacy ClientSimEngine instead
  const legacy = new ClientSimEngine();
  // wire callbacks...
  legacy.start(params);
  return;
}
```

---

## Testing Checklist

After implementation, verify each of these against the Bank Tellers scenario:

- [ ] Pyodide loads on workspace open (status indicator in toolbar)
- [ ] SimPy installs (`micropip.install("simpy")` succeeds)
- [ ] RUN button is disabled while loading, enabled once ready
- [ ] Clicking RUN starts simulation — ticks arrive within 500ms
- [ ] `simTick.recentLogs` contains events: `arrived`, `queued`, `service_start`, `service_end`, `completed`
- [ ] Pixi.js viewport shows entity sprites moving (SceneManager processes logs unchanged)
- [ ] STOP button terminates the run
- [ ] Node HUD overlays update with correct utilization % per teller
- [ ] SimResults panel shows correct `totalArrived`, `totalCompleted`, `bottleneckNodeId`
- [ ] Browser console: no CORS errors, no COEP errors
- [ ] Reload page: Pyodide re-loads, worker re-initialized
- [ ] Memory: no leaks on repeated RUN/STOP cycles

---

## Known Constraints & Notes

| Constraint | Detail |
|---|---|
| **First load time** | Pyodide WASM is ~8–10 MB. First load takes 5–15 seconds on slow connections. Subsequent loads use browser cache. |
| **SimPy version** | `micropip.install("simpy")` installs SimPy 4.x. Verify with `import simpy; print(simpy.__version__)` in the Python script. |
| **Sync execution** | `env.run()` is synchronous inside the Worker — it blocks the worker thread. This is fine because the Worker is off the main thread. UI stays responsive. |
| **Pause** | Not truly pausable with sync SimPy. Implement as stop+restart or use `env.step()` loop (Option B). |
| **COEP headers** | May break auth flows. Test Supabase redirects after enabling. |
| **Node.js build** | Next.js build won't fail because `pyodideWorker.ts` is only loaded in a browser Worker context (`new URL("./pyodideWorker.ts", import.meta.url)`) |
| **TypeScript in Worker** | Next.js 13+ with Webpack handles `{ type: "module" }` workers natively. No additional config needed. |

---

## Future Enhancements (Out of Scope for This Sprint)

1. **Async step-by-step mode**: Use `env.step()` inside a Python generator yielded back to JS for true pause/resume support.
2. **Custom Python editor**: Let advanced users directly edit the generated SimPy code in a Monaco editor pane before running.
3. **Seeded RNG**: Pass a seed from JS into Python's `random.seed(seed)` for reproducible results.
4. **Multiple simulation runs**: Run N iterations in Python and return confidence intervals.
5. **Export to SimPy code**: Download the generated `.py` file so users can run it locally.
6. **Pyodide self-hosted**: Bundle Pyodide in `/public/pyodide/` instead of CDN for offline use.
