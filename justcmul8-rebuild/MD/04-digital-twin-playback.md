# Feature: Digital Twin 2D Animated Playback

## Status before this feature
**Not started (0%).** `pixi.js@8.19.0` is listed in `package.json` dependencies but is completely unused for simulation purposes — grep for `pixi`/`PIXI` across `src/` only turns up an unrelated marketing-page ticker (`src/components/landing/TickerSection.tsx`) and a single code comment in `types.ts:213` (`// Position in ReactFlow (NOT used by PixiJS layout engine)`) that anticipates this feature but implements nothing. This is the biggest lift of all 6 features — it's a from-scratch build, not an extension of existing code.

## What this feature does
Renders the simulation as an animated 2D scene: entities (dots/packages) flow along the graph's edges in real time, nodes change color based on congestion (queue depth / utilization), and a VCR-style transport bar lets the user Play/Pause/Step/change speed. This is the best live-demo visual — evaluators watching a presentation immediately see *where* the bottleneck forms, rather than reading it off a chart after the fact.

## Why this is the hardest feature and how to de-risk it

The simulation engine (`pyodideWorker.ts`) runs the entire SimPy script **synchronously to completion** inside the worker (`await pyodide.runPythonAsync(python)` at `pyodideWorker.ts:78`) — it is not a step-by-step generator you can pause. It already emits `SimTick` objects periodically during that run (`emit_sim_tick` called from Python, wired to `pyodideEngine.ts`'s `onTick` callback, which `page.tsx:109` forwards into `setSimTick`). That means **live-mode animation** (animating while the sim is actively running) is straightforward — just consume the tick stream as it arrives, exactly like the existing HUD at `page.tsx:557-582` already does with plain numbers/progress bars.

**Scrubbable playback** (rewind, step backward, arbitrary speed control after the run finishes) is a different and harder problem, because by the time the run completes you only have the final `SimTick` stream that was already emitted — nothing currently buffers all ticks. Do NOT try to build true VCR rewind in the first pass. Build it in two clearly separated phases:

- **Phase A (ship this first): Live playback during a run.** Animate entities as `SimTick`s arrive in real time. Play/Pause simply toggles whether new ticks are consumed (harmless since `pyodideWorker.ts:92-93` already tells the user "Pause not supported with SimPy sync mode" for the *simulation*, but pausing the *animation/rendering* independent of the underlying sim run is fully possible — it's just a rendering-layer pause, not a SimPy-engine pause). Speed 1x/2x/5x controls the animation's playback rate independent of `speedMultiplier`.
- **Phase B (do only after Phase A works): Post-run scrubbable replay.** Requires buffering all `SimTick`s emitted during a run into an array (`tickHistory: SimTick[]`) and/or using `result.timeline` (`SimResult.timeline`, already populated — see `types.ts:379`: `Array<{ simTime, completed, depth, wip }>`) as a coarser replay source. This MD focuses on Phase A; Phase B is called out as a stretch goal at the end.

---

## Implementation plan (Phase A — live playback)

### Step 1 — Install Pixi.js React bindings (optional but strongly recommended)

`pixi.js` core is already installed. Using raw `PIXI.Application` inside a `useEffect` works but is verbose and easy to leak (must manually destroy on unmount). Recommended: add `@pixi/react` (compatible with Pixi v8) for a declarative `<Application>`/`<Container>`/`<Sprite>` API that composes naturally with React's render cycle:

```bash
npm install @pixi/react
```

If the team prefers zero new dependencies, raw Pixi is also documented below as an alternative (Step 2b).

### Step 2 — Build the Digital Twin canvas component

New file: `src/components/workspace/DigitalTwinCanvas.tsx`

This component needs, at minimum:
1. Node positions — already available from ReactFlow's `nodes` array (`n.position.x`, `n.position.y`) passed down from `page.tsx`.
2. Edge source/target — already available from `edges`.
3. Live congestion state per node — from `simTick.nodeStats[nodeId].currentDepth` / `.utilization` (both already exist in `NodeStats`, `types.ts:242-259`).
4. Entity movement along edges — this is the one piece of data that **does not exist yet** at fine enough granularity. `SimTick` gives aggregate counts (`entitiesIn`/`entitiesOut`/`currentDepth`) per node per tick, not "entity #42 is currently 60% of the way from node A to node B." Two implementation options:
   - **(Recommended, no engine changes)** Approximate: for each edge, track a in an interpolation buffer sized to `entitiesOut` delta since the last tick, and spawn that many "traveling dot" sprites that animate from source to target node over the tick interval duration, then despawn. This produces a visually convincing flow effect without needing exact per-entity coordinates, and requires zero changes to `codeGenerator.ts`/Python side.
   - (More accurate, more invasive) Modify `codeGenerator.ts`'s Python template to emit entity-level position events (which edge, what fraction along it) on every tick. Higher fidelity but adds payload size and coupling; not necessary for a convincing demo. Skip unless the approximate version looks unconvincing after building it.

Use the Recommended approach:

```tsx
"use client";

import { useEffect, useRef, useMemo } from "react";
import * as PIXI from "pixi.js";
import type { SimTick, NodeStats } from "@/lib/simulation/types";

interface TwinNode { id: string; x: number; y: number; label: string; }
interface TwinEdge { id: string; source: string; target: string; }

export default function DigitalTwinCanvas({
  nodes,
  edges,
  tick,
  playing,
  speedMultiplier,
}: {
  nodes: TwinNode[];
  edges: TwinEdge[];
  tick: SimTick | null;
  playing: boolean;
  speedMultiplier: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const nodeGraphicsRef = useRef<Map<string, PIXI.Graphics>>(new Map());
  const edgeDotsRef = useRef<Map<string, PIXI.Graphics[]>>(new Map());
  const prevNodeStatsRef = useRef<Record<string, NodeStats>>({});

  // ── Init Pixi Application once ──────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const app = new PIXI.Application();
    let destroyed = false;

    app.init({
      resizeTo: containerRef.current,
      backgroundAlpha: 0,
      antialias: true,
    }).then(() => {
      if (destroyed) return;
      containerRef.current!.appendChild(app.canvas);
      appRef.current = app;

      // Draw static node circles
      for (const n of nodes) {
        const g = new PIXI.Graphics();
        g.circle(0, 0, 22).fill({ color: 0x5742ff, alpha: 0.15 }).stroke({ width: 2, color: 0x5742ff });
        g.position.set(n.x, n.y);
        app.stage.addChild(g);
        nodeGraphicsRef.current.set(n.id, g);
      }
    });

    return () => {
      destroyed = true;
      app.destroy(true, { children: true });
      appRef.current = null;
    };
  }, [nodes]);

  // ── React to each new SimTick: recolor nodes, spawn traveling dots ─────
  useEffect(() => {
    if (!tick || !playing || !appRef.current) return;
    const app = appRef.current;

    // Recolor nodes by congestion (currentDepth relative to a soft cap, or utilization)
    for (const [nodeId, g] of nodeGraphicsRef.current) {
      const stats = tick.nodeStats[nodeId];
      if (!stats) continue;
      const util = stats.utilization ?? 0;
      const color = util > 0.85 ? 0xef4444 : util > 0.6 ? 0xf59e0b : 0x10b981;
      g.clear();
      g.circle(0, 0, 22).fill({ color, alpha: 0.2 }).stroke({ width: 2.5, color });
    }

    // Spawn traveling dots on edges whose source node's entitiesOut increased since last tick
    for (const edge of edges) {
      const prev = prevNodeStatsRef.current[edge.source]?.entitiesOut ?? 0;
      const curr = tick.nodeStats[edge.source]?.entitiesOut ?? 0;
      const delta = Math.max(0, curr - prev);
      if (delta === 0) continue;

      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);
      if (!sourceNode || !targetNode) continue;

      for (let i = 0; i < Math.min(delta, 5); i++) {  // cap dots per tick to avoid overdraw
        const dot = new PIXI.Graphics();
        dot.circle(0, 0, 4).fill({ color: 0x5742ff });
        dot.position.set(sourceNode.x, sourceNode.y);
        app.stage.addChild(dot);

        const durationMs = 600 / speedMultiplier;
        const start = performance.now();
        const animate = (now: number) => {
          const t = Math.min(1, (now - start) / durationMs);
          dot.position.x = sourceNode.x + (targetNode.x - sourceNode.x) * t;
          dot.position.y = sourceNode.y + (targetNode.y - sourceNode.y) * t;
          if (t < 1) {
            requestAnimationFrame(animate);
          } else {
            app.stage.removeChild(dot);
            dot.destroy();
          }
        };
        requestAnimationFrame(animate);
      }
    }

    prevNodeStatsRef.current = tick.nodeStats;
  }, [tick, playing, speedMultiplier, edges, nodes]);

  return <div ref={containerRef} className="w-full h-full" />;
}
```

Note the Pixi v8 API: `new PIXI.Application()` + `await app.init({...})` (async init, different from v7's constructor-based init) and `.fill({color, alpha})`/`.stroke({width, color})` chained graphics calls (Pixi v8's new `Graphics` API replaced v7's `beginFill()`/`drawCircle()`/`endFill()`). Since `package.json` already pins `"pixi.js": "^8.19.0"`, use the v8 API exactly as shown — do not copy v7-style Pixi tutorials from memory, they will not compile.

### Step 2b — Alternative without `@pixi/react`

If skipping the new dependency, the component above already uses raw `PIXI.Application` directly inside a `useEffect` — it works as-is without `@pixi/react`. `@pixi/react` would only be needed if the team wants a more declarative `<pixiContainer>`/`<pixiGraphics>` JSX-style API. The imperative version above is sufficient and installs zero new packages beyond what's already in `package.json`.

### Step 3 — VCR playback control bar

New file: `src/components/workspace/PlaybackControls.tsx`

```tsx
"use client";
import { Play, Pause, SkipForward } from "lucide-react";

export default function PlaybackControls({
  playing, onTogglePlay, speed, onSpeedChange,
}: {
  playing: boolean; onTogglePlay: () => void; speed: number; onSpeedChange: (s: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white border border-gray-200 shadow-sm">
      <button onClick={onTogglePlay} className="w-9 h-9 rounded-xl bg-[#5742FF] text-white flex items-center justify-center">
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      {[1, 2, 5].map((s) => (
        <button
          key={s}
          onClick={() => onSpeedChange(s)}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${speed === s ? "bg-indigo-100 text-[#5742FF]" : "text-gray-500"}`}
        >
          {s}x
        </button>
      ))}
    </div>
  );
}
```

### Step 4 — Wire it into the workspace

File: `src/app/dashboard/project/[id]/page.tsx`

Add a toggle (e.g. a "🎬 Digital Twin View" button in the toolbar near the existing Engine Status pill, around line 414) that swaps the `NodeCanvas` for `DigitalTwinCanvas`, OR overlays `DigitalTwinCanvas` as an absolutely-positioned layer on top of `NodeCanvas` (recommended — keeps the editable graph visible underneath and is less disruptive to existing layout code). Pass `simTick` (already in state at `page.tsx` — search for `setSimTick`/`simTick` usage, it's set inside the `engine.onTick` callback at line 109) straight through:

```tsx
const [twinPlaying, setTwinPlaying] = useState(true);
const [twinSpeed, setTwinSpeed] = useState(1);

{simState === "running" && (
  <div className="absolute inset-0 pointer-events-none z-10">
    <DigitalTwinCanvas
      nodes={nodes.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y, label: n.data.label }))}
      edges={edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))}
      tick={simTick}
      playing={twinPlaying}
      speedMultiplier={twinSpeed}
    />
  </div>
)}
{simState === "running" && (
  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
    <PlaybackControls playing={twinPlaying} onTogglePlay={() => setTwinPlaying((p) => !p)} speed={twinSpeed} onSpeedChange={setTwinSpeed} />
  </div>
)}
```

`pointer-events-none` on the overlay (with `pointer-events-auto` re-enabled only on the controls) keeps the underlying `NodeCanvas`/ReactFlow interactions (pan/zoom/select) working while the Pixi layer animates on top.

---

## Phase B (stretch goal, do only after Phase A ships and looks good in a demo)

Buffer every `SimTick` received during a run into `tickHistoryRef.current: SimTick[]` (push inside the same `engine.onTick` handler in `page.tsx:109`). After `simState` becomes `"idle"` (run complete), let the user scrub a timeline slider that indexes into `tickHistoryRef.current` and replays `DigitalTwinCanvas` frame-by-frame from the buffered array instead of live ticks. This needs a `mode: "live" | "replay"` prop on `DigitalTwinCanvas` and a scrub-position prop instead of consuming `tick` directly. Estimate: roughly as much work again as Phase A — do not attempt both in one pass.

---

## Files touched
- `src/components/workspace/DigitalTwinCanvas.tsx` — new
- `src/components/workspace/PlaybackControls.tsx` — new
- `src/app/dashboard/project/[id]/page.tsx` — new toggle state, overlay mount point
- `package.json` — optionally `@pixi/react` (not required, see Step 2b)

## Definition of done
- [ ] Starting a run shows animated dots moving from node to node along real edges, roughly in sync with the numeric HUD that already exists at `page.tsx:557-582`.
- [ ] Nodes visibly change color (green → amber → red) as their `utilization` in `simTick.nodeStats` rises.
- [ ] Play/Pause button freezes/resumes the dot animation without needing to Stop the underlying SimPy run.
- [ ] Speed buttons (1x/2x/5x) visibly change how fast dots travel between nodes.
- [ ] No memory leak: switching away from the workspace / unmounting during a run destroys the `PIXI.Application` cleanly (verify via the `useEffect` cleanup calling `app.destroy(true, { children: true })`).
