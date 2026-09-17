import dagre from "dagre";

export interface LayoutOptions {
  direction?: "LR" | "TB";
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
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

  return {
    nodes: positionedNodes,
    edges: edges || [],
  };
}
