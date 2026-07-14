/**
 * SimType Registry — Single source of truth for all simulation type configurations.
 *
 * Every component that needs type-specific behaviour (NodePalette, NodeCanvas,
 * ViewportPanel, AI route, SimResultsPanel, LayoutEngine) imports from here.
 * Never scatter type-specific logic across components.
 */

import type { SimTypeId, NodeType, DistributionType } from "./types";

// ─── Sub-Types ────────────────────────────────────────────────────────────────

export type LayoutStrategyId =
  | "bank_branch"    // Human Queue: left→right, sources left wall, resources right wall
  | "intersection"   // Vehicle: approaches from cardinal directions, decision at center
  | "linear_lane"    // Vehicle: linear flow (gas station, car wash)
  | "pipeline"       // Liquid: topological sort, vertical columns
  | "assembly_line"  // Manufacturing: longest-path horizontal, branches vertical
  | "warehouse"      // Logistics: sources top, sinks bottom, BFS row layout
  | "network_topology"; // Network/Signal: force-directed or manual; arbitrary graph

export interface PathStyleConfig {
  strokeColor: string;       // CSS color
  strokeWidth: number;       // px
  dashPattern?: number[];    // e.g. [8, 4] for dashed
  arrowInterval?: number;    // px between directional arrows
  tickInterval?: number;     // px between conveyor tick marks
  animated?: boolean;        // animated dash offset (pipes / liquid flow)
}

export interface PaletteNode {
  type: NodeType;
  label: string;           // type-specific label (e.g. "Teller" not "Resource")
  icon: string;            // emoji fallback icon
  color: string;           // CSS var
  desc: string;            // short description
  spriteKey?: string;      // key into SimTypeConfig.nodeSprites
}

export interface KpiMetricDef {
  key: keyof import("./types").NodeStats | "totalArrived" | "totalCompleted" | "bottleneck";
  label: string;
  unit: string;
  chartType: "bar" | "line" | "pie" | "kpi_card";
  nodeTypes?: NodeType[];  // which node types this metric applies to (empty = global)
}

export interface StarterGraph {
  label: string;           // e.g. "Bank Tellers"
  description: string;
  nodes: Array<{
    id: string;
    nodeType: NodeType;
    label: string;
    position: { x: number; y: number };
    params: Record<string, unknown>;
  }>;
  edges: Array<{ id: string; source: string; target: string }>;
}

export interface SimTypeConfig {
  id: SimTypeId;
  label: string;
  icon: string;
  color: string;              // primary CSS var for this type
  entityName: string;         // human name for entities (e.g. "Customer", "Vehicle")

  // Sprites (paths relative to /public/sim-assets/[type]/)
  entitySprites: string[];
  nodeSprites: Record<string, string>;
  backgroundAsset: string;

  // Layout & rendering
  layoutStrategy: LayoutStrategyId;
  pathStyle: PathStyleConfig;

  // Palette
  paletteNodes: PaletteNode[];

  // Sub-scenarios with starter graphs
  subScenarios: StarterGraph[];

  // KPI metrics to show in the Results tab (type-specific)
  kpiMetrics: KpiMetricDef[];

  // AI system prompt suffix (injected into the Gemini API route)
  aiSystemPrompt: string;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const SIM_TYPE_REGISTRY: Record<SimTypeId, SimTypeConfig> = {

  // ── 1. HUMAN QUEUE ──────────────────────────────────────────────────────────
  human_queue: {
    id: "human_queue",
    label: "HUMAN QUEUE",
    icon: "🧍",
    color: "var(--neon-green)",
    entityName: "Customer",

    entitySprites: [
      "/sim-assets/human_queue/entity-person.png",
    ],
    nodeSprites: {
      source:   "/sim-assets/human_queue/node-door.png",
      queue:    "/sim-assets/human_queue/node-queue-barrier.png",
      resource: "/sim-assets/human_queue/node-counter.png",
      service:  "/sim-assets/human_queue/node-counter.png",
      sink:     "/sim-assets/human_queue/node-exit.png",
      decision: "/sim-assets/human_queue/node-exit.png",
    },
    backgroundAsset: "/sim-assets/human_queue/bg-floor.png",

    layoutStrategy: "bank_branch",
    pathStyle: {
      strokeColor: "rgba(16, 185, 129, 0.5)",
      strokeWidth: 1.5,
      dashPattern: [8, 6],
    },

    paletteNodes: [
      { type: "source",   label: "Entry",       icon: "🚪", color: "var(--neon-green)",  desc: "Customer arrival point",       spriteKey: "source" },
      { type: "queue",    label: "Queue",        icon: "🚧", color: "var(--neon-yellow)", desc: "Waiting line",                 spriteKey: "queue" },
      { type: "resource", label: "Teller/Agent", icon: "🖥️", color: "var(--neon-green)",  desc: "Service desk, capacity-based", spriteKey: "resource" },
      { type: "service",  label: "Service Step", icon: "⚡", color: "var(--neon-cyan)",   desc: "Fixed processing step",        spriteKey: "service" },
      { type: "decision", label: "Route",        icon: "🔀", color: "var(--neon-purple)", desc: "Probabilistic routing",        spriteKey: "decision" },
      { type: "sink",     label: "Exit",         icon: "🚪", color: "var(--neon-red)",    desc: "Entity leaves, KPIs collected",spriteKey: "sink" },
      { type: "store",    label: "Buffer/Store", icon: "📦", color: "var(--neon-pink)",   desc: "Items buffer (filter/priority)",spriteKey: "source" },
      { type: "any_of",   label: "Any Of (OR)",  icon: "🔱", color: "var(--neon-yellow)", desc: "Wait for ANY upstream event",  spriteKey: "decision" },
      { type: "all_of",   label: "All Of (AND)", icon: "⛓️", color: "var(--neon-yellow)", desc: "Wait for ALL upstream events", spriteKey: "decision" },
      { type: "interrupter", label: "Interrupt", icon: "⚠️", color: "var(--neon-red)",    desc: "Interrupt a target process",   spriteKey: "decision" },
      { type: "event_trigger", label: "Event",   icon: "🔔", color: "var(--neon-orange)", desc: "Triggers a global event",      spriteKey: "source" },
    ],

    subScenarios: [
      {
        label: "Bank Tellers",
        description: "Customers arrive, queue, and are served by 3 tellers",
        nodes: [
          { id: "n1", nodeType: "source",   label: "Customer Arrival", position: { x: 100, y: 250 }, params: { arrivalRate: 2, distribution: "exponential" } },
          { id: "n2", nodeType: "queue",    label: "Waiting Queue",    position: { x: 320, y: 250 }, params: { capacity: -1, discipline: "FIFO" } },
          { id: "n3", nodeType: "resource", label: "Teller 1",         position: { x: 560, y: 150 }, params: { capacity: 1, serviceTimeMean: 5, serviceDistribution: "exponential" } },
          { id: "n4", nodeType: "resource", label: "Teller 2",         position: { x: 560, y: 280 }, params: { capacity: 1, serviceTimeMean: 5, serviceDistribution: "exponential" } },
          { id: "n5", nodeType: "resource", label: "Teller 3",         position: { x: 560, y: 410 }, params: { capacity: 1, serviceTimeMean: 5, serviceDistribution: "exponential" } },
          { id: "n6", nodeType: "sink",     label: "Exit",             position: { x: 780, y: 250 }, params: { collectKPIs: true } },
        ],
        edges: [
          { id: "e1", source: "n1", target: "n2" },
          { id: "e2", source: "n2", target: "n3" },
          { id: "e3", source: "n2", target: "n4" },
          { id: "e4", source: "n2", target: "n5" },
          { id: "e5", source: "n3", target: "n6" },
          { id: "e6", source: "n4", target: "n6" },
          { id: "e7", source: "n5", target: "n6" },
        ],
      },
      {
        label: "ER Triage",
        description: "Patients arrive, are triaged, then routed to treatment",
        nodes: [
          { id: "n1", nodeType: "source",   label: "Patient Arrival",  position: { x: 100, y: 250 }, params: { arrivalRate: 1, distribution: "poisson" } },
          { id: "n2", nodeType: "resource", label: "Triage Nurse",     position: { x: 300, y: 250 }, params: { capacity: 2, serviceTimeMean: 3, serviceDistribution: "exponential" } },
          { id: "n3", nodeType: "decision", label: "Triage Decision",  position: { x: 500, y: 250 }, params: { routes: [{ targetId: "n4", probability: 0.3 }, { targetId: "n5", probability: 0.7 }] } },
          { id: "n4", nodeType: "resource", label: "Critical Care",    position: { x: 700, y: 150 }, params: { capacity: 2, serviceTimeMean: 30, serviceDistribution: "normal" } },
          { id: "n5", nodeType: "resource", label: "Minor Treatment",  position: { x: 700, y: 350 }, params: { capacity: 4, serviceTimeMean: 10, serviceDistribution: "exponential" } },
          { id: "n6", nodeType: "sink",     label: "Discharged",       position: { x: 900, y: 250 }, params: { collectKPIs: true } },
        ],
        edges: [
          { id: "e1", source: "n1", target: "n2" },
          { id: "e2", source: "n2", target: "n3" },
          { id: "e3", source: "n3", target: "n4" },
          { id: "e4", source: "n3", target: "n5" },
          { id: "e5", source: "n4", target: "n6" },
          { id: "e6", source: "n5", target: "n6" },
        ],
      },
      {
        label: "Start from scratch",
        description: "Empty canvas — build your own flow",
        nodes: [],
        edges: [],
      },
    ],

    kpiMetrics: [
      { key: "avgWaitTime",      label: "Avg Wait Time",     unit: "min",     chartType: "bar",      nodeTypes: ["queue"] },
      { key: "utilization",      label: "Staff Utilization", unit: "%",       chartType: "pie",      nodeTypes: ["resource"] },
      { key: "totalCompleted",   label: "Total Served",      unit: "people",  chartType: "kpi_card", nodeTypes: [] },
      { key: "currentDepth",     label: "Queue Length",      unit: "people",  chartType: "line",     nodeTypes: ["queue"] },
      { key: "avgServiceTime",   label: "Avg Service Time",  unit: "min",     chartType: "bar",      nodeTypes: ["resource", "service"] },
    ],

    aiSystemPrompt: `You are helping design a HUMAN QUEUE discrete-event simulation.
Entities are PEOPLE (customers, patients, passengers).
Use these node types: source (entry), queue (waiting line), resource (teller/nurse/agent — capacity-limited server), service (fixed processing step), decision (probabilistic routing), sink (exit/KPI collection).
Use realistic labels: "Customer Arrival", "Waiting Queue", "Bank Teller", "Checkout Counter", "ER Nurse", etc.
Arrival rates are in customers/minute. Service times are in minutes.`,
  },

  // ── 2. VEHICLE ──────────────────────────────────────────────────────────────
  vehicle: {
    id: "vehicle",
    label: "VEHICLE",
    icon: "🚗",
    color: "var(--neon-cyan)",
    entityName: "Vehicle",

    entitySprites: [
      "/sim-assets/vehicle/entity-car.png",
      "/sim-assets/vehicle/entity-truck-bus.png",
    ],
    nodeSprites: {
      source:   "/sim-assets/vehicle/node-fuel-pump.png",
      queue:    "/sim-assets/vehicle/node-crossroad.png",
      resource: "/sim-assets/vehicle/node-fuel-pump.png",
      service:  "/sim-assets/vehicle/node-car-wash.png",
      decision: "/sim-assets/vehicle/node-traffic-light.png",
      sink:     "/sim-assets/vehicle/node-crossroad.png",
      priority_resource: "/sim-assets/vehicle/node-pedestrian-crossing.png",
    },
    backgroundAsset: "/sim-assets/vehicle/bg-road.png",

    layoutStrategy: "intersection",
    pathStyle: {
      strokeColor: "rgba(0, 242, 255, 0.4)",
      strokeWidth: 12,          // wide road lane
      dashPattern: [16, 8],     // center dashes
    },

    paletteNodes: [
      { type: "source",   label: "Approach",         icon: "➡️", color: "var(--neon-cyan)",   desc: "Vehicle arrival lane",          spriteKey: "source" },
      { type: "queue",    label: "Lane / Queue",      icon: "🚦", color: "var(--neon-yellow)", desc: "Waiting lane",                  spriteKey: "queue" },
      { type: "resource", label: "Bay / Pump",        icon: "⛽", color: "var(--neon-cyan)",   desc: "Service bay (fuel, wash, etc)", spriteKey: "resource" },
      { type: "service",  label: "Service",           icon: "🔧", color: "var(--neon-green)",  desc: "Processing (car wash, etc)",    spriteKey: "service" },
      { type: "decision", label: "Signal / Crossroad",icon: "🔀", color: "var(--neon-orange)", desc: "Traffic signal or routing",     spriteKey: "decision" },
      { type: "priority_resource", label: "Pedestrian Crossing", icon: "🚶", color: "var(--neon-yellow)", desc: "Crossing blocks traffic", spriteKey: "priority_resource" },
      { type: "sink",     label: "Exit",              icon: "🏁", color: "var(--neon-red)",    desc: "Vehicle departs",               spriteKey: "sink" },
    ],

    subScenarios: [
      {
        label: "Fuel Pumps",
        description: "Vehicles arrive, queue, fill up at pumps, depart",
        nodes: [
          { id: "n1", nodeType: "source",   label: "Vehicle Arrival", position: { x: 100, y: 250 }, params: { arrivalRate: 3, distribution: "exponential" } },
          { id: "n2", nodeType: "queue",    label: "Entry Lane",      position: { x: 300, y: 250 }, params: { capacity: 10, discipline: "FIFO" } },
          { id: "n3", nodeType: "resource", label: "Pump 1",          position: { x: 520, y: 150 }, params: { capacity: 1, serviceTimeMean: 4, serviceDistribution: "uniform" } },
          { id: "n4", nodeType: "resource", label: "Pump 2",          position: { x: 520, y: 350 }, params: { capacity: 1, serviceTimeMean: 4, serviceDistribution: "uniform" } },
          { id: "n5", nodeType: "sink",     label: "Exit",            position: { x: 720, y: 250 }, params: { collectKPIs: true } },
        ],
        edges: [
          { id: "e1", source: "n1", target: "n2" },
          { id: "e2", source: "n2", target: "n3" },
          { id: "e3", source: "n2", target: "n4" },
          { id: "e4", source: "n3", target: "n5" },
          { id: "e5", source: "n4", target: "n5" },
        ],
      },
      {
        label: "Crossroad",
        description: "4-way intersection with signal control",
        nodes: [
          { id: "n1", nodeType: "source",   label: "North Approach",  position: { x: 400, y: 50  }, params: { arrivalRate: 4, distribution: "poisson" } },
          { id: "n2", nodeType: "source",   label: "South Approach",  position: { x: 400, y: 450 }, params: { arrivalRate: 3, distribution: "poisson" } },
          { id: "n3", nodeType: "source",   label: "East Approach",   position: { x: 700, y: 250 }, params: { arrivalRate: 2, distribution: "poisson" } },
          { id: "n4", nodeType: "source",   label: "West Approach",   position: { x: 100, y: 250 }, params: { arrivalRate: 2, distribution: "poisson" } },
          { id: "n5", nodeType: "decision", label: "Traffic Signal",  position: { x: 400, y: 250 }, params: { routes: [{ targetId: "n6", probability: 1 }] } },
          { id: "n6", nodeType: "sink",     label: "Cleared",         position: { x: 600, y: 250 }, params: { collectKPIs: true } },
        ],
        edges: [
          { id: "e1", source: "n1", target: "n5" },
          { id: "e2", source: "n2", target: "n5" },
          { id: "e3", source: "n3", target: "n5" },
          { id: "e4", source: "n4", target: "n5" },
          { id: "e5", source: "n5", target: "n6" },
        ],
      },
      { label: "Start from scratch", description: "Empty canvas", nodes: [], edges: [] },
    ],

    kpiMetrics: [
      { key: "avgWaitTime",    label: "Avg Wait Time",      unit: "min",  chartType: "bar",      nodeTypes: ["queue"] },
      { key: "utilization",    label: "Pump/Bay Util.",     unit: "%",    chartType: "pie",      nodeTypes: ["resource"] },
      { key: "totalCompleted", label: "Vehicles / hour",    unit: "veh",  chartType: "kpi_card", nodeTypes: [] },
      { key: "currentDepth",   label: "Lane Queue Depth",   unit: "veh",  chartType: "line",     nodeTypes: ["queue"] },
    ],

    aiSystemPrompt: `You are helping design a VEHICLE simulation.
Entities are VEHICLES (cars, trucks, buses).
Use these node types: source (approach/arrival), queue (lane/waiting), resource (pump/bay/dock), service (car wash step), decision (traffic signal/crossroad routing), priority_resource (pedestrian crossing), sink (vehicle departs).
Use realistic labels: "North Approach", "Entry Lane", "Pump 1", "Traffic Signal", "Crossroad", "Pedestrian Crossing", etc.
Arrival rates are in vehicles/minute. Service times in minutes.`,
  },

  // ── 3. LIQUID / MATERIAL ────────────────────────────────────────────────────
  liquid: {
    id: "liquid",
    label: "LIQUID / MATERIAL",
    icon: "💧",
    color: "var(--neon-purple)",
    entityName: "Batch",

    entitySprites: ["/sim-assets/liquid/entity-droplet.png"],
    nodeSprites: {
      source:    "/sim-assets/liquid/node-inlet-outlet.png",
      container: "/sim-assets/liquid/node-tank.png",
      service:   "/sim-assets/liquid/node-processor.png",
      decision:  "/sim-assets/liquid/node-valve.png",
      sink:      "/sim-assets/liquid/node-inlet-outlet.png",
      store:     "/sim-assets/liquid/node-tank.png",
    },
    backgroundAsset: "/sim-assets/liquid/bg-pipes.png",

    layoutStrategy: "pipeline",
    pathStyle: {
      strokeColor: "rgba(112, 0, 255, 0.7)",
      strokeWidth: 6,
      animated: true,             // animated dash offset = flowing liquid
      dashPattern: [12, 4],
      arrowInterval: 60,
    },

    paletteNodes: [
      { type: "source",    label: "Inlet",     icon: "🔵", color: "var(--neon-purple)", desc: "Fluid inlet / material source",  spriteKey: "source" },
      { type: "container", label: "Tank",      icon: "🛢️", color: "var(--neon-purple)", desc: "Storage tank / reservoir",       spriteKey: "container" },
      { type: "service",   label: "Processor", icon: "⚗️", color: "var(--neon-cyan)",   desc: "Treatment / processing step",    spriteKey: "service" },
      { type: "decision",  label: "Valve",     icon: "🔧", color: "var(--neon-magenta)","desc": "Flow control valve",           spriteKey: "decision" },
      { type: "store",     label: "Store",     icon: "🏺", color: "var(--neon-purple)", desc: "Async material store",           spriteKey: "store" },
      { type: "sink",      label: "Outlet",    icon: "⭕", color: "var(--neon-red)",    desc: "Fluid outlet / material exit",   spriteKey: "sink" },
    ],

    subScenarios: [
      {
        label: "Water Treatment",
        description: "Raw water → filter → clean tank → distribution",
        nodes: [
          { id: "n1", nodeType: "source",    label: "Raw Water Inlet", position: { x: 100, y: 250 }, params: { arrivalRate: 10, distribution: "deterministic" } },
          { id: "n2", nodeType: "container", label: "Raw Tank",        position: { x: 300, y: 250 }, params: { capacity: 500, initialLevel: 0, fillRate: 10 } },
          { id: "n3", nodeType: "service",   label: "Filter Unit",     position: { x: 500, y: 250 }, params: { durationMean: 2, distribution: "exponential" } },
          { id: "n4", nodeType: "container", label: "Clean Tank",      position: { x: 700, y: 250 }, params: { capacity: 300, initialLevel: 0, fillRate: 8 } },
          { id: "n5", nodeType: "sink",      label: "Distribution",    position: { x: 900, y: 250 }, params: { collectKPIs: true } },
        ],
        edges: [
          { id: "e1", source: "n1", target: "n2" },
          { id: "e2", source: "n2", target: "n3" },
          { id: "e3", source: "n3", target: "n4" },
          { id: "e4", source: "n4", target: "n5" },
        ],
      },
      { label: "Start from scratch", description: "Empty canvas", nodes: [], edges: [] },
    ],

    kpiMetrics: [
      { key: "utilization",    label: "Tank Utilization", unit: "%",       chartType: "pie",      nodeTypes: ["container"] },
      { key: "avgServiceTime", label: "Processing Time",  unit: "min",     chartType: "bar",      nodeTypes: ["service"] },
      { key: "totalCompleted", label: "Throughput",       unit: "batches/hr", chartType: "kpi_card", nodeTypes: [] },
      { key: "level",          label: "Tank Level",       unit: "units",   chartType: "line",     nodeTypes: ["container"] },
    ],

    aiSystemPrompt: `You are helping design a LIQUID/MATERIAL flow simulation.
Entities are fluid batches or material parcels flowing through a pipeline.
Use these node types: source (inlet), container (tank/reservoir with capacity and fill level), service (treatment/processing), decision (valve/flow control), store (async buffer), sink (outlet).
Use realistic labels: "Raw Water Inlet", "Settling Tank", "Filter Unit", "Chlorination", "Distribution Outlet", etc.
Flow rates in units/minute. Tank capacity in units.`,
  },

  // ── 4. MANUFACTURING ────────────────────────────────────────────────────────
  manufacturing: {
    id: "manufacturing",
    label: "MANUFACTURING",
    icon: "🏭",
    color: "var(--neon-orange)",
    entityName: "Part",

    entitySprites: ["/sim-assets/manufacturing/entity-part.png"],
    nodeSprites: {
      source:   "/sim-assets/manufacturing/node-machine.png",  // placeholder until raw-input generated
      queue:    "/sim-assets/manufacturing/node-buffer.png",
      resource: "/sim-assets/manufacturing/node-machine.png",
      service:  "/sim-assets/manufacturing/node-machine.png",
      decision: "/sim-assets/manufacturing/node-buffer.png",   // placeholder until qc-station generated
      sink:     "/sim-assets/manufacturing/node-machine.png",  // placeholder until output generated
    },
    backgroundAsset: "/sim-assets/manufacturing/bg-factory.png",

    layoutStrategy: "assembly_line",
    pathStyle: {
      strokeColor: "rgba(249, 115, 22, 0.5)",
      strokeWidth: 8,
      dashPattern: [6, 4],
      tickInterval: 20,  // conveyor belt tick marks
    },

    paletteNodes: [
      { type: "source",   label: "Raw Parts",    icon: "📥", color: "var(--neon-orange)", desc: "Raw material / parts input",    spriteKey: "source" },
      { type: "queue",    label: "Buffer / WIP",  icon: "📦", color: "var(--neon-yellow)", desc: "Work-in-progress storage",      spriteKey: "queue" },
      { type: "resource", label: "Machine",       icon: "⚙️", color: "var(--neon-orange)", desc: "CNC / robot / press (capacity)",spriteKey: "resource" },
      { type: "service",  label: "Process Step",  icon: "🔩", color: "var(--neon-orange)", desc: "Single processing step",        spriteKey: "service" },
      { type: "decision", label: "QC Check",      icon: "🔍", color: "var(--neon-green)",  desc: "Quality control pass/fail",     spriteKey: "decision" },
      { type: "sink",     label: "Finished Goods",icon: "✅", color: "var(--neon-red)",    desc: "Output / shipping dock",        spriteKey: "sink" },
    ],

    subScenarios: [
      {
        label: "Assembly Line",
        description: "Parts flow through machines, QC check, then finished goods",
        nodes: [
          { id: "n1", nodeType: "source",   label: "Raw Parts In",    position: { x: 100, y: 250 }, params: { arrivalRate: 5, distribution: "exponential" } },
          { id: "n2", nodeType: "resource", label: "Machine A",       position: { x: 300, y: 250 }, params: { capacity: 2, serviceTimeMean: 3, serviceDistribution: "normal" } },
          { id: "n3", nodeType: "queue",    label: "WIP Buffer",      position: { x: 500, y: 250 }, params: { capacity: 20, discipline: "FIFO" } },
          { id: "n4", nodeType: "resource", label: "Machine B",       position: { x: 700, y: 250 }, params: { capacity: 1, serviceTimeMean: 5, serviceDistribution: "normal" } },
          { id: "n5", nodeType: "decision", label: "QC Check",        position: { x: 900, y: 250 }, params: { routes: [{ targetId: "n6", probability: 0.85 }, { targetId: "n7", probability: 0.15 }] } },
          { id: "n6", nodeType: "sink",     label: "Finished Goods",  position: { x: 1100, y: 150 }, params: { collectKPIs: true } },
          { id: "n7", nodeType: "service",  label: "Rework",          position: { x: 900, y: 400 }, params: { durationMean: 8, distribution: "exponential" } },
        ],
        edges: [
          { id: "e1", source: "n1", target: "n2" },
          { id: "e2", source: "n2", target: "n3" },
          { id: "e3", source: "n3", target: "n4" },
          { id: "e4", source: "n4", target: "n5" },
          { id: "e5", source: "n5", target: "n6" },
          { id: "e6", source: "n5", target: "n7" },
          { id: "e7", source: "n7", target: "n3" },  // rework loop
        ],
      },
      { label: "Start from scratch", description: "Empty canvas", nodes: [], edges: [] },
    ],

    kpiMetrics: [
      { key: "utilization",    label: "Machine Utilization", unit: "%",         chartType: "pie",      nodeTypes: ["resource"] },
      { key: "avgWaitTime",    label: "WIP Buffer Wait",     unit: "min",       chartType: "bar",      nodeTypes: ["queue"] },
      { key: "totalCompleted", label: "Throughput",          unit: "parts/hr",  chartType: "kpi_card", nodeTypes: [] },
      { key: "avgServiceTime", label: "Cycle Time",          unit: "min",       chartType: "bar",      nodeTypes: ["resource", "service"] },
      { key: "currentDepth",   label: "WIP Count",           unit: "parts",     chartType: "line",     nodeTypes: ["queue"] },
    ],

    aiSystemPrompt: `You are helping design a MANUFACTURING simulation.
Entities are PARTS, COMPONENTS, or PRODUCTS flowing through a factory.
Use these node types: source (raw parts input), queue (WIP buffer/storage), resource (machine/robot with capacity), service (single process step), decision (QC check with pass/fail routing), sink (finished goods / shipping dock).
Use realistic labels: "Raw Parts In", "Lathe Machine", "WIP Buffer", "CNC Press", "QC Inspection", "Rework Station", "Finished Goods", etc.
Arrival rates in parts/minute. Service times in minutes. QC failure route probability typically 0.05–0.2.`,
  },

  // ── 5. LOGISTICS ────────────────────────────────────────────────────────────
  logistics: {
    id: "logistics",
    label: "LOGISTICS",
    icon: "📦",
    color: "var(--neon-yellow)",
    entityName: "Package",

    entitySprites: ["/sim-assets/logistics/entity-package.png"],
    nodeSprites: {
      source:   "/sim-assets/logistics/node-inbound-dock.png",   // pending generation
      queue:    "/sim-assets/logistics/node-storage-rack.png",   // pending generation
      resource: "/sim-assets/logistics/node-loading-dock.png",   // pending generation
      service:  "/sim-assets/logistics/node-conveyor.png",       // pending generation
      decision: "/sim-assets/logistics/node-sorter.png",         // pending generation
      sink:     "/sim-assets/logistics/node-loading-dock.png",   // pending generation
    },
    backgroundAsset: "/sim-assets/logistics/bg-warehouse.png",

    layoutStrategy: "warehouse",
    pathStyle: {
      strokeColor: "rgba(251, 191, 36, 0.5)",
      strokeWidth: 4,
      dashPattern: [10, 5],
      arrowInterval: 50,
    },

    paletteNodes: [
      { type: "source",   label: "Inbound",   icon: "🚛", color: "var(--neon-yellow)", desc: "Incoming shipment / truck arrival", spriteKey: "source" },
      { type: "queue",    label: "Storage",   icon: "🗄️", color: "var(--neon-yellow)", desc: "Warehouse storage zone",            spriteKey: "queue" },
      { type: "resource", label: "Dock",      icon: "🏗️", color: "var(--neon-cyan)",   desc: "Loading dock (capacity-limited)",   spriteKey: "resource" },
      { type: "service",  label: "Conveyor",  icon: "➡️", color: "var(--neon-yellow)", desc: "Conveyor belt processing step",     spriteKey: "service" },
      { type: "decision", label: "Sorter",    icon: "🔀", color: "var(--neon-orange)", desc: "Automatic package sorter/router",   spriteKey: "decision" },
      { type: "sink",     label: "Loaded",    icon: "✅", color: "var(--neon-red)",    desc: "Package loaded, departs",           spriteKey: "sink" },
    ],

    subScenarios: [
      {
        label: "Sort Center",
        description: "Packages arrive, are scanned and sorted to zones, loaded at docks",
        nodes: [
          { id: "n1", nodeType: "source",   label: "Inbound Truck",   position: { x: 400, y: 50  }, params: { arrivalRate: 10, distribution: "poisson" } },
          { id: "n2", nodeType: "service",  label: "Scan & Check-in", position: { x: 400, y: 200 }, params: { durationMean: 0.5, distribution: "deterministic" } },
          { id: "n3", nodeType: "decision", label: "Sorter",          position: { x: 400, y: 350 }, params: { routes: [{ targetId: "n4", probability: 0.33 }, { targetId: "n5", probability: 0.33 }, { targetId: "n6", probability: 0.34 }] } },
          { id: "n4", nodeType: "queue",    label: "Zone A Storage",  position: { x: 150, y: 500 }, params: { capacity: 100, discipline: "FIFO" } },
          { id: "n5", nodeType: "queue",    label: "Zone B Storage",  position: { x: 400, y: 500 }, params: { capacity: 100, discipline: "FIFO" } },
          { id: "n6", nodeType: "queue",    label: "Zone C Storage",  position: { x: 650, y: 500 }, params: { capacity: 100, discipline: "FIFO" } },
          { id: "n7", nodeType: "resource", label: "Dock A",          position: { x: 150, y: 650 }, params: { capacity: 2, serviceTimeMean: 1, serviceDistribution: "exponential" } },
          { id: "n8", nodeType: "resource", label: "Dock B",          position: { x: 400, y: 650 }, params: { capacity: 2, serviceTimeMean: 1, serviceDistribution: "exponential" } },
          { id: "n9", nodeType: "resource", label: "Dock C",          position: { x: 650, y: 650 }, params: { capacity: 2, serviceTimeMean: 1, serviceDistribution: "exponential" } },
          { id: "n10", nodeType: "sink",    label: "Loaded & Shipped",position: { x: 400, y: 800 }, params: { collectKPIs: true } },
        ],
        edges: [
          { id: "e1", source: "n1",  target: "n2" },
          { id: "e2", source: "n2",  target: "n3" },
          { id: "e3", source: "n3",  target: "n4" },
          { id: "e4", source: "n3",  target: "n5" },
          { id: "e5", source: "n3",  target: "n6" },
          { id: "e6", source: "n4",  target: "n7" },
          { id: "e7", source: "n5",  target: "n8" },
          { id: "e8", source: "n6",  target: "n9" },
          { id: "e9", source: "n7",  target: "n10" },
          { id: "e10", source: "n8", target: "n10" },
          { id: "e11", source: "n9", target: "n10" },
        ],
      },
      { label: "Start from scratch", description: "Empty canvas", nodes: [], edges: [] },
    ],

    kpiMetrics: [
      { key: "utilization",    label: "Dock Utilization",   unit: "%",        chartType: "pie",      nodeTypes: ["resource"] },
      { key: "avgWaitTime",    label: "Storage Dwell Time", unit: "min",      chartType: "bar",      nodeTypes: ["queue"] },
      { key: "totalCompleted", label: "Packages / hour",    unit: "pkgs",     chartType: "kpi_card", nodeTypes: [] },
      { key: "currentDepth",   label: "Zone Inventory",     unit: "packages", chartType: "line",     nodeTypes: ["queue"] },
      { key: "avgServiceTime", label: "Loading Time",       unit: "min",      chartType: "bar",      nodeTypes: ["resource"] },
    ],

    aiSystemPrompt: `You are helping design a LOGISTICS / WAREHOUSE simulation.
Entities are PACKAGES, PALLETS, or SHIPMENTS moving through a facility.
Use these node types: source (inbound truck/arrival), queue (storage zone/buffer), resource (loading dock with capacity), service (conveyor/scan step), decision (sorter/router), sink (loaded & shipped).
Use realistic labels: "Inbound Truck", "Zone A Storage", "Sort Gate", "Dock Bay 1", "Conveyor Belt", "Loaded & Shipped", etc.
Arrival rates in packages/minute. Service times in minutes.`,
  },

  // ── 6. NETWORK / SIGNAL ─────────────────────────────────────────────────────
  network_signal: {
    id: "network_signal",
    label: "NETWORK / SIGNAL",
    icon: "📡",
    color: "var(--neon-magenta)",
    entityName: "Message",

    // NOTE: Sprites pending quota reset — placeholders map to liquid assets until generated
    entitySprites: ["/sim-assets/network_signal/entity-packet.png"],
    nodeSprites: {
      source:      "/sim-assets/network_signal/node-producer.png",
      store:       "/sim-assets/network_signal/node-store.png",
      channel:     "/sim-assets/network_signal/node-channel.png",
      decision:    "/sim-assets/network_signal/node-router.png",
      broadcaster: "/sim-assets/network_signal/node-broadcaster.png",
      sink:        "/sim-assets/network_signal/node-consumer.png",
      service:     "/sim-assets/network_signal/node-channel.png",
    },
    backgroundAsset: "/sim-assets/network_signal/bg-network.png",

    layoutStrategy: "network_topology",
    pathStyle: {
      strokeColor: "rgba(232, 121, 249, 0.6)",  // neon magenta
      strokeWidth: 2,
      dashPattern: [4, 3],
      animated: true,    // pulsing signal flow
      arrowInterval: 40,
    },

    paletteNodes: [
      { type: "source",      label: "Producer",    icon: "📤", color: "var(--neon-magenta)", desc: "Generates messages at a rate",          spriteKey: "source" },
      { type: "store",       label: "Buffer/Store", icon: "🗄️", color: "var(--neon-purple)", desc: "Message queue (SimPy Store)",           spriteKey: "store" },
      { type: "channel",     label: "Channel",      icon: "📶", color: "var(--neon-magenta)", desc: "Transmission medium with delay",        spriteKey: "channel" },
      { type: "decision",    label: "Router",       icon: "🔀", color: "var(--neon-cyan)",   desc: "Routes messages to targets",            spriteKey: "decision" },
      { type: "broadcaster", label: "Broadcaster",  icon: "📢", color: "var(--neon-orange)", desc: "Fan-out: copies message to all outputs",spriteKey: "broadcaster" },
      { type: "sink",        label: "Consumer",     icon: "📥", color: "var(--neon-green)",  desc: "Receives and processes messages",       spriteKey: "sink" },
    ],

    subScenarios: [
      {
        label: "Cable / Event Latency",
        description: "Sender → cable with propagation delay → receiver (SimPy Event Latency example)",
        nodes: [
          { id: "n1", nodeType: "source",  label: "Sender A",  position: { x: 100, y: 250 }, params: { arrivalRate: 0.2, distribution: "deterministic" } },
          { id: "n2", nodeType: "channel", label: "Cable",     position: { x: 350, y: 250 }, params: { propagationDelay: 10, delayDistribution: "deterministic", bufferCapacity: -1, detectLateMessages: true } },
          { id: "n3", nodeType: "sink",    label: "Receiver A",position: { x: 600, y: 250 }, params: { collectKPIs: true } },
        ],
        edges: [
          { id: "e1", source: "n1", target: "n2" },
          { id: "e2", source: "n2", target: "n3" },
        ],
      },
      {
        label: "Process Pipe (One-to-One)",
        description: "Generator → Store buffer → Consumer (SimPy Process Communication example)",
        nodes: [
          { id: "n1", nodeType: "source", label: "Generator A", position: { x: 100, y: 250 }, params: { arrivalRate: 0.125, distribution: "uniform" } },
          { id: "n2", nodeType: "store",  label: "Pipe Buffer", position: { x: 350, y: 250 }, params: { capacity: -1, discipline: "FIFO" } },
          { id: "n3", nodeType: "sink",   label: "Consumer A",  position: { x: 600, y: 250 }, params: { collectKPIs: true } },
        ],
        edges: [
          { id: "e1", source: "n1", target: "n2" },
          { id: "e2", source: "n2", target: "n3" },
        ],
      },
      {
        label: "Broadcast Pipe (One-to-Many)",
        description: "One generator broadcasts to multiple consumers via BroadcastPipe",
        nodes: [
          { id: "n1", nodeType: "source",      label: "Generator A",  position: { x: 100, y: 300 }, params: { arrivalRate: 0.125, distribution: "uniform" } },
          { id: "n2", nodeType: "broadcaster", label: "Broadcast Hub", position: { x: 350, y: 300 }, params: { bufferCapacity: -1 } },
          { id: "n3", nodeType: "store",       label: "Pipe → A",     position: { x: 600, y: 150 }, params: { capacity: -1, discipline: "FIFO" } },
          { id: "n4", nodeType: "store",       label: "Pipe → B",     position: { x: 600, y: 300 }, params: { capacity: -1, discipline: "FIFO" } },
          { id: "n5", nodeType: "store",       label: "Pipe → C",     position: { x: 600, y: 450 }, params: { capacity: -1, discipline: "FIFO" } },
          { id: "n6", nodeType: "sink",        label: "Consumer A",   position: { x: 850, y: 150 }, params: { collectKPIs: true } },
          { id: "n7", nodeType: "sink",        label: "Consumer B",   position: { x: 850, y: 300 }, params: { collectKPIs: true } },
          { id: "n8", nodeType: "sink",        label: "Consumer C",   position: { x: 850, y: 450 }, params: { collectKPIs: true } },
        ],
        edges: [
          { id: "e1", source: "n1", target: "n2" },
          { id: "e2", source: "n2", target: "n3" },
          { id: "e3", source: "n2", target: "n4" },
          { id: "e4", source: "n2", target: "n5" },
          { id: "e5", source: "n3", target: "n6" },
          { id: "e6", source: "n4", target: "n7" },
          { id: "e7", source: "n5", target: "n8" },
        ],
      },
      {
        label: "Microservice Pipeline",
        description: "API gateway → auth service → service mesh → slow/fast consumers",
        nodes: [
          { id: "n1", nodeType: "source",   label: "API Gateway",     position: { x: 100, y: 300 }, params: { arrivalRate: 5, distribution: "poisson" } },
          { id: "n2", nodeType: "channel",  label: "Auth Channel",    position: { x: 300, y: 300 }, params: { propagationDelay: 2, delayDistribution: "exponential", bufferCapacity: 100, detectLateMessages: true } },
          { id: "n3", nodeType: "decision", label: "Service Router",  position: { x: 500, y: 300 }, params: { routes: [{ targetId: "n4", probability: 0.4 }, { targetId: "n5", probability: 0.6 }] } },
          { id: "n4", nodeType: "store",    label: "Fast Queue",      position: { x: 700, y: 150 }, params: { capacity: 50, discipline: "FIFO" } },
          { id: "n5", nodeType: "store",    label: "Slow Queue",      position: { x: 700, y: 450 }, params: { capacity: 50, discipline: "FIFO" } },
          { id: "n6", nodeType: "sink",     label: "Fast Consumer",   position: { x: 900, y: 150 }, params: { collectKPIs: true } },
          { id: "n7", nodeType: "sink",     label: "Slow Consumer",   position: { x: 900, y: 450 }, params: { collectKPIs: true } },
        ],
        edges: [
          { id: "e1", source: "n1", target: "n2" },
          { id: "e2", source: "n2", target: "n3" },
          { id: "e3", source: "n3", target: "n4" },
          { id: "e4", source: "n3", target: "n5" },
          { id: "e5", source: "n4", target: "n6" },
          { id: "e6", source: "n5", target: "n7" },
        ],
      },
      { label: "Start from scratch", description: "Empty canvas — build your own topology", nodes: [], edges: [] },
    ],

    kpiMetrics: [
      { key: "avgLatency",     label: "Avg Message Latency",  unit: "ms",       chartType: "line",     nodeTypes: ["channel", "sink"] },
      { key: "totalCompleted", label: "Throughput",           unit: "msg/sec",  chartType: "kpi_card", nodeTypes: [] },
      { key: "droppedCount",   label: "Dropped Messages",     unit: "msgs",     chartType: "bar",      nodeTypes: ["channel", "store"] },
      { key: "lateCount",      label: "Late Messages",        unit: "msgs",     chartType: "bar",      nodeTypes: ["channel"] },
      { key: "currentDepth",   label: "Buffer Depth",         unit: "msgs",     chartType: "line",     nodeTypes: ["store"] },
      { key: "utilization",    label: "Channel Utilization",  unit: "%",        chartType: "pie",      nodeTypes: ["channel"] },
    ],

    aiSystemPrompt: `You are helping design a NETWORK / SIGNAL simulation.
Entities are MESSAGES, PACKETS, or SIGNALS traveling through a communication system.
Use these node types:
  - source (producer: generates messages at intervals)
  - store (buffer/pipe: typed message queue, like SimPy Store)
  - channel (transmission medium: has propagationDelay and bufferCapacity — models cable/RF/network hop)
  - decision (router: probabilistically sends messages to different targets)
  - broadcaster (fan-out: copies one message to ALL connected outputs, like SimPy BroadcastPipe)
  - sink (consumer: receives and processes messages, collects latency KPIs)
Use realistic labels: "API Gateway", "Auth Service", "Message Broker", "TCP Channel", "Load Balancer", "Consumer A", "Subscriber B", etc.
Message rates in messages/second. Propagation delays in milliseconds.
This type is ideal for: microservices, IoT sensors, pub/sub systems, CDN routing, RF propagation, fiber cables.`,
  },

};

// ─── Helper Functions ─────────────────────────────────────────────────────────

export function getSimTypeConfig(id: SimTypeId): SimTypeConfig {
  return SIM_TYPE_REGISTRY[id];
}

export function getAllSimTypes(): SimTypeConfig[] {
  return Object.values(SIM_TYPE_REGISTRY);
}

/** Returns the node sprite path for a given sim type + node type */
export function getNodeSprite(simType: SimTypeId, nodeType: string): string {
  const cfg = SIM_TYPE_REGISTRY[simType];
  return cfg.nodeSprites[nodeType] || cfg.entitySprites[0];
}
