"""
Benchmark 6 -- complex multi-stage graph with branching, reneging, multiple sinks
and mixed node types.

A realistic graph has no closed-form solution, so this suite checks CONSERVATION
LAWS and ROUTING INVARIANTS instead -- properties that must hold for any correct
discrete-event engine regardless of parameters:

  I1  entity conservation      arrived == completed + reneged + dropped + in-flight
  I2  per-node flow balance    entitiesIn == entitiesOut + currentDepth + losses
  I3  routing fidelity         decision split matches configured probabilities
  I4  sink aggregation         totalCompleted == sum over all sinks
  I5  throughput sufficiency   a graph stable at every station must clear its load
  I6  utilisation bounds       0 <= rho <= 1 at every station, unclamped

Station design (every station is stable in isolation, so any collapse observed is
an engine defect, not an overloaded model):

    Source  lambda = 1.20/s
      -> Triage queue (exp patience, mean 20 s)
      -> Triage  c=2, mean 1.2 s   -> rho = 1.20 * 1.2 / 2 = 0.72
      -> Decision 70 / 30
           70% -> Minor queue -> Minor  c=3, mean 2.5 s -> rho = 0.84 * 2.5 / 3 = 0.70
           30% -> Major queue -> Major  c=1, mean 2.0 s -> rho = 0.36 * 2.0 / 1 = 0.72
      -> Sink A / Sink B
"""
from __future__ import annotations

import statistics
import sys

import engine_harness as H

LAMBDA = 1.20
P_MINOR = 0.70
DURATION = 7200


def build_graph(patience=True):
    q_params = {"capacity": -1, "discipline": "FIFO"}
    if patience:
        q_params.update({"patienceDistribution": "exponential", "patienceTimeout": 20})

    nodes = [
        {"id": "src", "nodeType": "source", "label": "Walk-ins",
         "params": {"arrivalRate": LAMBDA, "distribution": "exponential",
                    "entityClass": "patient", "priorityLevel": "standard"}},
        {"id": "q_tri", "nodeType": "queue", "label": "Triage Line", "params": q_params},
        {"id": "triage", "nodeType": "resource", "label": "Triage Desk",
         "params": {"capacity": 2, "serviceTimeMean": 1.2,
                    "serviceDistribution": "exponential"}},
        {"id": "dec", "nodeType": "decision", "label": "Severity Split",
         "params": {"routes": [{"targetId": "q_min", "probability": P_MINOR},
                               {"targetId": "q_maj", "probability": 1 - P_MINOR}]}},
        {"id": "q_min", "nodeType": "queue", "label": "Minor Line",
         "params": {"capacity": -1, "discipline": "FIFO"}},
        {"id": "minor", "nodeType": "resource", "label": "Minor Care",
         "params": {"capacity": 3, "serviceTimeMean": 2.5,
                    "serviceDistribution": "exponential"}},
        {"id": "q_maj", "nodeType": "queue", "label": "Major Line",
         "params": {"capacity": -1, "discipline": "FIFO"}},
        {"id": "major", "nodeType": "resource", "label": "Major Care",
         "params": {"capacity": 1, "serviceTimeMean": 2.0,
                    "serviceDistribution": "exponential"}},
        {"id": "sinkA", "nodeType": "sink", "label": "Discharged (Minor)",
         "params": {"collectKPIs": True}},
        {"id": "sinkB", "nodeType": "sink", "label": "Discharged (Major)",
         "params": {"collectKPIs": True}},
    ]
    edges = [
        {"id": "e1", "source": "src", "target": "q_tri"},
        {"id": "e2", "source": "q_tri", "target": "triage"},
        {"id": "e3", "source": "triage", "target": "dec"},
        {"id": "e4", "source": "dec", "target": "q_min"},
        {"id": "e5", "source": "dec", "target": "q_maj"},
        {"id": "e6", "source": "q_min", "target": "minor"},
        {"id": "e7", "source": "q_maj", "target": "major"},
        {"id": "e8", "source": "minor", "target": "sinkA"},
        {"id": "e9", "source": "major", "target": "sinkB"},
    ]
    return {"nodes": nodes, "edges": edges}


def exotic_graph():
    """Smoke-exercises the node types the benchmarks never touch."""
    nodes = [
        {"id": "src", "nodeType": "source", "label": "Packets",
         "params": {"arrivalRate": 2.0, "distribution": "exponential",
                    "entityClass": "telemetry", "priorityLevel": "priority"}},
        {"id": "bc", "nodeType": "broadcaster", "label": "Fan-out", "params": {}},
        {"id": "ch", "nodeType": "channel", "label": "Uplink",
         "params": {"bufferCapacity": 50, "propagationDelay": 0.05,
                    "delayDistribution": "deterministic"}},
        {"id": "st", "nodeType": "store", "label": "Buffer",
         "params": {"capacity": 25}},
        {"id": "cont", "nodeType": "container", "label": "Tank",
         "params": {"capacity": 100000, "initialLevel": 0, "fillRate": 1}},
        {"id": "sink1", "nodeType": "sink", "label": "Out A", "params": {"collectKPIs": True}},
        {"id": "sink2", "nodeType": "sink", "label": "Out B", "params": {"collectKPIs": True}},
    ]
    edges = [
        {"id": "e1", "source": "src", "target": "bc"},
        {"id": "e2", "source": "bc", "target": "ch"},
        {"id": "e3", "source": "bc", "target": "st"},
        {"id": "e4", "source": "ch", "target": "cont"},
        {"id": "e5", "source": "cont", "target": "sink1"},
        {"id": "e6", "source": "st", "target": "sink2"},
    ]
    return {"nodes": nodes, "edges": edges}


def check(results, name, expected, observed, ok, detail=""):
    results.append((name, expected, observed, ok, detail))


def analyse(r, e, results, tag=""):
    ns = r["nodeStats"]
    arrived = r["totalArrived"]
    sink_a = ns["sinkA"]["entitiesOut"]
    sink_b = ns["sinkB"]["entitiesOut"]
    reneged = sum(s.get("renegeCount", 0) for s in ns.values())
    dropped = sum(s.get("droppedCount", 0) for s in ns.values())
    done = sink_a + sink_b

    # I4 -- sink aggregation
    check(results, f"I4 totalCompleted == all sinks{tag}", done, r["totalCompleted"],
          r["totalCompleted"] == done,
          f"sinkA={sink_a} sinkB={sink_b}")

    # I1 -- entity conservation.  In-flight is unknowable from the depth counters
    # (they double-count), so we bound it: the residual must be non-negative and
    # small relative to the offered load.
    residual = arrived - done - reneged - dropped
    check(results, f"I1 conservation residual >= 0{tag}", ">= 0", residual, residual >= 0,
          f"arrived={arrived} done={done} reneged={reneged} dropped={dropped}")
    check(results, f"I1 residual < 5% of arrivals{tag}", f"< {0.05 * arrived:.0f}",
          residual, residual < 0.05 * arrived, "large residual = stuck entities")

    # I3 -- routing fidelity at the decision node
    routed = ns["q_min"]["entitiesIn"] + ns["q_maj"]["entitiesIn"]
    if routed > 0:
        share = ns["q_min"]["entitiesIn"] / routed
        check(results, f"I3 decision split == {P_MINOR:.2f}{tag}", f"{P_MINOR:.3f}",
              f"{share:.3f}", abs(share - P_MINOR) < 0.02,
              f"n={routed}")

    # I5 -- throughput sufficiency.  Every station is stable in isolation, so the
    # graph must clear ~all of its (non-reneging) load.
    expected_done = arrived - reneged - dropped
    ratio = done / max(1, expected_done)
    check(results, f"I5 throughput clears offered load{tag}", ">= 0.95",
          f"{ratio:.3f}", ratio >= 0.95,
          f"{done} of {expected_done} served")

    # I6 -- utilisation must be within bounds AND near the analytic value
    for nid, rho_th in (("triage", 0.72), ("minor", 0.70), ("major", 0.72)):
        u = ns[nid]["utilization"]
        check(results, f"I6 rho[{nid}] ~ {rho_th:.2f}{tag}", f"{rho_th:.2f}",
              f"{u:.3f}", abs(u - rho_th) / rho_th < 0.15, "")

    # I2 -- per-node flow balance on a pure pass-through node
    for nid in ("dec", "sinkA", "sinkB"):
        s = ns[nid]
        check(results, f"I2 flow balance [{nid}]{tag}",
              f"in={s['entitiesIn']}", f"out+depth={s['entitiesOut'] + s['currentDepth']}",
              s["entitiesIn"] == s["entitiesOut"] + s["currentDepth"], "")

    return dict(arrived=arrived, done=done, reneged=reneged, residual=residual,
                littles=e["littlesLaw"], health=e["healthScore"],
                synthetic=e["usedSyntheticPercentiles"])


def main():
    tpl = H.extract_template()
    _, tick = H.ui_run_config(DURATION, "secs")
    results = []
    summaries = {}

    for tag, patience in ((" [patience on]", True), (" [patience off]", False)):
        runs = []
        for s in range(3):
            r = H.run_script(H.generate_script(tpl, build_graph(patience), DURATION, tick),
                             seed=9000 + s)
            runs.append((r, H.enrich(r)))
        summaries[tag] = analyse(runs[0][0], runs[0][1], results, tag)
        summaries[tag]["thr_reps"] = [
            (rr["nodeStats"]["sinkA"]["entitiesOut"] + rr["nodeStats"]["sinkB"]["entitiesOut"])
            / max(1, rr["totalArrived"]) for rr, _ in runs]

    print("# Benchmark 6 -- Complex Multi-Stage Graph\n")
    print(f"- Horizon {DURATION}s, lambda={LAMBDA}/s, 3 seeds")
    print("- Every station is stable in isolation "
          "(rho_triage=0.72, rho_minor=0.70, rho_major=0.72)\n")
    print("| Invariant | Expected | Observed | Result | Detail |")
    print("|---|---|---|---|---|")
    failures = 0
    for name, exp, obs, ok, detail in results:
        if not ok:
            failures += 1
        print(f"| {name} | {exp} | {obs} | {'PASS' if ok else '**FAIL**'} | {detail} |")
    print(f"\n**{len(results) - failures} / {len(results)} invariants hold.**\n")

    print("## Run summaries\n")
    for tag, s in summaries.items():
        ll = s["littles"]
        print(f"### {tag.strip()}")
        print(f"- arrived={s['arrived']} served={s['done']} reneged={s['reneged']} "
              f"stuck-residual={s['residual']}")
        print(f"- clearance across 3 seeds: "
              f"{', '.join(f'{v:.3f}' for v in s['thr_reps'])}")
        print(f"- Little's Law: L={ll['timeWeightedWIP_L']:.2f} lambdaW="
              f"{ll['computedWIP_LambdaW']:.2f} disc={ll['discrepancyPercent']:.1f}% "
              f"verdict={ll['verdict']}")
        print(f"- health score={s['health']}  percentiles synthetic={s['synthetic']}\n")

    print("## Exotic node-type smoke test\n")
    try:
        r = H.run_script(H.generate_script(tpl, exotic_graph(), 600, 6), seed=77)
        ns = r["nodeStats"]
        print(f"- completed without error: arrived={r['totalArrived']} "
              f"totalCompleted={r['totalCompleted']}")
        for nid in ("bc", "ch", "st", "cont", "sink1", "sink2"):
            s = ns[nid]
            print(f"  - `{nid}` ({s['nodeType']}): in={s['entitiesIn']} "
                  f"out={s['entitiesOut']} depth={s['currentDepth']} "
                  f"dropped={s.get('droppedCount', 0)} level={s.get('level')}")
    except Exception as exc:
        print(f"- **RAISED {type(exc).__name__}: {exc}**")

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
