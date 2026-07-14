/**
 * Shared types for the JustCmul8 Simulation Engine.
 * Both the client-side Web Worker engine and the future Python backend stub
 * implement the SimulationEngine interface — the UI only talks to this interface.
 */

// ─── Sim Type IDs ────────────────────────────────────────────────────────────

export type SimTypeId =
  | "human_queue"
  | "vehicle"
  | "liquid"
  | "manufacturing"
  | "logistics"
  | "network_signal";

export type NodeType =
  | "source"           // entity/message generator
  | "queue"            // finite/infinite waiting line
  | "resource"         // capacity-limited server (can be preemptive)
  | "service"          // single processing step
  | "decision"         // probabilistic routing
  | "sink"             // entity exits, KPIs collected
  | "container"        // continuous-level tank/reservoir
  | "store"            // typed message buffer (SimPy Store)
  | "event_trigger"    // monitors conditions, fires events
  | "priority_resource"// preemptive resource for high-priority tasks
  | "channel"          // transmission medium with propagation delay
  | "broadcaster"      // one-to-many fan-out (broadcast pipe)
  | "any_of"           // simpy.events.AnyOf
  | "all_of"           // simpy.events.AllOf
  | "interrupter";     // triggers process.interrupt()

export type DistributionType =
  | "exponential"
  | "uniform"
  | "normal"
  | "deterministic"
  | "poisson";

export type QueueDiscipline = "FIFO" | "LIFO" | "PRIORITY";

// ─── Node Parameters (per nodeType) ──────────────────────────────────────────

export interface ArrivalScheduleEntry {
  simTime: number;   // sim-time at which this batch arrives
  count: number;     // number of entities in this batch
}

export type RoutingMode = "round_robin" | "broadcast" | "priority";
export type EntityClass = "customer" | "patient" | "staff" | "vip" | "standard" | string;
export type PriorityLevel = "standard" | "priority" | "urgent";

export interface SourceParams {
  // ── Arrival Timing ─────────────────────────────────────────────────────────
  arrivalRate: number;              // entities per sim-time unit (inter-arrival mean = 1/rate)
  distribution: DistributionType;  // distribution for inter-arrival sampling

  // ── Cap / Infinite ─────────────────────────────────────────────────────────
  maxEntities?: number;             // hard cap on total entities spawned; omit = infinite
  infiniteArrivals?: boolean;       // explicitly mark as unbounded (UI toggle)

  // ── Arrival Schedule (optional timetable) ──────────────────────────────────
  /** If set, entities spawn at specific sim-times rather than via inter-arrival rate. */
  schedule?: ArrivalScheduleEntry[];
  /** If true, the schedule loops/repeats after all entries have fired. */
  scheduleRecurring?: boolean;

  // ── Entity Attributes ──────────────────────────────────────────────────────
  /** Default priority assigned to every entity from this source. */
  priorityLevel?: PriorityLevel;
  /** Logical category of entities (drives downstream routing rules). */
  entityClass?: EntityClass;

  // ── Routing ────────────────────────────────────────────────────────────────
  /** How entities are distributed across multiple outgoing edges. */
  routingMode?: RoutingMode;
}

export interface QueueParams {
  capacity: number;                     // -1 = unlimited
  discipline: QueueDiscipline;

  // ── Renege / Patience (Bank Renege, Movie Renege) ──────────────────────────
  /** Max sim-time an entity will wait before reneging (leaving the queue). */
  patienceTimeout?: number;
  /** Distribution for patience timeout sampling. Defaults to 'uniform'. */
  patienceDistribution?: DistributionType;
  /** Min patience time when using uniform distribution */
  patienceMin?: number;
  /** Max patience time when using uniform distribution */
  patienceMax?: number;

  // ── Sold-Out / Capacity Broadcast (Movie Renege) ───────────────────────────
  /** When remaining capacity <= this threshold, trigger a sold-out broadcast event. */
  soldOutThreshold?: number;
  /** If true, ALL entities currently waiting in this queue renege simultaneously when sold-out fires. */
  broadcastRenege?: boolean;
}

export interface ResourceParams {
  capacity: number;                     // # of parallel servers
  serviceTimeMean: number;
  serviceDistribution: DistributionType;

  // ── Preemption (Machine Shop repairman) ───────────────────────────────────
  /** If true, this is a PreemptiveResource — higher-priority requests can interrupt current work. */
  isPreemptive?: boolean;

  // ── Machine Breakdown / Interrupts (Machine Shop) ─────────────────────────
  /** Mean time between failures (sim-time units). If set, machine breaks down periodically. */
  meanTimeBetweenFailures?: number;
  /** Mean time to repair once broken (sim-time units). */
  repairTimeMean?: number;
  /** Distribution for repair time sampling. Defaults to 'exponential'. */
  repairDistribution?: DistributionType;
  /** Node ID of the repairman Resource that handles repairs. If unset, instant repair. */
  repairmanNodeId?: string;
  /** Priority level when requesting the repairman (lower = higher priority). Default: 1. */
  repairPriority?: number;
}

export interface ServiceParams {
  durationMean: number;
  distribution: DistributionType;
}

export interface DecisionParams {
  routes: Array<{ targetId: string; probability: number }>;
}

export interface SinkParams {
  collectKPIs: boolean;
}

export interface ContainerParams {
  capacity: number;
  initialLevel: number;
  fillRate: number;
}

export interface StoreParams {
  capacity: number;
  isPriority?: boolean;
  filterEnabled?: boolean;
  filterProperty?: string;
  filterOperator?: "==" | "!=" | ">" | "<" | ">=" | "<=";
  filterValue?: string | number;
}

export interface InterrupterParams {
  targetNodeId?: string;
  cause?: string;
}

export interface SyncRouterParams {
  targetId?: string;
}

// ── Network/Signal Node Params ────────────────────────────────────────────────

/**
 * Channel: a transmission medium between producer and consumer.
 * Models cable latency, RF propagation, network hops.
 * SimPy equivalent: Store + timeout(delay).
 */
export interface ChannelParams {
  /** Fixed propagation delay (sim-time units). */
  propagationDelay: number;
  /** Distribution for delay sampling. 'deterministic' = constant delay. */
  delayDistribution: DistributionType;
  /** Buffer capacity before dropping messages (-1 = unlimited). */
  bufferCapacity: number;
  /** If true, log late messages (consumer was slower than producer). */
  detectLateMessages?: boolean;
}

/**
 * Broadcaster: one-to-many fan-out node.
 * A single message from the producer is copied to ALL connected consumers.
 * SimPy equivalent: BroadcastPipe (multiple Store instances).
 */
export interface BroadcasterParams {
  /** IDs of consumer nodes to broadcast to (derived from edges at runtime). */
  consumerIds?: string[];
  /** Buffer capacity per consumer output pipe (-1 = unlimited). */
  bufferCapacity: number;
}

// Union of all param shapes
export type NodeParams =
  | SourceParams
  | QueueParams
  | ResourceParams
  | ServiceParams
  | DecisionParams
  | SinkParams
  | ContainerParams
  | ChannelParams
  | BroadcasterParams
  | StoreParams
  | InterrupterParams
  | SyncRouterParams
  | Record<string, unknown>;

// ─── Graph Structures (used by engine + layout) ───────────────────────────────

export interface SimNode {
  id: string;
  nodeType: NodeType;
  label: string;
  params: NodeParams;
  // Position in ReactFlow (NOT used by PixiJS layout engine)
  position?: { x: number; y: number };
}

export interface SimEdge {
  id: string;
  source: string;   // SimNode id
  target: string;   // SimNode id
  animated?: boolean;
}

export interface SimGraph {
  nodes: SimNode[];
  edges: SimEdge[];
}

// ─── Simulation Parameters ────────────────────────────────────────────────────

export interface SimParams {
  graph: SimGraph;
  simType: SimTypeId;
  durationSeconds: number;   // virtual sim time to run
  speedMultiplier: number;   // 1x, 2x, 5x, 10x wall-clock
  tickIntervalSeconds: number; // how often to emit progress ticks
  simTimeUnit?: "seconds" | "minutes" | "hours" | "days";
}

// ─── Live Tick Data (emitted during run) ─────────────────────────────────────

export interface NodeStats {
  nodeId: string;
  nodeType: NodeType;
  label: string;
  entitiesIn: number;
  entitiesOut: number;
  currentDepth: number;       // queue depth / entities in service / buffer size
  utilization: number;        // 0–1 fraction busy
  avgWaitTime: number;        // sim-time units
  avgServiceTime: number;
  level?: number;             // for containers: current fill level
  renegeCount?: number;       // entities that left the queue due to patience timeout
  breakdownCount?: number;    // number of times this resource broke down
  totalDowntime?: number;     // cumulative sim-time spent in broken state
  droppedCount?: number;      // messages dropped (channel buffer overflow)
  lateCount?: number;         // messages received late (network/signal)
  avgLatency?: number;        // average end-to-end latency (network/signal)
}

export interface SimTick {
  simTime: number;            // current virtual sim time
  wallElapsed: number;        // ms since sim started
  totalArrived: number;
  totalCompleted: number;
  nodeStats: Record<string, NodeStats>;
  recentLogs: SimLog[];       // logs since last tick
}

// ─── Simulation Result (emitted on completion) ────────────────────────────────

export interface SimLog {
  simTime: number;
  entityId: number;
  nodeId: string;
  nodeLabel: string;
  event:
    // ── Standard flow events ──────────────────────────────────
    | "arrived"           // entity arrived at source
    | "queued"            // entity joined a queue
    | "service_start"     // entity started being served
    | "service_end"       // entity finished service
    | "routed"            // entity took a decision branch
    | "completed"         // entity reached sink
    | "rejected"          // entity rejected (capacity exceeded)
    // ── Reneging (Bank Renege, Movie Renege) ──────────────────
    | "reneged"           // entity left queue due to patience timeout
    | "sold_out"          // sold-out event triggered, all waiters reneged
    // ── Machine interrupts (Machine Shop) ────────────────────
    | "breakdown"         // resource broke down, repairman requested
    | "repaired"          // resource repaired, production resumes
    | "preempted"         // lower-priority task interrupted by higher-priority
    // ── Network/Signal events ─────────────────────────────────
    | "transmitted"       // message sent into channel
    | "received"          // message received after propagation delay
    | "late"              // message received late (consumer lagging)
    | "dropped"           // message dropped (buffer overflow)
    | "broadcast";        // message broadcast to all consumers
  detail?: string;
}

export interface SimResult {
  simType: SimTypeId;
  totalSimTime: number;
  totalArrived: number;
  totalCompleted: number;
  bottleneckNodeId: string;
  bottleneckLabel: string;
  nodeStats: Record<string, NodeStats>;
  timeline: Array<{ simTime: number; completed: number; depth: Record<string, number> }>;
  logs: SimLog[];
}

// ─── SimulationEngine Interface ───────────────────────────────────────────────
// The UI only speaks to this interface.
// ClientSimEngine (Web Worker) implements it now.
// PythonSimEngine (SSE backend) will implement it later — zero UI changes needed.

export interface SimulationEngine {
  /** Start the simulation with the given parameters */
  start(params: SimParams): void;

  /** Register a callback for live tick updates (called every tickIntervalSeconds of sim-time) */
  onTick(callback: (tick: SimTick) => void): void;

  /** Register a callback for when simulation completes */
  onComplete(callback: (result: SimResult) => void): void;

  /** Register a callback for errors */
  onError(callback: (error: string) => void): void;

  /** Pause the simulation */
  pause(): void;

  /** Resume a paused simulation */
  resume(): void;

  /** Stop and reset the simulation */
  stop(): void;

  /** Check if currently running */
  isRunning(): boolean;
}

// ─── Pyodide Runtime Status ───────────────────────────────────────────────────
// Emitted by PyodideSimEngine so the UI can show a loading indicator
// while the ~10 MB WASM binary is being downloaded and initialized.

export interface PyodideStatus {
  phase: "idle" | "loading_runtime" | "loading_simpy" | "ready" | "error";
  message?: string;
  progress?: number;
}
