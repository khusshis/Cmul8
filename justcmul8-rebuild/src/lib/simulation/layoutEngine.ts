import dagre from "dagre";

export interface LayoutOptions {
  direction?: "LR" | "TB";
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
  /** LR only: fold into rows once there are more columns than this (default 4). */
  maxColumns?: number;
}

/**
 * Automatically computes clean, non-overlapping 2D coordinates for a simulation graph using Dagre.
 */
export function applyDagreLayout<
  N extends { id: string; position?: { x: number; y: number }; [key: string]: any },
  E extends { id?: string; source: string; target: string; [key: string]: any }
>(
  nodes: N[],
  edges: E[],
  options: LayoutOptions = {}
): { nodes: N[]; edges: E[] } {
  const {
    direction = "LR",
    nodeWidth = 200,
    nodeHeight = 90,
    rankSep = 80,
    nodeSep = 50,
  } = options;

  if (!nodes || nodes.length === 0) {
    return { nodes: [], edges: edges || [] };
  }

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    ranksep: rankSep,
    nodesep: nodeSep,
    marginx: 40,
    marginy: 40,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes to Dagre graph
  nodes.forEach((node) => {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  // Add edges to Dagre graph
  (edges || []).forEach((edge) => {
    if (edge.source && edge.target) {
      g.setEdge(edge.source, edge.target);
    }
  });

  // Calculate layout
  dagre.layout(g);

  // Map calculated positions back to nodes (centering anchor to top-left)
  const positionedNodes = nodes.map((node) => {
    const nodeWithPos = g.node(node.id);
    if (!nodeWithPos) {
      return node;
    }

    return {
      ...node,
      position: {
        x: Math.round(nodeWithPos.x - nodeWidth / 2),
        y: Math.round(nodeWithPos.y - nodeHeight / 2),
      },
    };
  });

  // Hand-drawn bend points belong to the old layout.
  const cleanEdges = (edges || []).map((e) =>
    e.data?.points || e.data?.bend ? { ...e, data: { ...e.data, points: undefined, bend: undefined } } : e
  );

  if (direction !== "LR") return { nodes: positionedNodes, edges: cleanEdges };
  return wrapIntoRows(positionedNodes, cleanEdges, { nodeWidth, nodeHeight, rankSep, maxColumns: options.maxColumns ?? 4 });
}

/**
 * A long left-to-right chain reads badly as one endless row. Like a person filling a
 * screen, fold the Dagre columns into balanced rows and route each row-jumping link
 * down through the gap between rows (step shape with bend points).
 */
function wrapIntoRows<N extends { id: string; position?: { x: number; y: number } }, E extends { source: string; target: string; data?: any }>(
  nodes: N[],
  edges: E[],
  o: { nodeWidth: number; nodeHeight: number; rankSep: number; maxColumns: number }
): { nodes: N[]; edges: E[] } {
  const columnXs = [...new Set(nodes.map((n) => n.position?.x ?? 0))].sort((a, b) => a - b);
  if (columnXs.length <= o.maxColumns) return { nodes, edges };

  const rows = Math.ceil(columnXs.length / o.maxColumns);
  const perRow = Math.ceil(columnXs.length / rows); // 9 columns → 3 × 3, not 4 + 4 + 1
  const ys = nodes.map((n) => n.position?.y ?? 0);
  const minY = Math.min(...ys);
  const rowGap = o.rankSep + 70;
  const rowHeight = Math.max(...ys) - minY + o.nodeHeight + rowGap;
  const colWidth = o.nodeWidth + o.rankSep;

  const rowOf = new Map<string, number>();
  const placed = nodes.map((n) => {
    const col = columnXs.indexOf(n.position?.x ?? 0);
    const row = Math.floor(col / perRow);
    rowOf.set(n.id, row);
    return {
      ...n,
      position: { x: 40 + (col % perRow) * colWidth, y: 40 + (n.position!.y - minY) + row * rowHeight },
    };
  });
  const posOf = new Map(placed.map((n) => [n.id, n.position]));

  const routed = edges.map((e) => {
    const s = posOf.get(e.source), t = posOf.get(e.target);
    if (!s || !t || (rowOf.get(e.target) ?? 0) <= (rowOf.get(e.source) ?? 0)) return e;
    // Approximate handle spots: right-middle of the source, left-middle of the target.
    const sx = s.x + o.nodeWidth, sy = s.y + o.nodeHeight / 2;
    const tx = t.x, ty = t.y + o.nodeHeight / 2;
    const midX = (sx + tx) / 2, midY = (sy + ty) / 2;
    const gapY = 40 + (rowOf.get(e.target)! * rowHeight) - rowGap / 2;
    const points = [
      { dx: sx + 30 - midX, dy: gapY - midY },
      { dx: tx - 40 - midX, dy: gapY - midY },
    ];
    return { ...e, data: { ...e.data, shape: "step", points } };
  });

  return { nodes: placed, edges: routed };
}
