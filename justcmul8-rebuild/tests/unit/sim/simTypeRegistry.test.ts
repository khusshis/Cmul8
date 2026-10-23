import { describe, expect, it } from "vitest";
import { SIM_TYPE_REGISTRY, NODE_LABELS, getAllSimTypes, getNodeSprite } from "@/lib/simulation/simTypeRegistry";
import { NODE_TYPES } from "@/lib/ai/graphOps";
import type { NodeType } from "@/lib/simulation/types";

const ENGINE_NODE_TYPES = new Set<NodeType>(NODE_TYPES as readonly NodeType[]);

describe("simTypeRegistry consistency", () => {
  it("NODE_LABELS covers exactly the engine node types", () => {
    expect(new Set(Object.keys(NODE_LABELS))).toEqual(ENGINE_NODE_TYPES);
  });

  it("every registry has the required fields and a unique id matching its key", () => {
    for (const [key, cfg] of Object.entries(SIM_TYPE_REGISTRY)) {
      expect(cfg.id).toBe(key);
      expect(cfg.label && cfg.entityName && cfg.layoutStrategy).toBeTruthy();
      expect(cfg.paletteNodes.length).toBeGreaterThan(0);
      expect(cfg.kpiMetrics.length).toBeGreaterThan(0);
      expect(cfg.aiSystemPrompt.length).toBeGreaterThan(10);
    }
    expect(getAllSimTypes().length).toBe(Object.keys(SIM_TYPE_REGISTRY).length);
  });

  it("every palette node type is a real engine node type the engine handles", () => {
    for (const cfg of getAllSimTypes()) {
      for (const pn of cfg.paletteNodes) {
        expect(ENGINE_NODE_TYPES.has(pn.type), `${cfg.id}: palette type ${pn.type}`).toBe(true);
      }
    }
  });

  it("every starter-graph node type is valid and every edge references real nodes", () => {
    for (const cfg of getAllSimTypes()) {
      for (const sc of cfg.subScenarios) {
        const ids = new Set(sc.nodes.map((n) => n.id));
        expect(ids.size, `${cfg.id}/${sc.label}: duplicate node id`).toBe(sc.nodes.length);
        for (const n of sc.nodes) expect(ENGINE_NODE_TYPES.has(n.nodeType), `${cfg.id}/${sc.label}: ${n.nodeType}`).toBe(true);
        for (const e of sc.edges) {
          expect(ids.has(e.source), `${cfg.id}/${sc.label}: edge source ${e.source}`).toBe(true);
          expect(ids.has(e.target), `${cfg.id}/${sc.label}: edge target ${e.target}`).toBe(true);
        }
        // A non-empty starter graph must have an entry and an exit ("Start from scratch" is intentionally empty).
        if (sc.nodes.length > 0) {
          expect(sc.nodes.some((n) => n.nodeType === "source"), `${cfg.id}/${sc.label}: no source`).toBe(true);
          expect(sc.nodes.some((n) => n.nodeType === "sink"), `${cfg.id}/${sc.label}: no sink`).toBe(true);
        }
      }
    }
  });

  it("decision starter nodes route only to nodes that exist", () => {
    for (const cfg of getAllSimTypes()) {
      for (const sc of cfg.subScenarios) {
        const ids = new Set(sc.nodes.map((n) => n.id));
        for (const n of sc.nodes.filter((n) => n.nodeType === "decision")) {
          for (const r of (n.params as any).routes ?? []) {
            expect(ids.has(r.targetId), `${cfg.id}/${sc.label}: route -> ${r.targetId}`).toBe(true);
          }
        }
      }
    }
  });

  it("getNodeSprite always returns a path (falls back to the entity sprite)", () => {
    for (const cfg of getAllSimTypes()) {
      expect(getNodeSprite(cfg.id, "source")).toBeTruthy();
      expect(getNodeSprite(cfg.id, "totally_unknown")).toBe(cfg.entitySprites[0]);
    }
  });
});
