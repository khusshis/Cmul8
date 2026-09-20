"use client";

import React, { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import type { SimTick } from "@/lib/simulation/types";

export interface TwinNode {
  id: string;
  /** Node centre in ReactFlow (flow) coordinates. */
  x: number;
  y: number;
  label: string;
}

export interface TwinEdge {
  id: string;
  source: string;
  target: string;
}

export interface TwinViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface TwinFrameInfo {
  index: number;
  total: number;
  simTime: number;
}

interface DigitalTwinCanvasProps {
  nodes: TwinNode[];
  edges: TwinEdge[];
  /** Every tick emitted by the current run. Mutated in place by the page; read each frame. */
  tickBufferRef: React.MutableRefObject<SimTick[]>;
  playing: boolean;
  /** Ticks consumed per second = 60 * speed. */
  speed: number;
  viewport: TwinViewport;
  /** Change this value to restart playback from the first tick. */
  replayKey: number;
  onFrame?: (info: TwinFrameInfo) => void;
}

const NODE_RADIUS = 28;
const TICKS_PER_SEC_AT_1X = 60;
const MAX_DOTS_PER_EDGE_PER_FRAME = 3;

interface NodeVisual {
  g: PIXI.Graphics;
  title: PIXI.Text;
  sub: PIXI.Text;
}

interface Dot {
  g: PIXI.Graphics;
  edgeId: string;
  age: number; // ms of playback time
  delay: number; // ms before it starts moving
}

function congestionColor(util: number, depth: number) {
  if (util > 0.85 || depth >= 5) return { color: 0xef4444, alpha: 0.32, radius: NODE_RADIUS + 4 };
  if (util > 0.55 || depth >= 2) return { color: 0xf59e0b, alpha: 0.24, radius: NODE_RADIUS + 2 };
  return { color: 0x10b981, alpha: 0.16, radius: NODE_RADIUS };
}

export default function DigitalTwinCanvas({
  nodes,
  edges,
  tickBufferRef,
  playing,
  speed,
  viewport,
  replayKey,
  onFrame,
}: DigitalTwinCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Latest props, read from inside the Pixi ticker so the scene is never torn down for a prop change.
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  const viewportRef = useRef(viewport);
  const onFrameRef = useRef(onFrame);
  const dirtyRef = useRef(true);
  const resetRef = useRef(replayKey);

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
    dirtyRef.current = true;
  }, [nodes, edges]);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);
  useEffect(() => { onFrameRef.current = onFrame; }, [onFrame]);
  useEffect(() => { resetRef.current = replayKey; }, [replayKey]);

  // ── Create the Pixi scene once; all per-frame work happens in the ticker ───
  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    const app = new PIXI.Application();
    let destroyed = false;
    let ready = false;

    const visuals = new Map<string, NodeVisual>();
    const dots: Dot[] = [];
    let cursor = 0; // float index into the tick buffer
    let appliedIndex = -1;
    let prevTick: SimTick | null = null;
    let seenReset = resetRef.current;
    let lastReported = -2;

    const world = new PIXI.Container();
    const edgeLayer = new PIXI.Graphics();
    const nodeLayer = new PIXI.Container();
    const dotLayer = new PIXI.Container();
    world.addChild(edgeLayer, nodeLayer, dotLayer);

    const nodeById = () => new Map(nodesRef.current.map((n) => [n.id, n]));

    function syncNodeVisuals() {
      const wanted = new Set(nodesRef.current.map((n) => n.id));
      for (const [id, v] of visuals) {
        if (!wanted.has(id)) {
          nodeLayer.removeChild(v.g, v.title, v.sub);
          v.g.destroy();
          v.title.destroy();
          v.sub.destroy();
          visuals.delete(id);
        }
      }
      for (const n of nodesRef.current) {
        let v = visuals.get(n.id);
        if (!v) {
          v = {
            g: new PIXI.Graphics(),
            title: new PIXI.Text({
              text: n.label,
              style: { fontSize: 12, fontWeight: "700", fill: 0x1e1b4b, fontFamily: "system-ui, sans-serif" },
            }),
            sub: new PIXI.Text({
              text: "",
              style: { fontSize: 10, fontWeight: "600", fill: 0x6b7280, fontFamily: "system-ui, sans-serif" },
            }),
          };
          v.title.anchor.set(0.5, 0);
          v.sub.anchor.set(0.5, 0);
          nodeLayer.addChild(v.g, v.title, v.sub);
          visuals.set(n.id, v);
        }
        v.g.position.set(n.x, n.y);
        v.title.text = n.label;
        v.title.position.set(n.x, n.y + NODE_RADIUS + 6);
        v.sub.position.set(n.x, n.y + NODE_RADIUS + 21);
      }
    }

    function drawEdges() {
      edgeLayer.clear();
      const byId = nodeById();
      for (const e of edgesRef.current) {
        const a = byId.get(e.source);
        const b = byId.get(e.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const sx = a.x + ux * NODE_RADIUS;
        const sy = a.y + uy * NODE_RADIUS;
        const ex = b.x - ux * (NODE_RADIUS + 4);
        const ey = b.y - uy * (NODE_RADIUS + 4);
        edgeLayer.moveTo(sx, sy).lineTo(ex, ey).stroke({ width: 2, color: 0x5742ff, alpha: 0.35 });
        // arrowhead
        const ah = 9;
        edgeLayer
          .poly([
            ex, ey,
            ex - ux * ah + uy * (ah / 2), ey - uy * ah - ux * (ah / 2),
            ex - ux * ah - uy * (ah / 2), ey - uy * ah + ux * (ah / 2),
          ])
          .fill({ color: 0x5742ff, alpha: 0.55 });
      }
    }

    function drawNodes(tick: SimTick | null) {
      for (const n of nodesRef.current) {
        const v = visuals.get(n.id);
        if (!v) continue;
        const s = tick?.nodeStats[n.id];
        v.g.clear();
        if (!s) {
          v.g.circle(0, 0, NODE_RADIUS).fill({ color: 0x5742ff, alpha: 0.1 }).stroke({ width: 2, color: 0x5742ff, alpha: 0.5 });
          v.sub.text = "";
          continue;
        }
        const util = s.utilization ?? 0;
        const depth = s.currentDepth ?? 0;
        const c = congestionColor(util, depth);
        v.g.circle(0, 0, c.radius).fill({ color: c.color, alpha: c.alpha }).stroke({ width: 3, color: c.color, alpha: 0.9 });
        v.sub.text = `${Math.round(util * 100)}% busy · ${depth} waiting`;
      }
    }

    function spawnDots(prev: SimTick | null, next: SimTick) {
      if (!prev) return;
      const outsBySource = new Map<string, TwinEdge[]>();
      for (const e of edgesRef.current) {
        const list = outsBySource.get(e.source) ?? [];
        list.push(e);
        outsBySource.set(e.source, list);
      }
      for (const [src, outs] of outsBySource) {
        const delta = (next.nodeStats[src]?.entitiesOut ?? 0) - (prev.nodeStats[src]?.entitiesOut ?? 0);
        if (delta <= 0) continue;
        const perEdge = new Map<string, number>();
        for (let k = 0; k < delta; k++) {
          const e = outs[k % outs.length];
          perEdge.set(e.id, (perEdge.get(e.id) ?? 0) + 1);
        }
        for (const [edgeId, count] of perEdge) {
          for (let i = 0; i < Math.min(count, MAX_DOTS_PER_EDGE_PER_FRAME); i++) {
            const g = new PIXI.Graphics();
            g.circle(0, 0, 5).fill({ color: 0x5742ff, alpha: 0.95 }).stroke({ width: 1.5, color: 0xffffff, alpha: 0.9 });
            g.visible = false;
            dotLayer.addChild(g);
            dots.push({ g, edgeId, age: 0, delay: i * 70 });
          }
        }
      }
    }

    function clearDots() {
      for (const d of dots) {
        dotLayer.removeChild(d.g);
        d.g.destroy();
      }
      dots.length = 0;
    }

    function frame(deltaMS: number) {
      const buffer = tickBufferRef.current;

      // Replay requested, or the page cleared the buffer for a new run.
      if (seenReset !== resetRef.current || buffer.length < appliedIndex + 1) {
        seenReset = resetRef.current;
        cursor = 0;
        appliedIndex = -1;
        prevTick = null;
        lastReported = -2;
        clearDots();
        drawNodes(null);
      }

      const vp = viewportRef.current;
      world.position.set(vp.x, vp.y);
      world.scale.set(vp.zoom);

      if (dirtyRef.current) {
        dirtyRef.current = false;
        syncNodeVisuals();
        drawEdges();
        drawNodes(prevTick);
      }

      if (playingRef.current && buffer.length > 0) {
        cursor = Math.min(buffer.length - 1, cursor + (deltaMS / 1000) * TICKS_PER_SEC_AT_1X * speedRef.current);
        const target = Math.floor(cursor);
        if (target > appliedIndex) {
          const next = buffer[target];
          spawnDots(prevTick, next);
          prevTick = next;
          appliedIndex = target;
          drawNodes(next);
        }
      }

      if (appliedIndex !== lastReported) {
        lastReported = appliedIndex;
        const t = appliedIndex >= 0 ? buffer[appliedIndex] : null;
        onFrameRef.current?.({ index: appliedIndex + 1, total: buffer.length, simTime: t?.simTime ?? 0 });
      }

      // Move dots (only advance while playing, so Pause freezes them mid-flight).
      if (dots.length > 0) {
        const byId = nodeById();
        const edgeById = new Map(edgesRef.current.map((e) => [e.id, e]));
        const durationMs = 900 / Math.sqrt(Math.max(0.5, speedRef.current));
        for (let i = dots.length - 1; i >= 0; i--) {
          const d = dots[i];
          if (playingRef.current) d.age += deltaMS;
          const e = edgeById.get(d.edgeId);
          const a = e ? byId.get(e.source) : undefined;
          const b = e ? byId.get(e.target) : undefined;
          const t = (d.age - d.delay) / durationMs;
          if (!a || !b || t >= 1) {
            dotLayer.removeChild(d.g);
            d.g.destroy();
            dots.splice(i, 1);
            continue;
          }
          if (t < 0) continue;
          d.g.visible = true;
          d.g.position.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
        }
      }
    }

    app
      .init({ resizeTo: host, backgroundAlpha: 0, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true })
      .then(() => {
        if (destroyed) {
          try { app.destroy(true, { children: true }); } catch { /* already gone */ }
          return;
        }
        host.appendChild(app.canvas);
        app.canvas.style.pointerEvents = "none";
        app.stage.addChild(world);
        ready = true;
        app.ticker.add((t) => frame(t.deltaMS));
      })
      .catch((err) => console.warn("Digital Twin init error:", err));

    return () => {
      destroyed = true;
      if (ready) {
        try { app.destroy(true, { children: true }); } catch { /* ignore rapid unmount */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="w-full h-full pointer-events-none" />;
}
