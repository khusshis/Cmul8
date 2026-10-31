import { describe, expect, it } from "vitest";
import { generateSimPyScript } from "@/lib/simulation/codeGenerator";
import { buildJupyterNotebook } from "@/lib/simulation/jupyterExport";
import { generateExecutiveHtmlReport } from "@/lib/simulation/reportGenerator";
import { resolveKpiMetrics } from "@/lib/simulation/resolveKpiMetrics";
import { buildThroughputSeries, buildDepthSeries } from "@/lib/simulation/timelineSelectors";
import { applyDagreLayout } from "@/lib/simulation/layoutEngine";
import { toSimulationRunRow } from "@/lib/simulation/resultPersistence";
import { enrichSimResult, stillInsideCount, calculateResourceOperationalStates, calculateLittlesLaw } from "@/lib/simulation/analyticsEngine";
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
    const r = enrichSimResult(result({
      logs: [log(0, 1, "src", "arrived"), log(2, 1, "sink", "completed")],
      nodeStats: { t: stat({ nodeId: "t", nodeType: "resource", label: "Teller", utilization: 0.9, avgWaitTime: 30 }) },
    }));
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
  const r = enrichSimResult(result({ nodeStats: { r: stat({ nodeId: "r", nodeType: "resource", label: "Desk", utilization: 0.5, avgWaitTime: 20 }) } }));
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
  it("no matching nodes -> N/A, not a fake 0", () => {
    expect(by("level", "units", ["container"]).value).toBeNull();
    expect(by("level", "units", ["container"]).displayValue).toBe("N/A");
    expect(resolveKpiMetrics(undefined as any, r)).toEqual([]);
  });

  // A flow with no Queue block keeps its line inside the server; wait and queue length must come from there.
  const noQueue = result({
    nodeStats: {
      a: stat({ nodeId: "a", nodeType: "resource", label: "Triage", capacity: 2, currentDepth: 19, avgWaitTime: 600, avgServiceTime: 120, entitiesOut: 45, utilization: 0.98 }),
      b: stat({ nodeId: "b", nodeType: "resource", label: "Care", capacity: 2, currentDepth: 11, avgWaitTime: 1200, avgServiceTime: 2400, entitiesOut: 5, utilization: 0.9 }),
    },
  });
  const kpi = (key: any, unit: string, nodeTypes: any[]) => resolveKpiMetrics([{ key, label: "x", unit, chartType: "bar", nodeTypes }], noQueue)[0];
  it("no Queue block: wait and line length come from the servers", () => {
    expect(kpi("avgWaitTime", "min", ["queue"]).value).toBeCloseTo((45 * 10 + 5 * 20) / 50); // weighted by finished
    expect(kpi("currentDepth", "people", ["queue"]).value).toBe(17 + 9); // depth minus those in service
  });
  it("averages weight by entities, utilization by servers", () => {
    expect(kpi("avgServiceTime", "min", ["resource"]).value).toBeCloseTo((45 * 2 + 5 * 40) / 50);
    expect(kpi("utilization", "%", ["resource"]).value).toBeCloseTo(94);
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
  it("depth series counts only those waiting: servers lose their in-service, delays are dropped", () => {
    const d = buildDepthSeries(result({
      nodeStats: {
        r: stat({ nodeId: "r", nodeType: "resource", label: "Desk", capacity: 2 }),
        s: stat({ nodeId: "s", nodeType: "service", label: "Delay" }),
      },
      timeline: [{ simTime: 60, completed: 0, depth: { r: 5, s: 9 } }],
    }));
    expect(d.nodeLabels).toEqual(["Desk"]);
    expect(d.series[0].Desk).toBe(3);
  });
});

describe("capacity suggestion for a shared line", () => {
  it("sizes all servers behind one queue from the line's arrivals, not one server's share", () => {
    // 200 arrivals x 5 min over 100 min = 10 servers' worth of work, against 3 tellers.
    const teller = (id: string) => stat({ nodeId: id, nodeType: "resource", label: id, capacity: 1, utilization: 1, avgServiceTime: 300, entitiesIn: 20, entitiesOut: 19, avgWaitTime: 2000, fedBy: "q" });
    const e = enrichSimResult(result({
      totalSimTime: 6000,
      totalArrived: 200,
      totalCompleted: 57,
      nodeStats: { q: stat({ nodeId: "q", nodeType: "queue", label: "Line", entitiesIn: 200, avgWaitTime: 2000 }), t1: teller("t1"), t2: teller("t2"), t3: teller("t3") },
    }));
    const rec = e.aiDiagnosis!.recommendations[0] as any;
    expect(rec.title).toBe('Add 10 servers behind "Line" (3 → 13)');
    expect(rec.fix.paramPatch.capacity).toBe(11); // all 10 extra on one block of the pool
  });
});

describe("counts that leave the system", () => {
  const r = result({
    totalSimTime: 100,
    totalArrived: 100,
    totalCompleted: 20,
    nodeStats: {
      q: stat({ nodeId: "q", nodeType: "queue", droppedCount: 50, renegeCount: 10 }),
      r: stat({ nodeId: "r", nodeType: "resource", capacity: 4, utilization: 0.5, busySeconds: 200 }),
    },
  });
  it("turned-away and gave-up entities are not 'still inside'", () => {
    expect(stillInsideCount(r)).toBe(20);
  });
  it("busy time covers every parallel server, so per-server costs aren't undercounted", () => {
    expect(calculateResourceOperationalStates(r.nodeStats, 100).r.busySeconds).toBe(200);
    expect(calculateResourceOperationalStates({ r: stat({ nodeId: "r", nodeType: "resource", capacity: 4, utilization: 0.5 }) }, 100).r.busySeconds).toBe(200);
  });
  it("Little's law expectation uses only arrivals that got in", () => {
    const ll = calculateLittlesLaw({ ...r, totalCompleted: 0 }, [{ status: "completed", totalCycleTime: 10 } as any]);
    expect(ll.computedWIP_LambdaW).toBeCloseTo((50 / 100) * 10);
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
    const e = enrichSimResult(result({ logs: [log(0, 1, "a", "arrived")], nodeStats: { r: stat({ nodeId: "r", nodeType: "resource", avgWaitTime: 5 }) } }));
    const row = toSimulationRunRow("p1", "u1", e, 12.6);
    expect(row).toMatchObject({ project_id: "p1", user_id: "u1", duration_seconds: 13, bottleneck_node: "r" });
    expect(row.logs_json).toHaveLength(1);
    expect(row.result_json).not.toHaveProperty("logs");
    expect(row.result_json).not.toHaveProperty("entityJourneys");
    expect(row.result_json).toHaveProperty("nodeStats");
  });
});
