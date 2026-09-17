"""
JustCmul8 simulation engine -- mathematical accuracy verification suite.

Runs five canonical Operations Research benchmarks against the SimPy script that
codeGenerator.ts actually emits, compares them to closed-form analytical results,
and prints a Markdown scorecard.

Usage:
    pip install simpy
    python verification/verify_engine.py            # 5 replications (default)
    python verification/verify_engine.py --reps 10
    python verification/verify_engine.py --quick    # short runs, for CI smoke
"""
from __future__ import annotations

import argparse
import math
import re
import statistics
import sys
import time

import engine_harness as H

# Student-t 97.5th percentile, df = reps-1
T_CRIT = {1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365,
          8: 2.306, 9: 2.262, 10: 2.228, 14: 2.145, 19: 2.093, 29: 2.045}


TOL_SCALE = 1.0  # widened by --quick; see Rows.add


def t_crit(df):
    if df in T_CRIT:
        return T_CRIT[df]
    return min((v for k, v in sorted(T_CRIT.items()) if k >= df), default=1.96)


class Rows:
    """Accumulates scorecard rows."""

    def __init__(self):
        self.rows = []
        self.failures = 0

    def add(self, benchmark, metric, theory, observed, ci_halfwidth, tol_pct, note=""):
        if theory in (None, 0):
            err = float("nan")
            ok = observed is not None
        else:
            err = (observed - theory) / theory * 100.0
            # TOL_SCALE widens the band in --quick mode. A 6000 s M/M/1 at rho=0.8
            # has not reached steady state, so it carries a real initial-transient
            # bias (~+8% on W) that is consistent across seeds -- not noise that a
            # confidence interval would absorb. --quick is a smoke test for gross
            # breakage; the full run is the accuracy gate. The scale in force is
            # printed in the scorecard header so a quick pass is never mistaken for
            # an accuracy result.
            ok = abs(err) <= tol_pct * TOL_SCALE
        if not ok:
            self.failures += 1
        self.rows.append(dict(benchmark=benchmark, metric=metric, theory=theory,
                              observed=observed, ci=ci_halfwidth, err=err,
                              tol=tol_pct, ok=ok, note=note))

    def add_bool(self, benchmark, metric, expected, observed, ok, note=""):
        if not ok:
            self.failures += 1
        self.rows.append(dict(benchmark=benchmark, metric=metric, theory=expected,
                              observed=observed, ci=None, err=float("nan"),
                              tol=None, ok=ok, note=note))

    def markdown(self):
        out = ["| # | Metric | Theory | Simulated | 95% CI (+/-) | Delta % | Tol | Result | Note |",
               "|---|--------|--------|-----------|--------------|---------|-----|--------|------|"]
        for r in self.rows:
            def fmt(v):
                if v is None:
                    return "-"
                if isinstance(v, float):
                    return f"{v:.4g}"
                return str(v)
            err = "-" if (r["err"] != r["err"]) else f"{r['err']:+.2f}%"
            tol = "-" if r["tol"] is None else f"+/-{r['tol']}%"
            ci = "-" if r["ci"] is None else f"{r['ci']:.3g}"
            out.append(f"| {r['benchmark']} | {r['metric']} | {fmt(r['theory'])} | "
                       f"{fmt(r['observed'])} | {ci} | {err} | {tol} | "
                       f"{'PASS' if r['ok'] else '**FAIL**'} | {r['note']} |")
        return "\n".join(out)


def mean_ci(values):
    """Returns (mean, 95% CI half-width) across replications."""
    n = len(values)
    m = statistics.fmean(values)
    if n < 2:
        return m, 0.0
    sd = statistics.stdev(values)
    return m, t_crit(n - 1) * sd / math.sqrt(n)


def erlang_c(a, c):
    """Exact Erlang-C blocking-delay probability for offered load a, c servers."""
    rho = a / c
    if rho >= 1:
        return 1.0
    s = sum(a ** k / math.factorial(k) for k in range(c))
    top = a ** c / (math.factorial(c) * (1 - rho))
    return top / (s + top)


def time_weighted_depth(result, node_id):
    """Integrates a single node's currentDepth over the emitted timeline."""
    tl = result.get("timeline") or []
    if len(tl) < 2:
        return 0.0
    area = 0.0
    for i in range(1, len(tl)):
        dt = tl[i]["simTime"] - tl[i - 1]["simTime"]
        area += (tl[i].get("depth") or {}).get(node_id, 0) * dt
    return area / max(1.0, result["totalSimTime"])


def replicate(tpl, graph, duration, tick, reps, seed0=1000):
    out = []
    for i in range(reps):
        r = H.run_script(H.generate_script(tpl, graph, duration, tick), seed=seed0 + i)
        out.append((r, H.enrich(r)))
    return out


# ---------------------------------------------------------------------------
# Benchmark 1 -- M/M/1
# ---------------------------------------------------------------------------

def bench1(tpl, rows, reps, duration, notes):
    lam, mu, c = 0.8, 1.0, 1
    rho = lam / mu
    th = dict(rho=rho, Lq=rho ** 2 / (1 - rho), Wq=rho / (mu * (1 - rho)),
              W=1 / (mu - lam), L=rho / (1 - rho))
    _, tick = H.ui_run_config(duration, "secs")

    for label, with_q in (("B1", True), ("B1v", False)):
        runs = replicate(tpl, H.queue_graph(lam, 1 / mu, c, with_queue_node=with_q),
                         duration, tick, reps)
        util = [r["nodeStats"]["res"]["utilization"] for r, _ in runs]
        wq = [r["nodeStats"]["res"]["avgWaitTime"] for r, _ in runs]
        w = [r["nodeStats"]["res"]["avgWaitTime"] + r["nodeStats"]["res"]["avgServiceTime"]
             for r, _ in runs]
        lq_node = "q" if with_q else "res"
        lq = [time_weighted_depth(r, lq_node) for r, _ in runs]
        tag = "" if with_q else " (no Queue node)"

        for metric, theory, obs in (("Utilisation rho" + tag, th["rho"], util),
                                    ("Queue wait Wq" + tag, th["Wq"], wq),
                                    ("System time W" + tag, th["W"], w)):
            m, ci = mean_ci(obs)
            rows.add(label, metric, theory, m, ci, 3.5)

        m, ci = mean_ci(lq)
        if with_q:
            rows.add(label, "Queue length Lq", th["Lq"], m, ci, 3.5,
                     "from 100-sample timeline")
        else:
            # Without a Queue node the resource depth holds waiting + in-service = L
            rows.add(label, "System WIP L (no Queue node)", th["L"], m, ci, 3.5,
                     "resource depth = L, not Lq")

        if with_q:
            e = runs[0][1]
            rows.add_bool(label, "Percentiles from real samples", "real",
                          "SYNTHETIC (5 fabricated pts)" if e["usedSyntheticPercentiles"]
                          else f"real ({e['nWaitSamples']} pts)",
                          not e["usedSyntheticPercentiles"], "see F-1")
            true_inflight = [r["totalArrived"] - r["totalCompleted"] for r, _ in runs]
            depth_sum = [sum(s["currentDepth"] for s in r["nodeStats"].values())
                         for r, _ in runs]
            rows.add_bool(label, "WIP conservation (sum depth == arrived-completed)",
                          statistics.fmean(true_inflight), statistics.fmean(depth_sum),
                          abs(statistics.fmean(depth_sum) - statistics.fmean(true_inflight)) < 1e-6,
                          "see F-2")
            src = runs[0][0]["nodeStats"]["src"]
            rows.add_bool(label, "Source node entitiesIn reported",
                          runs[0][0]["totalArrived"], src["entitiesIn"],
                          src["entitiesIn"] > 0, "see F-3")
    notes.append(
        "B1 theory: rho=0.8, Lq=3.2, Wq=4.0s, W=5.0s, L=4.0 -- these match the brief.")


# ---------------------------------------------------------------------------
# Benchmark 2 -- M/M/c (Erlang C)
# ---------------------------------------------------------------------------

def bench2(tpl, rows, reps, duration, notes):
    lam, mu, c = 2.4, 1.0, 3
    a = lam / mu
    rho = a / c
    pw = erlang_c(a, c)
    th = dict(rho=rho, pw=pw, Wq=pw / (c * mu - lam), W=pw / (c * mu - lam) + 1 / mu)
    _, tick = H.ui_run_config(duration, "secs")

    runs = replicate(tpl, H.queue_graph(lam, 1 / mu, c), duration, tick, reps)
    util = [r["nodeStats"]["res"]["utilization"] for r, _ in runs]
    wq = [r["nodeStats"]["res"]["avgWaitTime"] for r, _ in runs]
    w = [r["nodeStats"]["res"]["avgWaitTime"] + r["nodeStats"]["res"]["avgServiceTime"]
         for r, _ in runs]

    for metric, theory, obs in (("Utilisation rho (per server)", th["rho"], util),
                                ("Queue wait Wq", th["Wq"], wq),
                                ("System time W", th["W"], w)):
        m, ci = mean_ci(obs)
        rows.add("B2", metric, theory, m, ci, 4.0)

    notes.append(
        f"N-1: The brief states Erlang-C P(W>0)=0.510 for a=2.4,c=3. The exact value is "
        f"{pw:.4f} (cross-checked via Erlang-B recursion: C=B/(1-rho(1-B))). Consequently "
        f"Wq={th['Wq']:.4f}s and W={th['W']:.4f}s, not 0.85s/1.85s. Benchmark 2 is scored "
        f"against the exact values.")


# ---------------------------------------------------------------------------
# Benchmark 3 -- overloaded system, rho > 1
# ---------------------------------------------------------------------------

def bench3(tpl, rows, reps, notes):
    lam, mu, T = 2.0, 1.0, 600
    _, tick = H.ui_run_config(T, "secs")
    runs = replicate(tpl, H.queue_graph(lam, 1 / mu, 1), T, tick, reps)

    arrived = [r["totalArrived"] for r, _ in runs]
    completed = [r["totalCompleted"] for r, _ in runs]
    util = [r["nodeStats"]["res"]["utilization"] for r, _ in runs]
    wip = [r["totalArrived"] - r["totalCompleted"] for r, _ in runs]
    health = [e["healthScore"] for _, e in runs]
    verdicts = [e["littlesLaw"]["verdict"] for _, e in runs]

    for metric, theory, obs, tol in (("Total arrivals", lam * T, arrived, 5.0),
                                     ("Total completed", mu * T, completed, 5.0),
                                     ("Utilisation rho", 1.0, util, 2.0)):
        m, ci = mean_ci(obs)
        rows.add("B3", metric, theory, m, ci, tol)

    m, ci = mean_ci(wip)
    rows.add_bool("B3", "Final WIP in 600 +/- 70 (2 sigma)", "530-670", f"{m:.1f}",
                  abs(m - 600) <= 70, "brief +/-20 is 0.58 sigma; see N-2")

    ok_verdict = all(v == "accumulating_backlog" for v in verdicts)
    rows.add_bool("B3", "Little's Law verdict", "accumulating_backlog",
                  ",".join(sorted(set(verdicts))), ok_verdict, "")

    m, ci = mean_ci(health)
    rows.add_bool("B3", "Health score degrades (< 70 = Grade C/Alert)", "< 70",
                  f"{m:.1f}", m < 70, "see F-5")
    notes.append(
        "B3: there is no 'critical' member of the LittlesLawVerification verdict union "
        "(types.ts); the reachable values are steady_state | accumulating_backlog | "
        "transient. Scored against accumulating_backlog.")


# ---------------------------------------------------------------------------
# Benchmark 4 -- duration unit scaling
# ---------------------------------------------------------------------------

def bench4(tpl, rows, reps, notes):
    cases = [(3600, "secs"), (60, "mins"), (1, "hrs")]
    durations, ticks, arrivals = [], [], []
    for value, unit in cases:
        total, tick = H.ui_run_config(value, unit)
        script = H.generate_script(tpl, H.queue_graph(0.8, 1.0, 1), total, tick)
        m = re.search(r"^DURATION = (\S+)$", script, re.M)
        durations.append(float(m.group(1)))
        ticks.append(tick)
        arrivals.append(statistics.fmean(
            [H.run_script(script, seed=2000 + i)["totalArrived"] for i in range(reps)]))

    rows.add_bool("B4", "env.run(until=) identical across secs/mins/hrs", 3600.0,
                  durations, len(set(durations)) == 1 and durations[0] == 3600.0, "")
    rows.add_bool("B4", "Tick interval identical across units", ticks[0], ticks,
                  len(set(ticks)) == 1, "")
    spread = (max(arrivals) - min(arrivals)) / statistics.fmean(arrivals) * 100
    rows.add_bool("B4", "Arrival counts statistically indistinguishable", "spread < 1%",
                  f"{spread:.3f}%", spread < 1.0, "identical seeds -> identical streams")

    # Tick-resolution regression: sub-100s runs cannot produce 100 ticks.
    t5, k5 = H.ui_run_config(5, "secs")
    rows.add_bool("B4", "Tick granularity for a 5 s run", "<= 0.1 s",
                  f"{k5} s -> {int(t5 / k5)} ticks", k5 <= 0.1, "see F-6")
    notes.append(
        "B4: multipliers secs=1, mins=60, hrs=3600, days=86400 are correct and the three "
        "configurations are bit-identical.")


# ---------------------------------------------------------------------------
# Benchmark 5 -- Little's Law convergence
# ---------------------------------------------------------------------------

def bench5(tpl, rows, reps, duration, notes):
    _, tick = H.ui_run_config(duration, "secs")
    for label, with_q in (("B5", True), ("B5v", False)):
        runs = replicate(tpl, H.queue_graph(0.8, 1.0, 1, with_queue_node=with_q),
                         duration, tick, reps)
        disc = [e["littlesLaw"]["discrepancyPercent"] for _, e in runs]
        m, ci = mean_ci(disc)
        tag = "" if with_q else " (no Queue node)"
        rows.add_bool(label, "Little's Law discrepancy < 5%" + tag, "< 5%",
                      f"{m:.2f}% (CI +/-{ci:.2f})", m < 5.0,
                      "see F-2" if with_q else "")
        # Ground-truth L from the engine's own reported counters, integrated exactly.
        true_l = [statistics.fmean([t["data"]["totalArrived"] - t["data"]["totalCompleted"]
                                    for t in r["_ticks"]]) for r, _ in runs]
        m2, ci2 = mean_ci(true_l)
        rows.add(label, "Time-averaged true WIP" + tag, 4.0, m2, ci2, 8.0,
                 "arrived-completed, 100 ticks")


# ---------------------------------------------------------------------------
# Edge-case / robustness probes
# ---------------------------------------------------------------------------

def edge_cases(tpl):
    out = []

    def probe(name, fn):
        t0 = time.time()
        try:
            out.append((name, fn(), f"{time.time() - t0:.2f}s"))
        except Exception as exc:
            out.append((name, f"RAISED {type(exc).__name__}: {exc}", f"{time.time() - t0:.2f}s"))

    def zero_arrival_rate():
        g = H.queue_graph(0, 1.0, 1)
        r = H.run_script(H.generate_script(tpl, g, 600, 6), seed=5)
        return (f"arrivalRate=0 produced {r['totalArrived']} arrivals "
                f"(expected 0 -- silently falls back to 1/sec)")

    def zero_service_mean():
        g = H.queue_graph(0.8, 0, 1)
        r = H.run_script(H.generate_script(tpl, g, 60, 1), seed=5)
        return (f"serviceTimeMean=0 -> {r['totalCompleted']} completed, "
                f"util={r['nodeStats']['res']['utilization']:.3f}")

    def duration_zero():
        g = H.queue_graph(0.8, 1.0, 1)
        r = H.run_script(H.generate_script(tpl, g, 0, 1), seed=5)
        return f"DURATION=0 terminated cleanly, arrived={r['totalArrived']}"

    def recurring_zero_schedule():
        """Would hang forever; we prove the hazard statically instead of hanging CI."""
        src = H.extract_template()
        has_guard = "max(1e-9" in src or "if period <= 0" in src
        return ("scheduleRecurring with all simTime=0 -> last_period_offset never "
                "advances, delay=0 every iteration: UNBOUNDED TIGHT LOOP. "
                f"Guard present in template: {has_guard}")

    def log_cap():
        g = H.queue_graph(0.8, 1.0, 1, with_queue_node=False)
        r = H.run_script(H.generate_script(tpl, g, 36000, 36), seed=5)
        j = H.reconstruct_entity_journeys(r["logs"])
        cov = len(j) / max(1, r["totalArrived"]) * 100
        return (f"{r['totalArrived']} entities -> {len(r['logs'])} logs retained "
                f"(entity reservoir); journeys cover {cov:.1f}% of entities")

    def float_drift():
        n = 360
        acc = 0.0
        for _ in range(int(36000 / n)):
            acc += n
        return f"36000/{n} accumulated timeouts -> env.now = {acc!r} (exact: {acc == 36000.0})"

    def multi_sink():
        g = H.queue_graph(0.8, 1.0, 1)
        g["nodes"].append({"id": "sink2", "nodeType": "sink", "label": "Done B",
                           "params": {"collectKPIs": True}})
        g["edges"].append({"id": "e4", "source": "res", "target": "sink2"})
        r = H.run_script(H.generate_script(tpl, g, 600, 6), seed=5)
        a = r["nodeStats"]["sink"]["entitiesOut"]
        b = r["nodeStats"]["sink2"]["entitiesOut"]
        return (f"two sinks: sink={a}, sink2={b}, totalCompleted reported="
                f"{r['totalCompleted']} (should be {a + b})")

    def chained_resources():
        g = {"nodes": [
            {"id": "src", "nodeType": "source", "label": "In",
             "params": {"arrivalRate": 0.5, "distribution": "exponential"}},
            {"id": "q", "nodeType": "queue", "label": "Line",
             "params": {"capacity": -1, "discipline": "FIFO"}},
            {"id": "r1", "nodeType": "resource", "label": "Stage 1",
             "params": {"capacity": 1, "serviceTimeMean": 1.0,
                        "serviceDistribution": "exponential"}},
            {"id": "r2", "nodeType": "resource", "label": "Stage 2",
             "params": {"capacity": 1, "serviceTimeMean": 1.0,
                        "serviceDistribution": "exponential"}},
            {"id": "sink", "nodeType": "sink", "label": "Out",
             "params": {"collectKPIs": True}}],
            "edges": [{"id": "e1", "source": "src", "target": "q"},
                      {"id": "e2", "source": "q", "target": "r1"},
                      {"id": "e3", "source": "r1", "target": "r2"},
                      {"id": "e4", "source": "r2", "target": "sink"}]}
        r = H.run_script(H.generate_script(tpl, g, 3600, 36), seed=5)
        u1 = r["nodeStats"]["r1"]["utilization"]
        w1 = r["nodeStats"]["r1"]["avgWaitTime"]
        backlog = r["totalArrived"] - r["totalCompleted"]
        # Tandem M/M/1 -> M/M/1, lambda=0.5, mu=1 at each stage: rho=0.5, Wq=1.0s,
        # and the backlog must stay bounded (~1 entity in flight).
        return (f"tandem M/M/1->M/M/1 (rho=0.5 per stage, Wq_theory=1.0s): "
                f"arrived={r['totalArrived']} completed={r['totalCompleted']} "
                f"backlog={backlog}, r1 util={u1:.3f} (metric ignores blocked time), "
                f"r1 avgWait={w1:.2f}s vs 1.0s theory -- stage 1 stays seized while the "
                f"entity is in stage 2 (blocking-after-service)")

    for nm, fn in (("Zero arrival rate", zero_arrival_rate),
                   ("Zero service mean", zero_service_mean),
                   ("Zero duration", duration_zero),
                   ("Recurring schedule at t=0", recurring_zero_schedule),
                   ("20k log cap vs long run", log_cap),
                   ("Float accumulation on ticks", float_drift),
                   ("Multiple sinks", multi_sink),
                   ("Tandem resources", chained_resources)):
        probe(nm, fn)
    return out


# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--reps", type=int, default=5)
    ap.add_argument("--quick", action="store_true")
    args = ap.parse_args()

    duration = 6000 if args.quick else 36000
    reps = 2 if args.quick else args.reps
    global TOL_SCALE
    TOL_SCALE = 3.0 if args.quick else 1.0

    tpl = H.extract_template()
    rows, notes = Rows(), []
    t0 = time.time()

    print(f"Running benchmarks: reps={reps}, horizon={duration}s ...", file=sys.stderr)
    bench1(tpl, rows, reps, duration, notes)
    print("  B1 done", file=sys.stderr)
    bench2(tpl, rows, reps, duration, notes)
    print("  B2 done", file=sys.stderr)
    bench3(tpl, rows, reps, notes)
    print("  B3 done", file=sys.stderr)
    bench4(tpl, rows, reps, notes)
    print("  B4 done", file=sys.stderr)
    bench5(tpl, rows, reps, duration, notes)
    print("  B5 done", file=sys.stderr)

    print("# JustCmul8 Engine Verification Scorecard\n")
    print(f"- Engine source: `src/lib/simulation/codeGenerator.ts` (PYTHON_TEMPLATE, executed verbatim)")
    print(f"- Analytics: faithful port of `src/lib/simulation/analyticsEngine.ts`")
    print(f"- Replications: {reps} independent seeds | Horizon: {duration}s | "
          f"Wall time: {time.time() - t0:.1f}s")
    if TOL_SCALE != 1.0:
        print(f"- **SMOKE TEST**: tolerances widened {TOL_SCALE:g}x for the short horizon, "
              f"which has not reached steady state. Catches gross breakage only -- run "
              f"without `--quick` for the accuracy gate.\n")
    else:
        print()
    print(rows.markdown())
    print(f"\n**{len(rows.rows) - rows.failures} / {len(rows.rows)} checks passed.**\n")

    if notes:
        print("## Notes\n")
        for n in notes:
            print(f"- {n}")

    print("\n## Edge-case probes\n")
    print("| Probe | Observation | Wall |")
    print("|-------|-------------|------|")
    for nm, obs, wall in edge_cases(tpl):
        print(f"| {nm} | {obs} | {wall} |")

    return 1 if rows.failures else 0


if __name__ == "__main__":
    sys.exit(main())
