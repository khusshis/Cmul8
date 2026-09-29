"use client";

import React from "react";

// Same colours as the editor (globals.css --color-node-*), derived from the type name so the dashboard
// doesn't have to import the whole canvas module: priority_resource → --color-node-priority-resource.
const nodeColor = (type: string | undefined, fallback: string) => (type ? `var(--color-node-${type.replace(/_/g, "-")}, ${fallback})` : fallback);

type RawNode = { id: string; position?: { x: number; y: number }; data?: { nodeType?: string; label?: string } };
type RawEdge = { source: string; target: string };

// graph_json is stored as an object, but freshly created projects saved it as a JSON string.
function parseGraph(graph: unknown): { nodes: RawNode[]; edges: RawEdge[] } {
  let g = graph;
  if (typeof g === "string") {
    try { g = JSON.parse(g); } catch { g = null; }
  }
  const obj = (g ?? {}) as { nodes?: RawNode[]; edges?: RawEdge[] };
  return {
    nodes: (obj.nodes ?? []).filter((n) => n && n.position && Number.isFinite(n.position.x) && Number.isFinite(n.position.y)),
    edges: obj.edges ?? [],
  };
}

const NW = 168; // node box in graph units
const NH = 46;
const PAD = 36;

/**
 * A static, scaled-down drawing of a project's actual workflow: its real nodes (coloured by block type)
 * and connections. Connections animate on card hover via the `.wf-flow` class (see globals.css).
 */
export function WorkflowPreview({ graph, accent }: { graph: unknown; accent: string }) {
  const { nodes, edges } = React.useMemo(() => parseGraph(graph), [graph]);

  if (!nodes.length) {
    // Blank canvas: ghost nodes and a dashed link
    return (
      <svg viewBox="0 0 320 150" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden>
        <path d="M 108 75 C 140 75, 150 75, 182 75" fill="none" stroke={accent} strokeOpacity={0.35} strokeWidth={2} strokeDasharray="4 6" className="wf-flow-always" />
        {[36, 184].map((x) => (
          <rect key={x} x={x} y={56} width={100} height={38} rx={12} fill="#fff" stroke={accent} strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="5 5" />
        ))}
        <text x={160} y={128} textAnchor="middle" fontSize={11} fontWeight={600} fill="#94a3b8">Blank canvas</text>
      </svg>
    );
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const xs = nodes.map((n) => n.position!.x);
  const ys = nodes.map((n) => n.position!.y);
  const minX = Math.min(...xs) - PAD;
  const minY = Math.min(...ys) - PAD;
  const w = Math.max(...xs) + NW + PAD - minX;
  const h = Math.max(...ys) + NH + PAD - minY;

  return (
    <svg viewBox={`${minX} ${minY} ${w} ${h}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden>
      {edges.map((e, i) => {
        const a = byId.get(e.source);
        const b = byId.get(e.target);
        if (!a || !b) return null;
        const [x1, y1] = [a.position!.x + NW, a.position!.y + NH / 2];
        const [x2, y2] = [b.position!.x, b.position!.y + NH / 2];
        const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
        const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
        return (
          <g key={i}>
            <path d={d} fill="none" stroke="#c9c5e4" strokeWidth={3} />
            <path d={d} fill="none" stroke={accent} strokeWidth={3} className="wf-flow" />
          </g>
        );
      })}
      {nodes.map((n) => {
        const { x, y } = n.position!;
        const color = nodeColor(n.data?.nodeType, accent);
        const label = (n.data?.label ?? n.data?.nodeType ?? "Block").slice(0, 16);
        return (
          <g key={n.id}>
            <rect x={x} y={y + 4} width={NW} height={NH} rx={14} fill="#1e1b4b" opacity={0.06} />
            <rect x={x} y={y} width={NW} height={NH} rx={14} fill="#fff" stroke="#e7e5f6" strokeWidth={2} />
            <rect x={x + 10} y={y + 11} width={24} height={24} rx={8} style={{ fill: color }} opacity={0.9} />
            <circle cx={x + 22} cy={y + 23} r={4} fill="#fff" />
            <text x={x + 44} y={y + 28} fontSize={14} fontWeight={700} fill="#1e293b">{label}</text>
            <circle cx={x + NW} cy={y + NH / 2} r={4.5} fill="#fff" style={{ stroke: color }} strokeWidth={2.5} />
          </g>
        );
      })}
    </svg>
  );
}

export function graphStats(graph: unknown) {
  const { nodes, edges } = parseGraph(graph);
  return { blocks: nodes.length, links: edges.length };
}
