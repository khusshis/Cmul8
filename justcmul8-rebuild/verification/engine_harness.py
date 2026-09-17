"""
Test harness that executes the REAL Python template embedded in
src/lib/simulation/codeGenerator.ts under CPython + SimPy, and faithfully
re-implements the TypeScript analytics layer (analyticsEngine.ts) so that
benchmark numbers reflect what the product actually shows the user.

Nothing here re-implements the simulation logic: the SimPy source is extracted
verbatim from codeGenerator.ts, so when the template changes these benchmarks
change with it.
"""
from __future__ import annotations

import json
import math
import os
import random
import re

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CODEGEN_TS = os.path.join(REPO_ROOT, "src", "lib", "simulation", "codeGenerator.ts")


# ---------------------------------------------------------------------------
# 1. Extract + render the generated SimPy script (mirrors generateSimPyScript)
# ---------------------------------------------------------------------------

def extract_template(path: str = CODEGEN_TS) -> str:
    src = open(path, encoding="utf-8").read()
    m = re.search(r"const PYTHON_TEMPLATE = `(.*?)`;\s*$", src, re.S)
    if not m:
        raise RuntimeError("PYTHON_TEMPLATE not found in " + path)
    return m.group(1)


def generate_script(template: str, graph: dict, duration_seconds, tick_interval) -> str:
    """Mirrors generateSimPyScript(). JS String.replace(string, ...) replaces the
    FIRST occurrence only, so count=1 reproduces it exactly."""
    node_config = {
        n["id"]: {"nodeType": n["nodeType"], "label": n["label"], "params": n["params"]}
        for n in graph["nodes"]
    }
    edges = [{"id": e["id"], "source": e["source"], "target": e["target"]}
             for e in graph["edges"]]
    out = template.replace("{DURATION}", str(duration_seconds), 1)
    out = out.replace("{TICK_INTERVAL}", str(tick_interval), 1)
    out = out.replace("{NODE_CONFIG_JSON}", json.dumps(node_config), 1)
    out = out.replace("{EDGES_JSON}", json.dumps(edges), 1)
    return out


def run_script(py_source: str, seed: int = 1) -> dict:
    """Executes the generated script with the Pyodide host callbacks stubbed."""
    random.seed(seed)
    captured: dict = {}
    ticks: list = []
    ns = {
        "__name__": "__justcmul8_sim__",
        "emit_sim_result": lambda s: captured.__setitem__("result", json.loads(s)),
        "emit_sim_tick": lambda s: ticks.append(json.loads(s)),
    }
    exec(compile(py_source, "<generated-simpy>", "exec"), ns)
    result = captured["result"]["data"]
    result["_ticks"] = ticks
    return result


# ---------------------------------------------------------------------------
# 2. Faithful port of the TypeScript analytics layer (analyticsEngine.ts).
#    Bug-for-bug on purpose: we measure what users actually see.
# ---------------------------------------------------------------------------

def calculate_percentiles(samples):
    """Port of calculatePercentiles() -- Hyndman & Fan Type 7."""
    if not samples:
        return dict(p25=0, p50=0, p75=0, p90=0, p95=0, p99=0, min=0, max=0,
                    mean=0, stdDev=0, iqr=0)
    s = sorted(samples)
    n = len(s)

    def q(p):
        if n == 1:
            return s[0]
        h = (n - 1) * p
        i = int(math.floor(h))
        gamma = h - i
        if i + 1 < n:
            return (1 - gamma) * s[i] + gamma * s[i + 1]
        return s[i]

    mean = sum(s) / n
    var = sum((v - mean) ** 2 for v in s) / n   # population variance, as in TS
    p75, p25 = q(0.75), q(0.25)
    return dict(p25=p25, p50=q(0.5), p75=p75, p90=q(0.9), p95=q(0.95), p99=q(0.99),
                min=s[0], max=s[-1], mean=mean, stdDev=math.sqrt(var),
                iqr=p75 - p25)


def reconstruct_entity_journeys(logs):
    """Port of reconstructEntityJourneys()."""
    journeys = {}
    for log in logs:
        eid = log.get("entityId")
        if eid is None or eid == 0:
            continue
        e = journeys.get(eid)
        if e is None:
            e = dict(entityId=eid, arrivalTime=log["simTime"], departureTime=None,
                     status="in_flight", stepsMap={}, orderedSteps=[])
            journeys[eid] = e

        cur = e["stepsMap"].get(log["nodeId"])
        ev = log["event"]

        if ev == "arrived":
            e["arrivalTime"] = min(e["arrivalTime"], log["simTime"])
            e["orderedSteps"].append(dict(
                nodeId=log["nodeId"], nodeType="source", enteredAt=log["simTime"],
                exitedAt=log["simTime"], waitTime=0, serviceTime=0, status="completed"))
        elif ev == "queued":
            e["stepsMap"][log["nodeId"]] = dict(
                nodeId=log["nodeId"], nodeType="queue", enteredAt=log["simTime"],
                waitTime=0, serviceTime=0, status="in_progress")
        elif ev == "reneged":
            if cur:
                cur["exitedAt"] = log["simTime"]
                cur["waitTime"] = max(0.0, log["simTime"] - cur.get("enteredAt", log["simTime"]))
                cur["status"] = "reneged"
                e["orderedSteps"].append(cur)
                del e["stepsMap"][log["nodeId"]]
            e["status"] = "reneged"
            e["departureTime"] = log["simTime"]
        elif ev == "service_start":
            if cur:
                cur["serviceStartedAt"] = log["simTime"]
                cur["waitTime"] = max(0.0, log["simTime"] - cur.get("enteredAt", log["simTime"]))
            else:
                e["stepsMap"][log["nodeId"]] = dict(
                    nodeId=log["nodeId"], nodeType="resource", enteredAt=log["simTime"],
                    serviceStartedAt=log["simTime"], waitTime=0, serviceTime=0,
                    status="in_progress")
        elif ev == "service_end":
            if cur:
                cur["exitedAt"] = log["simTime"]
                started = cur.get("serviceStartedAt", cur.get("enteredAt", log["simTime"]))
                cur["serviceTime"] = max(0.0, log["simTime"] - started)
                cur["status"] = "completed"
                e["orderedSteps"].append(cur)
                del e["stepsMap"][log["nodeId"]]
        elif ev in ("dropped", "rejected"):
            e["status"] = "dropped"
            e["departureTime"] = log["simTime"]
        elif ev == "completed":
            e["status"] = "completed"
            e["departureTime"] = log["simTime"]
            e["orderedSteps"].append(dict(
                nodeId=log["nodeId"], nodeType="sink", enteredAt=log["simTime"],
                exitedAt=log["simTime"], waitTime=0, serviceTime=0, status="completed"))

    out = []
    for e in journeys.values():
        dep = e["departureTime"]
        if dep is None:
            dep = e["orderedSteps"][-1]["exitedAt"] if e["orderedSteps"] else e["arrivalTime"]
        out.append(dict(
            entityId=e["entityId"], arrivalTime=e["arrivalTime"],
            departureTime=e["departureTime"],
            totalCycleTime=max(0.0, dep - e["arrivalTime"]),
            totalWaitTime=sum(s.get("waitTime") or 0 for s in e["orderedSteps"]),
            totalServiceTime=sum(s.get("serviceTime") or 0 for s in e["orderedSteps"]),
            status=e["status"], steps=e["orderedSteps"]))
    return sorted(out, key=lambda j: j["entityId"])


def calculate_littles_law(result, journeys):
    """Port of calculateLittlesLaw()."""
    duration = max(1.0, result["totalSimTime"])
    lam = result["totalArrived"] / duration

    completed = [j for j in journeys if j["status"] == "completed"]
    if completed:
        W = sum(j["totalCycleTime"] for j in completed) / len(completed)
    else:
        W = (duration / result["totalCompleted"]) if result["totalCompleted"] > 0 else 0.0

    area = 0.0
    tl = result.get("timeline") or []
    if len(tl) > 1:
        for i in range(1, len(tl)):
            dt = tl[i]["simTime"] - tl[i - 1]["simTime"]
            wip = tl[i].get("wip")
            if wip is None:
                wip = sum((tl[i].get("depth") or {}).values())
            area += wip * dt

    L = (area / duration) if area > 0 else (result["totalArrived"] - result["totalCompleted"])
    lam_w = lam * W
    max_val = max(L, lam_w, 0.001)
    disc = abs(L - lam_w) / max_val * 100

    # Stability is a flow question, not an estimator-agreement question.
    departure_rate = result["totalCompleted"] / duration
    served_fraction = (departure_rate / lam) if lam > 0 else 1.0
    wip_trend = 0.0
    if len(tl) >= 6:
        third = len(tl) // 3
        head = sum(t.get("wip") or 0 for t in tl[:third]) / max(1, third)
        tail_ = sum(t.get("wip") or 0 for t in tl[-third:]) / max(1, third)
        wip_trend = tail_ - head

    verdict, stable = "steady_state", True
    if served_fraction < 0.95 and wip_trend > 0:
        verdict, stable = "accumulating_backlog", False
    elif disc > 20:
        verdict = "transient"
    return dict(lambdaArrivalRate=lam, averageCycleTimeW=W, timeWeightedWIP_L=L,
                computedWIP_LambdaW=lam_w, discrepancyPercent=disc,
                isStable=stable, verdict=verdict)


def calculate_health_score(result, littles, wait_stats):
    """Port of calculateSystemHealthScore()."""
    if result["totalArrived"] == 0:
        return 100
    completion = min(1.0, result["totalCompleted"] / result["totalArrived"]) * 35
    max_util = max([s.get("utilization") or 0 for s in result["nodeStats"].values()] + [0])
    util = 30
    if max_util > 0.95:
        util = 15
    elif max_util > 0.88:
        util = 22
    stab = 20
    if not littles["isStable"]:
        stab = 5
    elif littles["discrepancyPercent"] > 20:
        stab = 12
    tail = 8 if wait_stats["p99"] > wait_stats["p50"] * 5 else 15
    return min(100, max(10, round(completion + util + stab + tail)))


def enrich(result):
    """Port of enrichSimResult(), including the synthetic-percentile fallback."""
    journeys = reconstruct_entity_journeys(result.get("logs") or [])
    # F-10 applied: zero-wait entities are kept (see analyticsEngine.ts).
    wait_times = [j["totalWaitTime"] for j in journeys if j["totalWaitTime"] >= 0]
    cycle_times = [j["totalCycleTime"] for j in journeys
                   if j["status"] == "completed" and j["totalCycleTime"] >= 0]
    used_fallback = False

    if not wait_times:
        used_fallback = True
        tw = sum(s["avgWaitTime"] for s in result["nodeStats"].values()
                 if (s.get("avgWaitTime") or 0) > 0)
        ts = sum(s["avgServiceTime"] for s in result["nodeStats"].values()
                 if (s.get("avgServiceTime") or 0) > 0)
        if tw > 0:
            wait_times = [tw * 0.75, tw * 0.9, tw, tw * 1.15, tw * 1.4]
        if not cycle_times and (tw > 0 or ts > 0):
            base = tw + ts
            cycle_times = [base * 0.8, base * 0.95, base, base * 1.15, base * 1.45]

    return dict(journeys=journeys,
                waitStats=calculate_percentiles(wait_times),
                cycleStats=calculate_percentiles(cycle_times),
                littlesLaw=calculate_littles_law(result, journeys),
                healthScore=calculate_health_score(
                    result, calculate_littles_law(result, journeys),
                    calculate_percentiles(wait_times)),
                usedSyntheticPercentiles=used_fallback,
                nWaitSamples=len(wait_times), nCycleSamples=len(cycle_times))


# ---------------------------------------------------------------------------
# 3. Graph builders + UI-equivalent run configuration
# ---------------------------------------------------------------------------

UNIT_MULTIPLIERS = {"secs": 1, "mins": 60, "hrs": 3600, "days": 86400}


def ui_run_config(duration_value, duration_unit):
    """Mirrors handleRun() in src/app/dashboard/project/[id]/page.tsx."""
    total = max(1, (duration_value or 1) * UNIT_MULTIPLIERS.get(duration_unit, 60))
    tick = max(0.05, total / 1000)
    return total, tick


def queue_graph(arrival_rate, service_mean, capacity,
                arr_dist="exponential", svc_dist="exponential", with_queue_node=True):
    """Source -> [Queue] -> Resource -> Sink, the canonical single-station model."""
    nodes = [
        {"id": "src", "nodeType": "source", "label": "Arrivals",
         "params": {"arrivalRate": arrival_rate, "distribution": arr_dist}},
        {"id": "res", "nodeType": "resource", "label": "Server",
         "params": {"capacity": capacity, "serviceTimeMean": service_mean,
                    "serviceDistribution": svc_dist}},
        {"id": "sink", "nodeType": "sink", "label": "Done",
         "params": {"collectKPIs": True}},
    ]
    if with_queue_node:
        nodes.insert(1, {"id": "q", "nodeType": "queue", "label": "Line",
                         "params": {"capacity": -1, "discipline": "FIFO"}})
        edges = [{"id": "e1", "source": "src", "target": "q"},
                 {"id": "e2", "source": "q", "target": "res"},
                 {"id": "e3", "source": "res", "target": "sink"}]
    else:
        edges = [{"id": "e1", "source": "src", "target": "res"},
                 {"id": "e2", "source": "res", "target": "sink"}]
    return {"nodes": nodes, "edges": edges}
