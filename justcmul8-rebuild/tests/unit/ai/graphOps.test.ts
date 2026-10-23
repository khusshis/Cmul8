import { describe, expect, it } from "vitest";
import {
  sanitizeParams,
  coerceActionType,
  normalizeAIResponse,
  connectivityWarnings,
  repairGraph,
  applyAIOps,
  summarizeCanvas,
  snapshotForHistory,
  MAX_OPS_PER_RESPONSE,
  MAX_UNCONFIRMED_DELETES,
  type AINode,
  type AIEdge,
} from "@/lib/ai/graphOps";

const rf = (id: string, nodeType: string, params: any = {}, label = id) => ({
  id, type: "simNode", position: { x: 0, y: 0 }, data: { nodeType, label, params },
});

describe("sanitizeParams", () => {
  it("clamps resource params and defaults unknown enums", () => {
    const w: string[] = [];
    const p = sanitizeParams("resource", { capacity: 0, serviceTimeMean: -2, serviceDistribution: "weird" }, "R", w);
    expect(p.capacity).toBe(1);
    expect(p.serviceTimeMean).toBe(1);
    expect(p.serviceDistribution).toBe("exponential");
    expect(w.length).toBe(3);
  });
  it("capacity -1 (unlimited) is allowed for queue", () => {
    expect(sanitizeParams("queue", { capacity: -1 }, "Q", []).capacity).toBe(-1);
    expect(sanitizeParams("queue", { capacity: 0 }, "Q", []).capacity).toBe(-1); // invalid -> unlimited
  });
  it("preserves unknown user keys", () => {
    expect(sanitizeParams("source", { arrivalRate: 2, myCustom: "keep" }, "S", []).myCustom).toBe("keep");
  });
  it("swaps patienceMin/Max when inverted and clamps container initialLevel", () => {
    const q = sanitizeParams("queue", { patienceMin: 9, patienceMax: 2 }, "Q", []);
    expect([q.patienceMin, q.patienceMax]).toEqual([2, 9]);
    const c = sanitizeParams("container", { capacity: 100, initialLevel: 500 }, "C", []);
    expect(c.initialLevel).toBe(100);
  });
});

describe("coerceActionType", () => {
  it("normalises casing and separators", () => {
    expect(coerceActionType("add-nodes")).toBe("ADD_NODES");
    expect(coerceActionType("replace graph")).toBe("REPLACE_GRAPH");
  });
  it("maps explain/diagnose and anything unknown to NONE", () => {
    for (const v of ["EXPLAIN_OR_DIAGNOSE", "diagnose", "analyze", "frobnicate", null, 42]) {
      expect(coerceActionType(v as any)).toBe("NONE");
    }
  });
});

describe("normalizeAIResponse — canvas-protection", () => {
  it("downgrades REPLACE on a populated canvas to a merge unless a rebuild was asked", () => {
    const { ops, warnings } = normalizeAIResponse(
      { actionType: "REPLACE_GRAPH", graph: { nodes: [{ id: "a", nodeType: "source", label: "A", params: { arrivalRate: 1 } }], edges: [] } },
      5,
      "make the desk faster"
    );
    expect(ops.actionType).toBe("UPDATE_NODES");
    expect(ops.replaceGraph).toBeUndefined();
    expect(warnings.join(" ")).toMatch(/merged/i);
  });
  it("allows REPLACE when the user explicitly asks to rebuild", () => {
    const { ops } = normalizeAIResponse(
      { actionType: "REPLACE_GRAPH", graph: { nodes: [{ id: "a", nodeType: "source", label: "A", params: { arrivalRate: 1 } }], edges: [] } },
      5,
      "start over from scratch and build a new bank simulation"
    );
    expect(ops.actionType).toBe("REPLACE_GRAPH");
    expect(ops.replaceGraph!.nodes).toHaveLength(1);
  });
  it("drops unknown block types rather than guessing", () => {
    const { ops, warnings } = normalizeAIResponse(
      { actionType: "REPLACE_GRAPH", graph: { nodes: [{ id: "a", nodeType: "teleporter", label: "A", params: {} }], edges: [] } },
      0,
      "build a model"
    );
    expect(ops.actionType).toBe("NONE");
    expect(warnings.join(" ")).toMatch(/unknown block type/i);
  });
});

describe("normalizeAIResponse — prompt-injection hardening", () => {
  it("refuses a bulk delete the user did not ask for", () => {
    const ids = Array.from({ length: MAX_UNCONFIRMED_DELETES + 3 }, (_, i) => `n${i}`);
    const { ops, warnings } = normalizeAIResponse({ actionType: "DELETE_NODES", deleteNodeIds: ids }, 20, "optimise my model");
    expect(ops.deleteNodeIds).toEqual([]);
    expect(warnings.join(" ")).toMatch(/delete/i);
  });
  it("allows a bulk delete with the confirm flag", () => {
    const ids = Array.from({ length: MAX_UNCONFIRMED_DELETES + 3 }, (_, i) => `n${i}`);
    const { ops } = normalizeAIResponse({ actionType: "DELETE_NODES", deleteNodeIds: ids }, 20, "clear it", { confirmBulkDelete: true });
    expect(ops.deleteNodeIds.length).toBe(ids.length);
  });
  it("caps the number of operations in one reply", () => {
    const nodes = Array.from({ length: MAX_OPS_PER_RESPONSE + 10 }, (_, i) => ({ id: `n${i}`, nodeType: "source", label: `N${i}`, params: { arrivalRate: 1 } }));
    const { ops, warnings } = normalizeAIResponse({ actionType: "ADD_NODES", addNodes: nodes }, 0, "add many");
    expect(ops.actionType).toBe("NONE");
    expect(warnings.join(" ")).toMatch(/limit/i);
  });
});

describe("connectivityWarnings", () => {
  const n = (id: string, t: AINode["nodeType"]): AINode => ({ id, nodeType: t, label: id, params: {} });
  it("flags missing source, sink and unreachable blocks", () => {
    const w = connectivityWarnings([n("a", "queue"), n("b", "resource")], []);
    expect(w.join(" ")).toMatch(/no entry point/i);
    expect(w.join(" ")).toMatch(/no exit point/i);
  });
  it("reports orphans unreachable from a source", () => {
    const nodes = [n("s", "source"), n("k", "sink"), n("orphan", "resource")];
    const edges: AIEdge[] = [{ id: "e", source: "s", target: "k" }];
    expect(connectivityWarnings(nodes, edges).join(" ")).toMatch(/cannot be reached/i);
  });
  it("no warnings for a well-formed line", () => {
    const nodes = [n("s", "source"), n("k", "sink")];
    expect(connectivityWarnings(nodes, [{ id: "e", source: "s", target: "k" }])).toEqual([]);
  });
});

describe("repairGraph", () => {
  const n = (id: string, t: AINode["nodeType"], params: any = {}): AINode => ({ id, nodeType: t, label: id, params });
  it("drops dangling and self-loop edges and de-dupes", () => {
    const { edges } = repairGraph(
      [n("a", "source"), n("b", "sink")],
      [{ id: "1", source: "a", target: "b" }, { id: "2", source: "a", target: "ghost" }, { id: "3", source: "a", target: "a" }, { id: "4", source: "a", target: "b" }],
      []
    );
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ source: "a", target: "b" });
  });
  it("normalises decision route probabilities to sum to 1", () => {
    const dec = n("d", "decision", { routes: [{ targetId: "x", probability: 3 }, { targetId: "y", probability: 1 }] });
    const { nodes } = repairGraph([dec, n("x", "sink"), n("y", "sink")], [{ id: "e1", source: "d", target: "x" }, { id: "e2", source: "d", target: "y" }], []);
    const routes = (nodes.find((x) => x.id === "d")!.params as any).routes;
    expect(routes.reduce((a: number, r: any) => a + r.probability, 0)).toBeCloseTo(1);
  });
});

describe("applyAIOps — non-destructive merge", () => {
  const canvas = [rf("s", "source", { arrivalRate: 1 }), rf("r", "resource", { capacity: 1, serviceTimeMean: 2 })];
  const edges = [{ id: "e", source: "s", target: "r", type: "simEdge" }];

  it("NONE leaves the canvas untouched", () => {
    const out = applyAIOps(canvas, edges, { actionType: "NONE", upsertNodes: [], addEdges: [], deleteNodeIds: [], deleteEdgeIds: [] });
    expect(out.changed).toBe(false);
    expect(out.nodes).toBe(canvas);
  });
  it("UPDATE_NODES merges params and never drops unmentioned nodes", () => {
    const out = applyAIOps(canvas, edges, {
      actionType: "UPDATE_NODES",
      upsertNodes: [{ id: "r", params: { serviceTimeMean: 5 } }],
      addEdges: [], deleteNodeIds: [], deleteEdgeIds: [],
    });
    expect(out.nodes).toHaveLength(2);
    expect(out.nodes.find((n) => n.id === "r").data.params.serviceTimeMean).toBe(5);
    expect(out.nodes.find((n) => n.id === "r").data.params.capacity).toBe(1);
  });
  it("ADD_NODES places a new block and keeps old ones", () => {
    const out = applyAIOps(canvas, edges, {
      actionType: "ADD_NODES",
      upsertNodes: [{ id: "k", nodeType: "sink", label: "Exit", params: {} }],
      addEdges: [{ id: "e2", source: "r", target: "k" }],
      deleteNodeIds: [], deleteEdgeIds: [],
    });
    expect(out.nodes.map((n) => n.id).sort()).toEqual(["k", "r", "s"]);
    expect(out.newNodeIds).toEqual(["k"]);
    expect(out.edges.some((e) => e.source === "r" && e.target === "k")).toBe(true);
  });
  it("DELETE_NODES removes a node and its edges", () => {
    const out = applyAIOps(canvas, edges, {
      actionType: "DELETE_NODES", upsertNodes: [], addEdges: [], deleteNodeIds: ["r"], deleteEdgeIds: [],
    });
    expect(out.nodes.map((n) => n.id)).toEqual(["s"]);
    expect(out.edges).toHaveLength(0);
  });
  it("REPLACE_GRAPH swaps the whole canvas and requests a full layout", () => {
    const out = applyAIOps(canvas, edges, {
      actionType: "REPLACE_GRAPH",
      replaceGraph: { nodes: [{ id: "a", nodeType: "source", label: "A", params: { arrivalRate: 1 } }, { id: "b", nodeType: "sink", label: "B", params: {} }], edges: [{ id: "e", source: "a", target: "b" }] },
      upsertNodes: [], addEdges: [], deleteNodeIds: [], deleteEdgeIds: [],
    });
    expect(out.nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
    expect(out.needsFullLayout).toBe(true);
  });
});

describe("summarizeCanvas / snapshotForHistory", () => {
  const canvas = [rf("s", "source", { arrivalRate: 1 })];
  it("summarizeCanvas drops coordinates", () => {
    expect(summarizeCanvas(canvas, [])).toEqual({ nodes: [{ id: "s", nodeType: "source", label: "s", params: { arrivalRate: 1 } }], edges: [] });
  });
  it("snapshotForHistory keeps coordinates", () => {
    expect(snapshotForHistory(canvas, [])).toEqual({ nodes: [{ id: "s", nodeType: "source", label: "s", params: { arrivalRate: 1 }, position: { x: 0, y: 0 } }], edges: [] });
  });
});
