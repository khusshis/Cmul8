import { describe, expect, it } from "vitest";
import { generateSimPyScript } from "@/lib/simulation/codeGenerator";
import { buildJupyterNotebook } from "@/lib/simulation/jupyterExport";
import { generateExecutiveHtmlReport } from "@/lib/simulation/reportGenerator";
import { resolveKpiMetrics } from "@/lib/simulation/resolveKpiMetrics";
import { buildThroughputSeries, buildDepthSeries } from "@/lib/simulation/timelineSelectors";
import { applyDagreLayout } from "@/lib/simulation/layoutEngine";
import { toSimulationRunRow } from "@/lib/simulation/resultPersistence";
import { enrichSimResult } from "@/lib/simulation/analyticsEngine";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import { queueGraph, result, stat, log } from "../helpers";

describe("codeGenerator output shape", () => {
  it("fills every placeholder", () => {
    const { python } = generateSimPyScript(queueGraph(0.8, 1), 3600, 3.6);
    expect(python).toContain("DURATION = 3600");
    expect(python).toContain("TICK_INTERVAL = 3.6");
    expect(python).not.toMatch(/\{(DURATION|TICK_INTERVAL|NODE_CONFIG_JSON|EDGES_JSON)\}/);
    expect(python).toContain("def run_simulation");
    expect(python).toContain('"src"');
  });
});

describe("jupyterExport.buildJupyterNotebook", () => {
  it("produces a valid nbformat 4 notebook with code + summary cells", () => {
    const r = enrichSimResult(result({ logs: [log(0, 1, "src", "arrived"), log(2, 1, "sink", "completed")], bottleneckLabel: "Teller" }));
    const nb = buildJupyterNotebook("print('hi')\nx = 1", "My Model", r);
    expect(nb.nbformat).toBe(4);
    expect(nb.metadata.kernelspec.name).toBe("python3");
    expect(nb.cells.map((c: any) => c.cell_type)).toEqual(["markdown", "code", "markdown"]);
    const code = nb.cells[1].source.join("");
    expect(code).toContain("def emit_sim_tick");
    expect(code.endsWith("x = 1")).toBe(true);
    expect(nb.cells[2].source.join("")).toContain("Teller");
    expect(() => JSON.parse(JSON.stringify(nb))).not.toThrow();
  });
  it("omits the results cell without a result", () => {
    expect(buildJupyterNotebook("pass").cells).toHaveLength(2);
  });
});

describe("reportGenerator.generateExecutiveHtmlReport", () => {
  const r = enrichSimResult(result({ bottleneckNodeId: "r", nodeStats: { r: stat({ nodeId: "r", nodeType: "resource", label: "Desk", utilization: 0.5 }) } }));
  it("renders the summary sections", () => {
    const html = generateExecutiveHtmlReport(r, "Bank Sim");
    for (const s of ["Bank Sim", "Executive Diagnosis", "Block Telemetry Breakdown", "Desk", "BOTTLENECK"]) expect(html).toContain(s);
  });
  // Project and block names are user-controlled (and editable by collaborators); they must be HTML-escaped.
  // BUG(XSS): project & block names (user/collaborator-controlled) are interpolated into the HTML report unescaped.
  it("escapes HTML in project and block names", () => {
    const evil = enrichSimResult(result({ nodeStats: { r: stat({ nodeId: "r", nodeType: "resource", label: "<b>Desk</b>" }) } }));
    const html = generateExecutiveHtmlReport(evil, "<i>Proj</i>");
    expect(html).not.toContain("<i>Proj</i>");
    expect(html).not.toContain("<b>Desk</b>");
  });
});

describe("resolveKpiMetrics", () => {
  const r = result({
    totalSimTime: 7200,
    totalArrived: 120,
    totalCompleted: 100,
    bottleneckNodeId: "r",
    nodeStats: {
      q: stat({ nodeId: "q", nodeType: "queue", label: "Q", avgWaitTime: 120, currentDepth: 4 }),
      r: stat({ nodeId: "r", nodeType: "resource", label: "R", utilization: 0.756, avgServiceTime: 60 }),
      ch: stat({ nodeId: "ch", nodeType: "channel", label: "C", droppedCount: 3, avgLatency: 0.02 }),
      st: stat({ nodeId: "st", nodeType: "store", label: "S", droppedCount: 2 }),
    },
  });
  const by = (key: any, unit: string, nodeTypes: any[] = [], label = "x") =>
    resolveKpiMetrics([{ key, label, unit, chartType: "bar", nodeTypes }], r)[0];

  it("converts seconds to the labelled unit", () => {
    expect(by("avgWaitTime", "min", ["queue"]).value).toBe(2);
    expect(by("avgLatency", "ms", ["channel"]).value).toBe(20);
  });
  it("utilisation is a percentage", () => {
    expect(by("utilization", "%", ["resource"]).displayValue).toBe("76%");
  });
  it("sums counts across nodes", () => {
    expect(by("droppedCount", "msgs", ["channel", "store"]).value).toBe(5);
  });
  it("throughput per hour", () => {
    expect(by("totalCompleted", "parts/hr").value).toBe(50);
  });
  it("bottleneck shows the node label", () => {
    expect(by("bottleneck", "").displayValue).toBe("R");
  });
  it("no matching nodes -> 0, not a crash", () => {
    expect(by("level", "units", ["container"]).value).toBe(0);
    expect(resolveKpiMetrics(undefined as any, r)).toEqual([]);
  });
  // BUG: "Vehicles / hour" (unit "veh") and "Packages / hour" (unit "pkgs") show the raw total,
  // because only the unit string is checked for "/hr".
  // BUG: resolveKpiMetrics only converts totalCompleted to per-hour when the UNIT contains "/hr"; registry
  // KPIs like "Vehicles / hour" (unit "veh") and "Packages / hour" (unit "pkgs") show the raw total instead.
  it("every registry KPI labelled per-hour is actually per hour", () => {
    for (const cfg of Object.values(SIM_TYPE_REGISTRY)) {
      for (const m of cfg.kpiMetrics.filter((k) => k.key === "totalCompleted" && /\/\s*h(ou)?r/i.test(k.label + " " + k.unit))) {
        expect(resolveKpiMetrics([m], r)[0].value, `${cfg.id}: ${m.label}`).toBe(50);
      }
    }
  });
});

describe("timelineSelectors", () => {
  const r = result({
    nodeStats: { q: stat({ nodeId: "q", nodeType: "queue", label: "Line" }) },
    timeline: [
      { simTime: 60, completed: 6, depth: { q: 2 } },
      { simTime: 120, completed: 18, depth: { q: 5 } },
    ],
  });
  it("throughput per minute from completed deltas", () => {
    expect(buildThroughputSeries(r).map((p) => p.completedPerMin)).toEqual([6, 12]);
  });
  it("depth series keyed by node label", () => {
    const d = buildDepthSeries(r);
    expect(d.nodeLabels).toEqual(["Line"]);
    expect(d.series[1].Line).toBe(5);
  });
});

describe("layoutEngine.applyDagreLayout", () => {
  const nodes = Array.from({ length: 9 }, (_, i) => ({ id: `n${i}`, position: { x: 0, y: 0 } }));
  const edges = nodes.slice(1).map((n, i) => ({ id: `e${i}`, source: `n${i}`, target: n.id, data: { points: [1] } }));
  it("gives every node a distinct, non-overlapping position", () => {
    const out = applyDagreLayout(nodes, edges);
    const keys = new Set(out.nodes.map((n) => `${n.position!.x},${n.position!.y}`));
    expect(keys.size).toBe(9);
    for (const a of out.nodes) for (const b of out.nodes) {
      if (a === b) continue;
      const overlap = Math.abs(a.position!.x - b.position!.x) < 200 && Math.abs(a.position!.y - b.position!.y) < 90;
      expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
    }
  });
  it("wraps a long LR chain into rows (<= maxColumns per row)", () => {
    const out = applyDagreLayout(nodes, edges, { maxColumns: 4 });
    expect(new Set(out.nodes.map((n) => n.position!.x)).size).toBeLessThanOrEqual(4);
    expect(new Set(out.nodes.map((n) => n.position!.y)).size).toBeGreaterThan(1);
  });
  it("TB layout and empty input", () => {
    expect(applyDagreLayout(nodes.slice(0, 3), edges.slice(0, 2), { direction: "TB" }).nodes).toHaveLength(3);
    expect(applyDagreLayout([], []).nodes).toEqual([]);
  });
});

describe("resultPersistence.toSimulationRunRow", () => {
  it("stores a summary without duplicated logs / journeys", () => {
    const e = enrichSimResult(result({ bottleneckNodeId: "r", logs: [log(0, 1, "a", "arrived")] }));
    const row = toSimulationRunRow("p1", "u1", e, 12.6);
    expect(row).toMatchObject({ project_id: "p1", user_id: "u1", duration_seconds: 13, bottleneck_node: "r" });
    expect(row.logs_json).toHaveLength(1);
    expect(row.result_json).not.toHaveProperty("logs");
    expect(row.result_json).not.toHaveProperty("entityJourneys");
    expect(row.result_json).toHaveProperty("nodeStats");
  });
});
