import type {
  SimResult,
  SimLog,
  NodeStats,
  SimTypeId,
  PercentileStats,
  ResourceOperationalStates,
  LittlesLawVerification,
  EntityJourney,
  EntityJourneyStep,
  DomainMetricCard,
  SimGraph,
  ResourceParams,
  QueueParams,
  ContainerParams,
  CostAnalysis,
  CostBreakdown,
} from "./types";
import { SIM_TYPE_REGISTRY } from "./simTypeRegistry";
import { perTimeParts, fmtDuration } from "./units";

/**
 * Blocks with a fixed number of servers, where "% busy" means something. A "service" block is an
 * unlimited-capacity delay (its utilization is "avg in progress", capped at 1) and a container's is
 * its fill level, so neither may feed busy-ness checks.
 */
export const isServerNode = (s: Pick<NodeStats, "nodeType">) => s.nodeType === "resource" || s.nodeType === "priority_resource";

/** Entities turned away (full buffer) or that gave up waiting: they left without finishing. */
export const lostCount = (r: Pick<SimResult, "nodeStats">) =>
  Object.values(r.nodeStats || {}).reduce((n, s) => n + (s.droppedCount ?? 0) + (s.renegeCount ?? 0), 0);

/** Arrived, not finished, and not lost: actually inside at the end of the run. */
export const stillInsideCount = (r: Pick<SimResult, "nodeStats" | "totalArrived" | "totalCompleted">) =>
  Math.max(0, r.totalArrived - r.totalCompleted - lostCount(r));

/** Blocks whose utilization is worth showing: servers (% busy), tanks (% full), channels (% of buffer in use). */
export const hasUtilization = (s: Pick<NodeStats, "nodeType">) => isServerNode(s) || s.nodeType === "container" || s.nodeType === "channel";

/**
 * Calculates exact statistical percentiles using Hyndman & Fan Type-7 linear interpolation (numpy / Excel standard).
 */
export function calculatePercentiles(samples: number[]): PercentileStats {
  if (!samples || samples.length === 0) {
    return {
      p25: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      p95: 0,
      p99: 0,
      min: 0,
      max: 0,
      mean: 0,
      stdDev: 0,
      iqr: 0,
    };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;

  const quantile = (p: number): number => {
    if (n === 1) return sorted[0];
    const h = (n - 1) * p;
    const i = Math.floor(h);
    const gamma = h - i;
    if (i + 1 < n) {
      return (1 - gamma) * sorted[i] + gamma * sorted[i + 1];
    }
    return sorted[i];
  };

  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = sum / n;
  const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  const p50 = quantile(0.5);
  const p75 = quantile(0.75);
  const p25 = quantile(0.25);
  const p90 = quantile(0.9);
  const p95 = quantile(0.95);
  const p99 = quantile(0.99);

  return {
    p25,
    p50,
    p75,
    p90,
    p95,
    p99,
    min: sorted[0],
    max: sorted[n - 1],
    mean,
    stdDev,
    iqr: p75 - p25,
  };
}

/**
 * Reconstructs the microscopic journey of every entity from the chronological log stream.
 */
export function reconstructEntityJourneys(logs: SimLog[], endTime?: number): EntityJourney[] {
  if (!logs || logs.length === 0) return [];

  const journeysMap = new Map<number, {
    entityId: number;
    entityClass: string;
    priority: number;
    arrivalTime: number;
    departureTime?: number;
    status: "completed" | "reneged" | "dropped" | "in_flight";
    stepsMap: Map<string, Partial<EntityJourneyStep>>;
    orderedSteps: EntityJourneyStep[];
  }>();

  for (const log of logs) {
    if (log.entityId === undefined || log.entityId === null || log.entityId === 0) continue;

    let entity = journeysMap.get(log.entityId);
    if (!entity) {
      entity = {
        entityId: log.entityId,
        entityClass: "standard",
        priority: 3,
        arrivalTime: log.simTime,
        status: "in_flight",
        stepsMap: new Map(),
        orderedSteps: [],
      };
      journeysMap.set(log.entityId, entity);
    }

    const stepKey = `${log.nodeId}_${entity.orderedSteps.length}`;
    let currentStep = entity.stepsMap.get(log.nodeId);

    switch (log.event) {
      case "arrived":
        entity.arrivalTime = Math.min(entity.arrivalTime, log.simTime);
        entity.orderedSteps.push({
          nodeId: log.nodeId,
          nodeLabel: log.nodeLabel || log.nodeId,
          nodeType: "source",
          enteredAt: log.simTime,
          exitedAt: log.simTime,
          waitTime: 0,
          serviceTime: 0,
          status: "completed",
        });
        break;

      case "queued":
        currentStep = {
          nodeId: log.nodeId,
          nodeLabel: log.nodeLabel || log.nodeId,
          nodeType: "queue",
          enteredAt: log.simTime,
          waitTime: 0,
          serviceTime: 0,
          status: "in_progress",
        };
        entity.stepsMap.set(log.nodeId, currentStep);
        break;

      case "reneged":
        if (currentStep) {
          currentStep.exitedAt = log.simTime;
          currentStep.waitTime = Math.max(0, log.simTime - (currentStep.enteredAt ?? log.simTime));
          currentStep.status = "reneged";
          entity.orderedSteps.push(currentStep as EntityJourneyStep);
          entity.stepsMap.delete(log.nodeId);
        }
        entity.status = "reneged";
        entity.departureTime = log.simTime;
        break;

      case "service_start":
        if (currentStep) {
          currentStep.serviceStartedAt = log.simTime;
          currentStep.waitTime = Math.max(0, log.simTime - (currentStep.enteredAt ?? log.simTime));
        } else {
          currentStep = {
            nodeId: log.nodeId,
            nodeLabel: log.nodeLabel || log.nodeId,
            nodeType: "resource",
            enteredAt: log.simTime,
            serviceStartedAt: log.simTime,
            waitTime: 0,
            serviceTime: 0,
            status: "in_progress",
          };
          entity.stepsMap.set(log.nodeId, currentStep);
        }
        break;

      case "service_end":
        if (currentStep) {
          currentStep.exitedAt = log.simTime;
          const started = currentStep.serviceStartedAt ?? currentStep.enteredAt ?? log.simTime;
          currentStep.serviceTime = Math.max(0, log.simTime - started);
          currentStep.status = "completed";
          entity.orderedSteps.push(currentStep as EntityJourneyStep);
          entity.stepsMap.delete(log.nodeId);
        }
        break;

      case "dropped":
      case "rejected":
        entity.status = "dropped";
        entity.departureTime = log.simTime;
        break;

      case "completed":
        entity.status = "completed";
        entity.departureTime = log.simTime;
        entity.orderedSteps.push({
          nodeId: log.nodeId,
          nodeLabel: log.nodeLabel || log.nodeId,
          nodeType: "sink",
          enteredAt: log.simTime,
          exitedAt: log.simTime,
          waitTime: 0,
          serviceTime: 0,
          status: "completed",
        });
        break;
    }
  }

  // Entities still waiting when the run ended never got a "service_start", so their wait window
  // was left open and counted as 0. In an overloaded system that is most of the crowd, which
  // pulled the median wait to 0 while the 95th percentile read tens of minutes. Close the open
  // window at the end of the run (a lower bound on their true wait). The queue node and its
  // downstream resource log "queued" at the same instant, so take the longest open window
  // instead of summing them.
  const runEnd = endTime ?? logs.reduce((m, l) => Math.max(m, l.simTime), 0);
  for (const item of journeysMap.values()) {
    if (item.status !== "in_flight") continue;
    let openWait = 0;
    for (const step of item.stepsMap.values()) {
      if (step.serviceStartedAt === undefined && step.enteredAt !== undefined) {
        openWait = Math.max(openWait, runEnd - step.enteredAt);
      }
    }
    if (openWait > 0) {
      item.orderedSteps.push({
        nodeId: "still_waiting",
        nodeLabel: "Still waiting at end of run",
        nodeType: "queue",
        enteredAt: runEnd - openWait,
        exitedAt: runEnd,
        waitTime: openWait,
        serviceTime: 0,
        status: "in_progress",
      } as EntityJourneyStep);
    }
  }

  const result: EntityJourney[] = [];
  for (const item of journeysMap.values()) {
    const departure = item.departureTime ?? (item.orderedSteps.length > 0 ? item.orderedSteps[item.orderedSteps.length - 1].exitedAt : item.arrivalTime);
    const totalCycleTime = Math.max(0, departure - item.arrivalTime);
    const totalWaitTime = item.orderedSteps.reduce((sum, s) => sum + (s.waitTime || 0), 0);
    const totalServiceTime = item.orderedSteps.reduce((sum, s) => sum + (s.serviceTime || 0), 0);

    result.push({
      entityId: item.entityId,
      entityClass: item.entityClass,
      priority: item.priority,
      arrivalTime: item.arrivalTime,
      departureTime: item.departureTime,
      totalCycleTime,
      totalWaitTime,
      totalServiceTime,
      status: item.status,
      steps: item.orderedSteps,
    });
  }

  return result.sort((a, b) => a.entityId - b.entityId);
}

/**
 * Validates Little's Law (L = λW) and checks system queuing stability.
 */
export function calculateLittlesLaw(result: SimResult, journeys: EntityJourney[]): LittlesLawVerification {
  const duration = Math.max(1, result.totalSimTime);
  const lambdaArrivalRate = result.totalArrived / duration;

  // Compute average cycle time (W) for completed entities
  const completedJourneys = journeys.filter((j) => j.status === "completed");
  const averageCycleTimeW = completedJourneys.length > 0
    ? completedJourneys.reduce((sum, j) => sum + j.totalCycleTime, 0) / completedJourneys.length
    : (result.totalCompleted > 0 ? (duration / result.totalCompleted) : 0);

  // Compute time-weighted average WIP (L) from timeline integration
  let totalWipArea = 0;
  if (result.timeline && result.timeline.length > 1) {
    for (let i = 1; i < result.timeline.length; i++) {
      const dt = result.timeline[i].simTime - result.timeline[i - 1].simTime;
      const depthObj = result.timeline[i].depth || {};
      const currentWip = result.timeline[i].wip ?? Object.values(depthObj).reduce((a, b) => a + b, 0);
      totalWipArea += currentWip * dt;
    }
  }

  // Broadcast blocks complete one copy per consumer, so completed can exceed arrived.
  const timeWeightedWIP_L = totalWipArea > 0 ? (totalWipArea / duration) : Math.max(0, result.totalArrived - result.totalCompleted);
  // L = λW holds for what entered the system: arrivals turned away at a full buffer never count.
  const dropped = Object.values(result.nodeStats || {}).reduce((n, s) => n + (s.droppedCount ?? 0), 0);
  const computedWIP_LambdaW = (Math.max(0, result.totalArrived - dropped) / duration) * averageCycleTimeW;

  const maxVal = Math.max(timeWeightedWIP_L, computedWIP_LambdaW, 0.001);
  const discrepancyPercent = (Math.abs(timeWeightedWIP_L - computedWIP_LambdaW) / maxVal) * 100;

  // Stability is a FLOW question, not an estimator-agreement question.
  //
  // L = lambda*W is a theorem: it holds in overloaded systems too. Measured on an
  // unstable queue (lambda=2, mu=1) both sides come out at 268.5 with a 0.0%
  // discrepancy. The previous implementation inferred "accumulating_backlog" from
  // a large discrepancy, which only ever fired because WIP was being double-counted
  // upstream -- it was detecting its own arithmetic error, not the system's state.
  //
  // Instability is detected from the two signals that actually carry it: whether
  // departures keep up with arrivals, and whether WIP trends upward over the run.
  const departureRate = result.totalCompleted / duration;
  const servedFraction = lambdaArrivalRate > 0 ? departureRate / lambdaArrivalRate : 1;

  let wipTrend = 0;
  const tl = result.timeline;
  if (tl && tl.length >= 6) {
    const third = Math.floor(tl.length / 3);
    const meanWip = (slice: typeof tl) =>
      slice.reduce((a, t) => a + (t.wip ?? 0), 0) / Math.max(1, slice.length);
    wipTrend = meanWip(tl.slice(-third)) - meanWip(tl.slice(0, third));
  }

  let verdict: LittlesLawVerification["verdict"] = "steady_state";
  let isStable = true;

  if (servedFraction < 0.95 && wipTrend > 0) {
    // Arrivals outrunning departures with a rising backlog.
    verdict = "accumulating_backlog";
    isStable = false;
  } else if (discrepancyPercent > 20) {
    // The two estimators disagree: the run has not reached steady state, or too
    // much of it is still in flight for the completed-entity sample to be
    // representative. This is a data-quality signal, not an instability one.
    verdict = "transient";
  }

  return {
    lambdaArrivalRate: parseFloat(lambdaArrivalRate.toFixed(3)),
    averageCycleTimeW: parseFloat(averageCycleTimeW.toFixed(2)),
    timeWeightedWIP_L: parseFloat(timeWeightedWIP_L.toFixed(2)),
    computedWIP_LambdaW: parseFloat(computedWIP_LambdaW.toFixed(2)),
    discrepancyPercent: parseFloat(discrepancyPercent.toFixed(1)),
    isStable,
    verdict,
  };
}

/**
 * Computes Resource Operational State Breakdown (Busy vs Starved vs Blocked).
 */
export function calculateResourceOperationalStates(
  nodeStats: Record<string, NodeStats>,
  totalSimTime: number
): Record<string, ResourceOperationalStates> {
  const states: Record<string, ResourceOperationalStates> = {};
  const duration = Math.max(1, totalSimTime);

  for (const [nodeId, stat] of Object.entries(nodeStats)) {
    if (isServerNode(stat)) {
      const util = Math.min(1.0, Math.max(0, stat.utilization ?? 0));
      // Server-seconds across all parallel servers (a 4-server station busy all run = 4 × duration),
      // so per-server hourly costs aren't undercounted. The engine reports this directly when it can.
      const servers = Math.max(1, stat.capacity ?? 1);
      const busySeconds = stat.busySeconds ?? util * duration * servers;
      const starvedSeconds = Math.max(0, duration * servers - busySeconds);
      const blockedSeconds = 0; // Future extension when downstream queue is full

      states[nodeId] = {
        busySeconds: parseFloat(busySeconds.toFixed(1)),
        starvedSeconds: parseFloat(starvedSeconds.toFixed(1)),
        blockedSeconds: parseFloat(blockedSeconds.toFixed(1)),
        busyRatio: parseFloat(util.toFixed(3)),
        starvedRatio: parseFloat((1 - util).toFixed(3)),
        blockedRatio: 0,
      };
    }
  }

  return states;
}

/**
 * Calculates domain-tailored Operations Research KPI tiles based on the simulation domain.
 */
export function computeDomainMetrics(
  simType: SimTypeId,
  result: SimResult,
  waitStats: PercentileStats,
  waitSamples: number[] = [],
  cycleStats?: PercentileStats
): DomainMetricCard[] {
  const cards: DomainMetricCard[] = [];
  const totalArrived = result.totalArrived;
  const totalCompleted = result.totalCompleted;
  const duration = Math.max(1, result.totalSimTime);
  const servers = Object.values(result.nodeStats).filter(isServerNode);
  const maxUtil = Math.max(0, ...servers.map((s) => s.utilization || 0));
  const completionRatio = totalArrived > 0 ? totalCompleted / totalArrived : 1;

  // Total reneged across all nodes
  const totalReneged = Object.values(result.nodeStats).reduce((sum, s) => sum + (s.renegeCount || 0), 0);
  const renegeRate = totalArrived > 0 ? (totalReneged / totalArrived) * 100 : 0;

  switch (simType) {
    case "human_queue": {
      // 1. Share of customers actually served (or still waiting) within the target wait.
      const targetWait = 300;
      const share = waitSamples.length > 0 ? waitSamples.filter((w) => w <= targetWait).length / waitSamples.length : null;
      cards.push({
        id: "sla_compliance",
        label: "Waited Under 5 Min",
        value: share === null ? "N/A" : `${Math.round(share * 100)}%`,
        unit: "of customers",
        status: share === null || share >= 0.9 ? "optimal" : share >= 0.7 ? "warning" : "critical",
        benchmark: "Target: 90%+",
        description: "Share of customers whose total wait in line was 5 minutes or less (anyone still waiting at the end counts with the wait so far).",
        iconName: "Clock",
      });

      // 2. Customers Leaving Line (Gave Up)
      cards.push({
        id: "renege_rate",
        label: "Left Line (Gave Up Waiting)",
        value: `${renegeRate.toFixed(1)}%`,
        unit: "walked away",
        status: renegeRate < 3 ? "optimal" : renegeRate < 8 ? "warning" : "critical",
        benchmark: "Goal: Under 2%",
        description: "Percentage of customers who left the line before reaching the counter because it took too long.",
        iconName: "UserMinus",
      });

      // 3. Counter Busyness
      cards.push({
        id: "teller_load",
        label: "Busiest Counter Load",
        value: `${Math.round(maxUtil * 100)}%`,
        unit: "busy %",
        status: maxUtil < 0.85 ? "optimal" : maxUtil < 0.95 ? "warning" : "critical",
        benchmark: "Sweet Spot: 70% – 85%",
        description: "How busy the hardest-working service desk was during the day.",
        iconName: "Activity",
      });
      break;
    }

    case "manufacturing": {
      // 1. Machine load, weighted by how many parallel machines each block has.
      const cap = servers.reduce((n, s) => n + Math.max(1, s.capacity ?? 1), 0);
      const avgUtil = cap > 0 ? servers.reduce((n, s) => n + (s.utilization || 0) * Math.max(1, s.capacity ?? 1), 0) / cap : 0;
      const loadPct = Math.round(avgUtil * 100);
      cards.push({
        id: "machine_load",
        label: "Average Machine Load",
        value: cap > 0 ? `${loadPct}%` : "N/A",
        unit: "busy",
        status: cap === 0 || (loadPct >= 60 && loadPct <= 90) ? "optimal" : loadPct > 95 || loadPct < 30 ? "critical" : "warning",
        benchmark: "Sweet Spot: 60% – 90%",
        description: "Share of time machines spent working, across all machines. Near 100% means parts pile up; very low means idle machines.",
        iconName: "Factory",
      });

      // 2. Takt (demand pace) vs the pace the line actually delivered.
      const takt = totalArrived > 0 ? duration / totalArrived : null;
      const actual = totalCompleted > 0 ? duration / totalCompleted : null;
      cards.push({
        id: "takt_time",
        label: "Time Needed Per Item",
        value: takt === null ? "N/A" : fmtDuration(takt),
        unit: "per item (takt)",
        status: takt === null ? "optimal" : actual === null || actual > takt * 1.25 ? "critical" : actual > takt * 1.05 ? "warning" : "optimal",
        benchmark: actual === null ? "Nothing finished yet" : `Actual: one every ${fmtDuration(actual)}`,
        description: "How often an item must finish to keep up with demand, compared with how often one actually finished.",
        iconName: "Timer",
      });

      // 3. Unfinished Items Piling Up
      const currentWip = Math.max(0, totalArrived - totalCompleted);
      cards.push({
        id: "wip_inventory",
        label: "Items Currently on Assembly Line",
        value: currentWip,
        unit: "items in progress",
        status: currentWip < 10 ? "optimal" : currentWip < 30 ? "warning" : "critical",
        benchmark: "Goal: Keep this low",
        description: "Total unfinished parts currently sitting on the floor waiting for the next step.",
        iconName: "Boxes",
      });
      break;
    }

    case "vehicle": {
      // 1. Traffic Smoothness Grade
      // HCM signalised-intersection level-of-service bands (control delay per vehicle, seconds).
      const avgDelay = waitStats.mean;
      let los = "A (Clear Road)";
      let status: DomainMetricCard["status"] = "optimal";
      if (avgDelay > 80) { los = "F (Severe Traffic Jam)"; status = "critical"; }
      else if (avgDelay > 55) { los = "E (Heavy Congestion)"; status = "critical"; }
      else if (avgDelay > 35) { los = "D (Slow Moving)"; status = "warning"; }
      else if (avgDelay > 20) { los = "C (Normal Flow)"; status = "warning"; }
      else if (avgDelay > 10) { los = "B (Smooth)"; status = "optimal"; }

      cards.push({
        id: "los",
        label: "Traffic Flow Grade",
        value: los,
        unit: `${fmtDuration(avgDelay)} avg delay`,
        status,
        benchmark: "Grade A to F (HCM delay bands)",
        description: "Overall road and intersection smoothness grade based on vehicle waiting time.",
        iconName: "Car",
      });

      // 2. Cars Cleared Per Hour
      const throughputRate = (totalCompleted / duration) * 3600;
      cards.push({
        id: "vehicular_flow",
        label: "Cars Passed Per Hour",
        value: Math.round(throughputRate),
        unit: "cars / hour",
        status: completionRatio >= 0.95 ? "optimal" : completionRatio >= 0.8 ? "warning" : "critical",
        benchmark: `${Math.round(completionRatio * 100)}% of arriving cars got through`,
        description: "Vehicles that made it through per hour of the run.",
        iconName: "TrendingUp",
      });
      break;
    }

    case "network_signal": {
      // End-to-end latency is the delivered messages' cycle time (send → receive), in ms.
      const p99 = (cycleStats?.p99 ?? 0) * 1000;
      cards.push({
        id: "p99_latency",
        label: "Worst-Case Lag Spikes (Top 1%)",
        value: cycleStats ? `${p99.toLocaleString(undefined, { maximumFractionDigits: 1 })}ms` : "N/A",
        unit: "lag delay",
        status: p99 < 15 ? "optimal" : p99 < 35 ? "warning" : "critical",
        benchmark: "Target: Under 20ms",
        description: "The end-to-end delay that only the unluckiest 1% of messages exceeded.",
        iconName: "Zap",
      });

      // 2. Jitter = standard deviation of end-to-end latency.
      const jitter = (cycleStats?.stdDev ?? 0) * 1000;
      cards.push({
        id: "jitter",
        label: "Delay Bounciness (Jitter)",
        value: cycleStats ? `${jitter.toLocaleString(undefined, { maximumFractionDigits: 1 })}ms` : "N/A",
        unit: "delay variance",
        status: jitter < 5 ? "optimal" : jitter < 15 ? "warning" : "critical",
        benchmark: "Target: Under 10ms",
        description: "How bumpy or unstable the connection speed felt over time.",
        iconName: "Radio",
      });
      break;
    }

    default: {
      const speed = perTimeParts(totalCompleted / duration);
      cards.push({
        id: "throughput_rate",
        label: "Processing Speed",
        value: String(speed.value),
        unit: `items / ${speed.short}`,
        status: "optimal",
        benchmark: `Speed ${speed.per}`,
        description: `How many items successfully finished ${speed.per}.`,
        iconName: "Activity",
      });
    }
  }

  return cards;
}

/**
 * Calculates a 0–100 Composite System Health Score.
 */
export function calculateSystemHealthScore(result: SimResult, littlesLaw: LittlesLawVerification, waitStats: PercentileStats): number {
  if (result.totalArrived === 0) return 100;

  // 1. Throughput Completion Rate (Weight: 35%)
  const completionRate = Math.min(1.0, result.totalCompleted / result.totalArrived);
  const completionScore = completionRate * 35;

  // 2. Bottleneck & Utilization Balance (Weight: 30%)
  const maxUtil = Math.max(0, ...Object.values(result.nodeStats).filter(isServerNode).map((s) => s.utilization || 0));
  let utilScore = 30;
  if (maxUtil > 0.95) utilScore = 15; // severe bottleneck
  else if (maxUtil > 0.88) utilScore = 22;

  // 3. Queuing Stability & Flow Balance (Weight: 20%)
  // Penalise genuine instability, not estimator disagreement (see calculateLittlesLaw).
  let stabilityScore = 20;
  if (!littlesLaw.isStable) stabilityScore = 5;
  else if (littlesLaw.discrepancyPercent > 20) stabilityScore = 12;

  // 4. Tail Latency Penalty (Weight: 15%)
  let tailScore = 15;
  if (waitStats.p99 > waitStats.p50 * 5) tailScore = 8;

  const totalScore = Math.round(completionScore + utilScore + stabilityScore + tailScore);
  return Math.min(100, Math.max(10, totalScore));
}

/**
 * Generates an automated plain-English AI Executive Summary & Optimization Tips.
 */
export function generateExecutiveDiagnosis(
  result: SimResult,
  simType: SimTypeId,
  healthScore: number,
  littlesLaw: LittlesLawVerification,
  waitStats: PercentileStats
): NonNullable<SimResult["aiDiagnosis"]> {
  const bottleneck = result.bottleneckNodeId ? result.nodeStats[result.bottleneckNodeId] : null;
  const config = SIM_TYPE_REGISTRY[simType] || SIM_TYPE_REGISTRY.human_queue; // legacy / AI-created rows
  const totalArrived = result.totalArrived;
  const totalCompleted = result.totalCompleted;
  const efficiency = totalArrived > 0 ? Math.round((totalCompleted / totalArrived) * 100) : 100;

  const entities = `${config.entityName.toLowerCase()}s`;
  const lost = lostCount(result);
  let title = "System Running Smoothly (No Major Delays)";
  let summary = `Over the ${fmtDuration(result.totalSimTime)} run, ${totalCompleted.toLocaleString()} of ${totalArrived.toLocaleString()} ${entities} finished (${efficiency}%). The slowest 5% waited ${fmtDuration(waitStats.p95)} or less.`;

  if (healthScore < 70) {
    title = "Traffic Jam Alert: Big Lines Are Piling Up";
    summary = `Only ${efficiency}% of ${entities} finished${lost > 0 ? `, ${lost.toLocaleString()} left without being served` : ""}. ${
      littlesLaw.isStable
        ? `The slowest 5% waited ${fmtDuration(waitStats.p95)} or more.`
        : `${config.entityName}s arrived faster than the stations could serve them, so lines kept growing.`
    }`;
  } else if (healthScore < 85) {
    title = "Moderate Line Forming During Busy Moments";
    summary = `The system finished ${efficiency}% of ${entities}, but busy moments made the slowest 5% wait ${fmtDuration(waitStats.p95)} or more.`;
  }

  let bottleneckCause = "Everything is well-balanced. No single counter is holding everyone up.";
  if (bottleneck) {
    const utilPct = Math.round((bottleneck.utilization || 0) * 100);
    bottleneckCause = `Counter "${bottleneck.label}" was busy ${utilPct}% of the time with an average line delay of ${fmtDuration(bottleneck.avgWaitTime)}. This is the main choke point where long lines are forming.`;
  }

  return {
    title,
    summary,
    bottleneckCause,
    recommendations: buildRecommendations(result, config.entityName.toLowerCase(), littlesLaw, waitStats),
  };
}

/** Erlang B via the stable recursion, then Erlang C → M/M/c mean queue wait. Infinity when a ≥ c. */
export function mmcWait(c: number, a: number, serviceTime: number): number {
  if (a <= 0) return 0;
  if (a >= c) return Infinity;
  let b = 1;
  for (let k = 1; k <= c; k++) b = (a * b) / (k + a * b);
  const pWait = (c * b) / (c - a * (1 - b));
  return (pWait * serviceTime) / (c - a);
}

type Rec = NonNullable<SimResult["aiDiagnosis"]>["recommendations"][number];

/**
 * Rule-based recommendations computed from this run's numbers. Each candidate gets a score
 * (rough share of the problem it addresses) and the top three are returned, so the card
 * changes with the model instead of repeating a template.
 */
function buildRecommendations(result: SimResult, entity: string, littlesLaw: LittlesLawVerification, waitStats: PercentileStats): Rec[] {
  const T = Math.max(1e-9, result.totalSimTime);
  const arrived = Math.max(1, result.totalArrived);
  const stats = Object.values(result.nodeStats || {});
  const servers = stats.filter((s) => isServerNode(s) && (s.utilization || 0) > 0);
  const out: Array<Rec & { score: number }> = [];
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  // 1. Capacity at the hottest station: size it to ~80% busy and predict the new wait.
  // Target the flagged bottleneck so this agrees with the "Biggest bottleneck" card; else the busiest server.
  const hot = servers.find((s) => s.nodeId === result.bottleneckNodeId) ?? [...servers].sort((x, y) => y.utilization - x.utilization)[0];
  if (hot && hot.utilization >= 0.75) {
    // Servers behind one Queue block share its line, so size them together: the line's arrivals are
    // the demand (a saturated server's own count only shows what it managed to take).
    const queue = hot.fedBy ? result.nodeStats[hot.fedBy] : undefined;
    const pool = queue ? stats.filter((s) => isServerNode(s) && s.fedBy === hot.fedBy) : [hot];
    const shared = !!queue && pool.length > 1;
    const capOf = (s: NodeStats) => Math.max(1, s.capacity ?? 1);
    const c = pool.reduce((n, s) => n + capOf(s), 0);
    const served = pool.reduce((n, s) => n + s.entitiesOut, 0);
    const S = served > 0 ? pool.reduce((n, s) => n + s.avgServiceTime * s.entitiesOut, 0) / served : hot.avgServiceTime;
    const busy = pool.reduce((n, s) => n + (s.utilization || 0) * capOf(s), 0);
    // Count those turned away at a full line too: they are demand the extra servers would serve.
    const arrivals = queue ? queue.entitiesIn : hot.entitiesIn;
    // Offered load in busy servers. Utilization caps at 100% when saturated, so also use the arrival count.
    const a = Math.max(busy, (arrivals / T) * S);
    const waitNow = queue ? queue.avgWaitTime : hot.avgWaitTime;
    const where = shared ? `the "${queue!.label}" line` : `"${hot.label}"`;
    let target = c + 1;
    while (a / target > 0.8 && target < c + 50) target++;
    const add = target - c;
    const modelNow = mmcWait(c, a, S);
    const modelNew = mmcWait(target, a, S);
    // Scale the observed wait by the model's ratio so real variability carries over; when saturated, use the model directly.
    const newWait = Number.isFinite(modelNow) && modelNow > 0 && waitNow > 0 ? waitNow * (modelNew / modelNow) : modelNew;
    const saturated = a >= c;
    const nServers = (n: number) => `${n} server${n > 1 ? "s" : ""}`;
    out.push({
      title: shared ? `Add ${nServers(add)} behind "${queue!.label}" (${c} → ${target})` : `Add ${nServers(add)} at "${hot.label}" (${c} → ${target})`,
      action: saturated
        ? `${where[0].toUpperCase()}${where.slice(1)} gets about ${a.toFixed(1)} servers' worth of work but has only ${c}, so the line grows without limit. ${target} servers bring it to ~${pct(a / target)} busy.`
        : `${where[0].toUpperCase()}${where.slice(1)} is ${pct(busy / c)} busy with ${nServers(c)}. Going to ${target} brings it to ~${pct(a / target)} busy.`,
      // Without a measured service time (nothing finished there yet) the wait can't be estimated.
      impact: S > 0
        ? `Average wait in ${where}: ${fmtDuration(waitNow)} → ~${fmtDuration(newWait)} (queueing-model estimate).`
        : `Takes ${where} from ${pct(busy / c)} to ~${pct(a / target)} busy.`,
      confidence: saturated ? 85 : hot.utilization > 0.9 ? 80 : 70,
      score: saturated ? 1 : hot.utilization,
      // The extra servers can all go on one block of the pool; they share the line either way.
      ...(hot.capacity !== undefined
        ? { fix: { nodeId: hot.nodeId, paramPatch: { capacity: capOf(hot) + add }, description: `Set ${hot.label} capacity to ${capOf(hot) + add}` } }
        : {}),
    });

    // Alternative: same effect by working faster instead of hiring.
    const faster = (0.8 * c) / a; // service-time multiplier that reaches 80% busy
    if (S > 0 && faster < 1 && faster > 0.5) {
      out.push({
        title: `Speed up ${shared ? `the servers behind "${queue!.label}"` : `"${hot.label}"`} by ${pct(1 - faster)}`,
        action: `Cut the average service time from ${fmtDuration(S)} to ${fmtDuration(S * faster)} (better tools, prep, fewer steps) instead of adding staff.`,
        impact: `Brings ${where} to ~80% busy with the same ${nServers(c)}.`,
        confidence: 65,
        score: hot.utilization * 0.7,
      });
    }
  }

  // 2. Lost entities: reneged (gave up waiting) or dropped (buffer full).
  const lost = [...stats].map((s) => ({ s, n: (s.renegeCount ?? 0) + (s.droppedCount ?? 0) })).sort((x, y) => y.n - x.n)[0];
  if (lost && lost.n / arrived > 0.02) {
    const dropped = (lost.s.droppedCount ?? 0) > (lost.s.renegeCount ?? 0);
    out.push({
      title: `Stop losing ${entity}s at "${lost.s.label}"`,
      action: dropped
        ? `${lost.n} ${entity}s were turned away because "${lost.s.label}" was full. Raise its capacity or add capacity downstream so it drains faster.`
        : `${lost.n} ${entity}s gave up after waiting at "${lost.s.label}" (avg wait ${fmtDuration(lost.s.avgWaitTime)}). Shorten that wait or add an express lane.`,
      impact: `Recovers up to ${pct(lost.n / arrived)} of all ${entity}s.`,
      confidence: 80,
      score: 0.9 + lost.n / arrived,
    });
  }

  // 3. Breakdowns eating capacity.
  // Downtime is summed over every server's failure clock, so share it per server.
  const downShare = (s: NodeStats) => (s.totalDowntime ?? 0) / (T * Math.max(1, s.capacity ?? 1));
  const flaky = [...stats].filter((s) => downShare(s) > 0.05).sort((x, y) => downShare(y) - downShare(x))[0];
  if (flaky) {
    out.push({
      title: `Reduce downtime at "${flaky.label}"`,
      action: `"${flaky.label}" broke down ${flaky.breakdownCount ?? 0} time(s); each server was out ${pct(downShare(flaky))} of the run on average. Preventive maintenance or a faster repair crew wins that time back.`,
      impact: `Up to ${pct(downShare(flaky))} more working time at that station.`,
      confidence: 75,
      score: 0.6 + downShare(flaky),
    });
  }

  // 4. Long tail with spare capacity: the waits come from bursts, not a lack of servers.
  if (waitStats.p50 > 0 && waitStats.p95 > 4 * waitStats.p50 && (!hot || hot.utilization < 0.75)) {
    out.push({
      title: "Smooth out arrival bursts",
      action: `Most ${entity}s wait ${fmtDuration(waitStats.p50)} or less, but the slowest 5% wait over ${fmtDuration(waitStats.p95)}, while no station is overloaded. Arrivals come in clumps: use appointments, time slots or staggered release.`,
      impact: `Targets the ${fmtDuration(waitStats.p95)} tail without adding staff.`,
      confidence: 70,
      score: 0.55,
    });
  }

  // 5. Overstaffed stations: can drop a server and stay under 70% busy.
  for (const s of servers) {
    const c = s.capacity ?? 1;
    if (c < 2 || s.utilization >= 0.35) continue;
    const after = (s.utilization * c) / (c - 1);
    if (after > 0.7) continue;
    out.push({
      title: `"${s.label}" has spare capacity (${c} → ${c - 1})`,
      action: `"${s.label}" is only ${pct(s.utilization)} busy. One fewer server would still leave it ${pct(after)} busy.`,
      impact: `Frees 1 of ${c} servers there with little effect on waiting.`,
      confidence: 70,
      score: 0.4 - s.utilization,
      ...(s.capacity !== undefined
        ? { fix: { nodeId: s.nodeId, paramPatch: { capacity: c - 1 }, description: `Set ${s.label} capacity to ${c - 1}` } }
        : {}),
    });
  }

  // 6. Nothing urgent: say how much headroom there is.
  if (out.length === 0) {
    const maxU = hot?.utilization ?? 0;
    const growth = maxU > 0 ? 0.8 / maxU - 1 : 0;
    out.push(
      maxU > 0
        ? {
            title: `About ${pct(growth)} headroom before lines form`,
            action: `The busiest station, "${hot!.label}", runs at ${pct(maxU)}. Demand can grow about ${pct(growth)} before it passes 80% busy and waits start climbing.`,
            impact: littlesLaw.isStable ? "The setup handles current demand with room to spare." : "The run looks short; run it longer to confirm.",
            confidence: 75,
            score: 0.1,
          }
        : { title: "Flow is balanced", action: "No station is busy enough to cause waiting.", impact: "No change needed.", confidence: 70, score: 0 }
    );
  }

  return out
    .sort((x, y) => y.score - x.score)
    .slice(0, 3)
    .map(({ score: _score, ...r }) => r);
}

/**
 * Computes financial metrics (resource busy cost, buffer holding cost, waiting penalties).
 */
export function calculateCostAnalysis(
  graph: SimGraph,
  result: SimResult,
  resourceStates: Record<string, ResourceOperationalStates>
): CostAnalysis {
  const breakdown: CostBreakdown[] = [];
  let totalSystemCost = 0;

  for (const node of graph.nodes) {
    const stats = result.nodeStats[node.id];
    if (!stats) continue;

    let resourceCost = 0;
    let holdingCost = 0;
    let waitingPenalty = 0;

    if (node.nodeType === "resource" || node.nodeType === "priority_resource") {
      const p = (node.params || {}) as ResourceParams;
      const busySeconds = resourceStates[node.id]?.busySeconds ?? 0;
      resourceCost = (p.hourlyCost ?? 0) * (busySeconds / 3600);
    }

    if (node.nodeType === "queue" || node.nodeType === "container") {
      const p = (node.params || {}) as QueueParams & ContainerParams;
      // Approximate entity-seconds-in-queue via avgWaitTime * entitiesIn (L*W relationship,
      // consistent with how littlesLaw estimates WIP).
      const entitySecondsWaited = (stats.avgWaitTime || 0) * (stats.entitiesIn || 0);
      holdingCost = (p.holdingCostPerUnitTime ?? 0) * entitySecondsWaited;
      waitingPenalty = (p.waitingPenaltyPerUnitTime ?? 0) * entitySecondsWaited;
    }

    const totalCost = resourceCost + holdingCost + waitingPenalty;
    if (totalCost > 0) {
      breakdown.push({
        nodeId: node.id,
        nodeLabel: node.label,
        resourceCost,
        holdingCost,
        waitingPenalty,
        totalCost,
      });
      totalSystemCost += totalCost;
    }
  }

  return {
    totalSystemCost,
    breakdown,
    costPerCompletedEntity: result.totalCompleted > 0 ? totalSystemCost / result.totalCompleted : 0,
  };
}

/**
 * Master analytical enrichment function that processes raw SimResult into an enterprise-ready intelligence object.
 */
export function enrichSimResult(rawResult: SimResult, graph?: SimGraph): SimResult {
  // Idempotence guard: page.tsx already enriches before storing, and both result
  // panels re-enrich defensively. Re-running costs a full journey reconstruction.
  if (rawResult.entityJourneys !== undefined) {
    if (graph && !rawResult.costAnalysis && rawResult.resourceStates) {
      return {
        ...rawResult,
        costAnalysis: calculateCostAnalysis(graph, rawResult, rawResult.resourceStates),
      };
    }
    return rawResult;
  }

  // One bottleneck rule for both engines (SimPy picked max wait incl. queues, the legacy worker the
  // deepest line): the server block with the longest wait; a queue only when the flow has no servers.
  // A queue and the server behind it record the same wait, so letting queues compete blamed the queue.
  const stats = Object.values(rawResult.nodeStats || {});
  const pick = (list: NodeStats[]) => list.filter((s) => s.avgWaitTime > 0).sort((a, b) => b.avgWaitTime - a.avgWaitTime || b.utilization - a.utilization)[0];
  const bn = pick(stats.filter(isServerNode)) ?? pick(stats.filter((s) => s.nodeType === "queue"));
  rawResult = { ...rawResult, bottleneckNodeId: bn?.nodeId ?? "", bottleneckLabel: bn?.label ?? "" };

  const journeys = reconstructEntityJourneys(rawResult.logs || [], rawResult.totalSimTime);
  // F-10: keep zero-wait entities. Dropping them makes every percentile
  // conditional on having waited at all, which overstates the median wait by
  // ~46% at rho=0.8 and gets worse as the system gets less congested.
  // Turned-away entities (full buffer) never queued; counting them as 0-wait hid real waits.
  let waitTimes = journeys.filter((j) => j.status !== "dropped").map((j) => j.totalWaitTime).filter((w) => Number.isFinite(w) && w >= 0);
  let cycleTimes = journeys
    .filter((j) => j.status === "completed")
    .map((j) => j.totalCycleTime)
    .filter((c) => Number.isFinite(c) && c >= 0);

  // Fallback: If journeys is sparse due to log buffering, OR the journey
  // reconstruction under-counted waiting (e.g. a queue feeding a "service"/
  // "store"/"channel" block instead of a resource/priority_resource — those
  // blocking points don't emit the "queued" step needed to close the wait
  // window, so every reconstructed wait comes out as exactly 0 even though
  // SimPy measured real waiting) — fall back to nodeStats.avgWaitTime, which
  // SimPy computes directly during the run and is unaffected by log gaps.
  const journeyWaitIsDegenerate = waitTimes.length === 0 || waitTimes.every((w) => w === 0);
  // Only the averages are known then, so use them as a single sample rather than inventing a spread.
  // Waits come from server blocks only: a queue records the same wait as the server behind it.
  if (journeyWaitIsDegenerate) {
    let totalNodeAvgWait = 0;
    let totalNodeAvgService = 0;
    for (const s of Object.values(rawResult.nodeStats || {})) {
      if (isServerNode(s) && s.avgWaitTime > 0) totalNodeAvgWait += s.avgWaitTime;
      if (s.avgServiceTime > 0) totalNodeAvgService += s.avgServiceTime;
    }
    if (totalNodeAvgWait > 0) waitTimes = [totalNodeAvgWait];
    if (cycleTimes.length === 0 && (totalNodeAvgWait > 0 || totalNodeAvgService > 0)) {
      cycleTimes = [totalNodeAvgWait + totalNodeAvgService];
    }
  }

  const waitTimePercentiles = calculatePercentiles(waitTimes);
  const cycleTimePercentiles = calculatePercentiles(cycleTimes);
  const littlesLaw = calculateLittlesLaw(rawResult, journeys);
  const resourceStates = calculateResourceOperationalStates(rawResult.nodeStats || {}, rawResult.totalSimTime);
  const domainMetrics = computeDomainMetrics(rawResult.simType, rawResult, waitTimePercentiles, waitTimes, cycleTimes.length > 0 ? cycleTimePercentiles : undefined);
  const healthScore = calculateSystemHealthScore(rawResult, littlesLaw, waitTimePercentiles);
  const aiDiagnosis = generateExecutiveDiagnosis(rawResult, rawResult.simType, healthScore, littlesLaw, waitTimePercentiles);
  const costAnalysis = graph ? calculateCostAnalysis(graph, rawResult, resourceStates) : rawResult.costAnalysis;

  // Top 10 slowest journeys for inspection
  const topSlowestEntities = [...journeys]
    .sort((a, b) => b.totalCycleTime - a.totalCycleTime)
    .slice(0, 10);

  return {
    ...rawResult,
    entityJourneys: journeys,
    topSlowestEntities,
    waitTimePercentiles,
    cycleTimePercentiles,
    littlesLaw,
    resourceStates,
    domainMetrics,
    healthScore,
    aiDiagnosis,
    costAnalysis,
  };
}
