# JustCmul8 Simulation Engine — Mathematical & Functional Accuracy Audit

Scope: `justcmul8-rebuild`, commit `50cfd6a` (+ working-tree changes).
Method: the SimPy source embedded in `src/lib/simulation/codeGenerator.ts` is extracted
**verbatim** and executed under CPython 3.14 / SimPy 4.1.2, with `emit_sim_tick` /
`emit_sim_result` stubbed. The TypeScript analytics layer (`analyticsEngine.ts`) is ported
bug-for-bug into Python so the scorecard reflects what the product actually renders, not an
idealised version of it.

Reproduce:

```bash
pip install simpy
cd justcmul8-rebuild/verification
python verify_engine.py --reps 5      # ~110 s
python verify_engine.py --quick       # ~11 s, for CI
```

---

## Headline

**The discrete-event kernel is sound. The analytics and reporting layer on top of it is not.**

Against closed-form M/M/1 and M/M/c solutions over a 10-hour horizon with 5 replications,
the raw SimPy numbers land within **0.3 %** of theory:

| Benchmark | Metric | Theory | Simulated | Δ |
|---|---|---|---|---|
| M/M/1 (λ=0.8, μ=1) | ρ | 0.800 | 0.7979 ± 0.0056 | −0.27 % |
| M/M/1 | W_q | 4.000 s | 4.005 ± 0.173 | +0.13 % |
| M/M/1 | W | 5.000 s | 5.004 ± 0.174 | +0.08 % |
| M/M/1 | L_q | 3.200 | 3.150 ± 0.233 | −1.56 % |
| M/M/c (λ=2.4, μ=1, c=3) | ρ | 0.800 | 0.7983 ± 0.0035 | −0.21 % |
| M/M/c | W_q | 1.0787 s | 1.101 ± 0.053 | +2.09 % |
| M/M/c | W | 2.0787 s | 2.100 ± 0.054 | +1.03 % |
| ρ>1 (λ=2, μ=1, T=600) | completed | 600 | 603.2 ± 21.8 | +0.53 % |
| ρ>1 | ρ | 1.000 | 0.9968 ± 0.0051 | −0.32 % |

So the exponential/uniform/normal/deterministic samplers, the SimPy resource semantics,
the time-weighted utilisation integrator (`busy_seconds` / `last_busy_change`) and the
duration-unit multipliers are all correct.

**21 of 29 checks pass. The 8 failures are the subject of this report**, and every one of
them lives above the kernel — in node semantics, stats aggregation, or the TS analytics.

---

## Correction to the benchmark brief

**N-1 — the Erlang-C target in Benchmark 2 is wrong.** For offered load *a* = 2.4 and
*c* = 3 servers:

```
P0   = 1 / ( Σ_{k=0..2} a^k/k!  +  a^3 / (3!(1-ρ)) ) = 1 / (6.28 + 11.52) = 0.05618
C(3, 2.4) = 11.52 × P0 = 0.6472
```

Cross-checked via the Erlang-B recursion: B = 0.2684, C = B/(1−ρ(1−B)) = 0.6472. So

- P(W>0) = **0.6472**, not 0.510
- W_q = C/(cμ−λ) = **1.0787 s**, not 0.85 s
- W = **2.0787 s**, not 1.85 s

The engine produces 1.101 s / 2.100 s — a **pass** at ±4 % against the correct value, and a
spurious ~29 % "failure" against the briefed one. The suite scores against the exact value.

**N-2 — the Benchmark 3 pass band is statistically too tight.** Arrivals over T=600 at
λ=2 are Poisson(1200) with σ ≈ 34.6, so final WIP inherits σ ≈ 35. A "600 ± 20" criterion
is a ±0.58σ band that a *correct* engine fails ~56 % of the time. Observed: 578.2 ± 21.8,
which is 0.63σ from 600 — statistically indistinguishable from correct. Recommend widening
to 600 ± 70 (±2σ) or averaging ≥ 20 replications.

**N-3 — there is no `"critical"` Little's-Law verdict.** The union in `types.ts` is
`steady_state | accumulating_backlog | transient`. Benchmark 3 is scored against
`accumulating_backlog`, which the engine does emit correctly.

---

## Findings

### F-1 — Wait-time percentiles are fabricated whenever a Queue node is used — **critical**

`reconstructEntityJourneys` keys in-progress steps by `nodeId`
([analyticsEngine.ts:129](../src/lib/simulation/analyticsEngine.ts#L129)). In the canonical
topology `Source → Queue → Resource → Sink`, the `queued` event is logged against the
**Queue** node, while `service_start` / `service_end` are logged against the **Resource**
node ([codeGenerator.ts:258-284](../src/lib/simulation/codeGenerator.ts#L258-L284)) —
because the queue branch calls `do_resource_service()` directly and `entity_process` is
never entered for the resource. The queue step therefore never matches a `service_start`,
is never pushed to `orderedSteps`, and `totalWaitTime` is **0 for every entity**.

`waitTimes` comes back empty, so `enrichSimResult` takes the fallback branch
([analyticsEngine.ts:604-628](../src/lib/simulation/analyticsEngine.ts#L604-L628)) and
synthesises five points `[0.75×, 0.9×, 1.0×, 1.15×, 1.4×]` of the node-average wait.

Every percentile the UI shows — p50, p90, p95, p99, σ, IQR, the tail-latency health
penalty, the network-domain "Worst-Case Lag Spikes" and "Jitter" cards — is then derived
from five interpolated points on a straight line. Measured: `usedSyntheticPercentiles =
true`, `nWaitSamples = 5` on every Queue-node run.

Remove the Queue node and it works (2 154 real samples), so the defect is topology-
dependent and invisible in simple test graphs.

**Fix:** log `queued` on the resource node as well when the queue branch hands off, or key
`stepsMap` by the (queue, resource) pair. Better: have the queue branch emit
`log_event(queued_at, eid, res_node_id, res_label, "queued")` before `do_resource_service`.

---

### F-2 — Work-in-progress is double-counted, which breaks Little's Law — **critical**

In the queue branch an entity increments **both** `stats[queue]["currentDepth"]` and
`res_s["currentDepth"]` while it waits
([codeGenerator.ts:258](../src/lib/simulation/codeGenerator.ts#L258)). `tick_emitter` sums
all node depths into `wip`, so every waiting entity is counted twice.

Measured on M/M/1, ρ=0.8: true in-flight = 3.8, reported Σ depth = 6.6.

`calculateLittlesLaw` integrates that inflated series
([analyticsEngine.ts:248](../src/lib/simulation/analyticsEngine.ts#L248)) and compares it
to λW. Result on a **perfectly stable** M/M/1:

| | value |
|---|---|
| time-weighted WIP L (reported) | 6.5 |
| λ × W | 3.33 |
| discrepancy | **43.1 % ± 7.6** |
| verdict | `accumulating_backlog`, `isStable = false` |

So the flagship stability check declares a textbook-stable queue to be in runaway backlog,
and `calculateSystemHealthScore` docks it 15 of 20 stability points
([analyticsEngine.ts:261](../src/lib/simulation/analyticsEngine.ts#L261)). With the Queue
node removed the same model reports 7.7 % and `steady_state`.

**Fix:** do not increment `res_s["currentDepth"]` from the queue branch (the queue's own
depth already represents the waiting entity); increment it inside `do_resource_service`
when service actually starts. Or exclude queue-fed resources from the `wip` sum.

---

### F-3 — Source nodes always report zero entities — **high**

`source_process.spawn_entity()` logs and then dispatches straight to the targets
([codeGenerator.ts:519-527](../src/lib/simulation/codeGenerator.ts#L519-L527)). It never
calls `entity_process` on the source node itself, so the `node_type == "source"` branch at
[codeGenerator.ts:234](../src/lib/simulation/codeGenerator.ts#L234) is dead code and
`stats[source]` stays all-zero forever.

Measured: 28 584 arrivals, `nodeStats.src.entitiesIn = 0`, `entitiesOut = 0`,
`utilization = 0`. The canvas and the node table show an idle Source on every run.

**Fix:** in `spawn_entity`, `s = stats[node_id]; s["entitiesIn"] += 1; s["entitiesOut"] += 1`.

---

### F-4 — `totalCompleted` only counts the first Sink — **high**

`stats_total_completed` returns on the first sink it encounters
([codeGenerator.ts:583-587](../src/lib/simulation/codeGenerator.ts#L583-L587)).

Measured with two sinks: sink=240, sink2=240, `totalCompleted` reported **240** instead of
480. This propagates into throughput, completion rate (35 % of the health score),
Little's Law λ and W, and the executive summary's "X of Y finished" line. Any model with a
Decision node fanning out to more than one Sink halves its reported output.

**Fix:** `return sum(s["entitiesOut"] for nid, s in snap.items() if NODE_CONFIG[nid]["nodeType"] == "sink")`.

---

### F-5 — Blocking-after-service: a server stays seized for the whole downstream chain — **critical**

`do_resource_service` is invoked **inside** the `with res.request()` block, and its last act
is to recurse into the next node
([codeGenerator.ts:216-218](../src/lib/simulation/codeGenerator.ts#L216-L218)). The request
context therefore does not exit until the entity has traversed the entire remaining graph.
The same pattern applies to the direct-resource branch.

For `Source → Queue → R1 → R2 → Sink` with λ=0.5 and μ=1 at each stage (ρ=0.5 per stage,
W_q = 1.0 s, stable):

| | theory | measured |
|---|---|---|
| R1 avg wait | 1.0 s | **138.4 s** |
| arrived / completed | balanced | 1 885 / 1 731 |
| backlog at T | ~1 | **154 and growing** |
| R1 utilisation *metric* | 0.50 | 0.497 |

The utilisation metric looks healthy because `busy_seconds` is only accumulated around the
`env.timeout(svc_time)` — it never counts the blocked-but-seized time. So the KPI hides the
defect while throughput silently collapses. Every multi-stage model in the product is
affected, and the more stages, the worse it gets.

**Fix:** restructure so the resource is released before routing downstream — end
`do_resource_service` by returning `next_id`, and let the caller exit the `with` block
before spawning `entity_process` for the next node (`env.process(...)` without `yield`, or
`yield` after the block).

---

### F-6 — Tick interval is `max(1, round(T/100))`, not `max(0.1, T/100)` — **medium**

[page.tsx:250](../src/app/dashboard/project/[id]/page.tsx#L250). Consequences:

- Runs shorter than 100 s cannot reach 100 ticks. A 5-second run yields **5 ticks**; the
  AreaChart is a 5-point polyline and the WIP integral is meaningless.
- `Math.round` makes the tick count non-monotonic: T=150 → tick 2 → 75 ticks; T=250 →
  tick 3 → 83 ticks.
- 100 ticks is itself too coarse — see the statistical section below.

**Fix:** `const tickInterval = Math.max(0.05, totalDurationSeconds / 1000);` and keep it a
float. The template already tolerates fractional timeouts.

---

### F-7 — `arrivalRate = 0` silently becomes 1 entity/second — **medium**

[codeGenerator.ts:541](../src/lib/simulation/codeGenerator.ts#L541):

```python
inter_arrival = sample(distribution, 1.0 / arrival_rate if arrival_rate > 0 else 1.0)
```

The guard avoids a `ZeroDivisionError` but substitutes a mean inter-arrival of 1.0 s, i.e.
**rate 1/s**. Measured: `arrivalRate=0` over 600 s produced **602 arrivals**. A user who
disables a source by zeroing its rate gets the busiest source in the graph.

**Fix:** `if arrival_rate <= 0: return` before the loop.

---

### F-8 — Recurring schedule with `simTime = 0` hangs the browser tab — **high**

[codeGenerator.ts:537](../src/lib/simulation/codeGenerator.ts#L537):

```python
last_period_offset += max(e["simTime"] for e in schedule)
```

If every scheduled entry has `simTime = 0` (a plausible "fire a batch immediately, repeat"
configuration), the period is 0, `fire_at` stays 0, `delay = max(0.0, 0 - env.now)` is 0,
and the loop spins without ever advancing simulation time. `env.run(until=DURATION)` cannot
terminate it. In Pyodide this is an unkillable tight loop inside the Web Worker.

There is no guard in the template (verified programmatically). The same hazard exists for
any schedule whose entries are all identical.

**Fix:** `period = max(e["simTime"] for e in schedule); if period <= 0: break` before
recurring, and clamp `delay` to a positive epsilon.

---

### F-9 — The 20 000-log cap silently truncates statistics to the warm-up transient — **high**

[codeGenerator.ts:72](../src/lib/simulation/codeGenerator.ts#L72) caps `all_logs` at 20 000
entries. A single M/M/1 entity emits ~5 events, so the cap is reached after ~4 000
entities. On the briefed 10-hour M/M/1 run (28 714 entities) the cap retains logs for
**13.9 % of entities — all of them from the start of the run.**

Because `reconstructEntityJourneys`, the percentiles and Little's Law's *W* all derive from
`all_logs`, every distribution statistic is computed on the initial transient, when queues
are still filling. Measured effect on the tail:

| statistic | capped (20 k) | uncapped | theory (cond. on wait>0) |
|---|---|---|---|
| n samples | 3 149 | 22 955 | — |
| mean | 4.642 | 5.020 | 5.000 |
| p50 | 3.280 | 3.430 | 3.466 |
| p95 | 13.415 | 15.349 | 14.979 |
| **p99** | **19.457** | 23.575 | 23.026 |

The cap understates p99 by **15.5 %**. Uncapped, the engine reproduces theory to within
2.4 %. This is a truncation *bias*, not noise — more replications will not fix it.

**Fix:** keep a reservoir sample rather than a prefix (`random` replacement once the cap is
hit), or accumulate running percentile sketches (t-digest / P²) in Python and stop shipping
raw logs for long runs. A prefix is the one sampling scheme guaranteed to be biased here.

---

### F-10 — Zero-wait entities are filtered out, so "wait percentiles" answer the wrong question — **medium**

[analyticsEngine.ts:601-602](../src/lib/simulation/analyticsEngine.ts#L601-L602):

```ts
let waitTimes = journeys.map(j => j.totalWaitTime).filter(w => w > 0);
```

In M/M/1 at ρ=0.8, 20 % of customers are served immediately. Dropping them makes every
percentile *conditional on having waited*:

| | reported (uncapped) | true customer experience |
|---|---|---|
| p50 | 3.43 s | 2.35 s |
| p90 | ~11.5 s | 10.40 s |
| p99 | 23.6 s | 21.90 s |

The median wait is overstated by **46 %**, and the error grows as the system gets *less*
congested (at ρ=0.5, half the mass is at zero). The same filter on `cycleTimes` is
harmless in practice but equally unprincipled.

**Fix:** drop the `> 0` filters; use `Number.isFinite` to guard instead.

---

### F-11 — Entity attributes are lost across the queue→resource hand-off — **low**

`do_resource_service` recurses without forwarding `entity_attrs`
([codeGenerator.ts:218](../src/lib/simulation/codeGenerator.ts#L218)), so downstream nodes
see the default `{priority: 3, entityClass: "standard"}`. Priority routing, FilterStore
predicates and PriorityStore ordering downstream of any Queue node operate on reset
attributes.

---

### F-12 — Fabricated KPI values in `computeDomainMetrics` — **medium (trust)**

Several "metrics" are not computed from the simulation:

- `sla_compliance` returns the literal string `"95%+"` when p90 ≤ 5 s, else
  `100 − (p90/5)×20` — an arbitrary formula, not a fraction of entities meeting SLA
  ([analyticsEngine.ts:340-347](../src/lib/simulation/analyticsEngine.ts#L340-L347)).
- `oee = avgUtil × 92` — OEE is availability × performance × quality; none is measured.
- `jitter = stdDev × 0.45` — no basis; jitter is the mean absolute inter-arrival delay
  difference (RFC 3550), which the engine could compute from the log stream.
- The network cards label seconds-valued quantities as `ms`.

These are presented alongside genuinely derived numbers, with benchmark strings like
"Target: 90 %+". Recommend computing them properly or labelling them as illustrative.

---

### F-13 — Minor correctness notes

- **Utilisation is clamped**: `min(1.0, util)` in `snapshot_stats` masks accounting errors
  rather than surfacing them. Assert instead.
- **`calculateResourceOperationalStates`** derives `busySeconds = util × duration`, which
  for a c-server resource is per-server-average seconds, not server-seconds; `starvedSeconds`
  inherits the error. Multiply by capacity or rename.
- **Duplicate final timeline point**: `run_simulation` appends a final snapshot that can
  coincide with the last periodic tick, producing a `dt = 0` segment. Harmless for the
  integral, but it puts a duplicate x-value into the AreaChart.
- **Float accumulation is not a problem**: 100 accumulated `env.timeout(360)` steps land on
  exactly 36000.0 (verified). Fractional tick intervals would introduce drift, so if F-6 is
  fixed, prefer absolute scheduling (`yield env.timeout(next_t - env.now)`).
- **`container` branch**: the `if con.level + fill_rate <= con.capacity` check and its
  `else` do the same thing; the branch is dead.
- **Zero duration** raises `ValueError: until (0) must be greater than the current
  simulation time` from SimPy. The UI clamps to ≥ 1 s, so it is unreachable today, but the
  template should guard it for API callers.
- **Memory**: `all_logs` at 20 000 entries × ~120 B ≈ 2.4 MB in Python, plus a full JSON
  copy for the postMessage, plus the JS-side `EntityJourney[]` (~28 k objects with nested
  step arrays on long runs). The cap protects Python; nothing caps
  `reconstructEntityJourneys` output, which is retained in React state alongside
  `topSlowestEntities`.

---

## Statistical confidence: are 100 ticks enough?

Two separate questions are conflated in the brief. They have different answers.

### For the AreaChart / WIP integral — no, 100 ticks is not enough.

Tick count sweep, M/M/1 ρ=0.8, T=36 000 s, same 5 seeds at every resolution, true L = 4.0:

| ticks | mean L̂ | sd across seeds | rel. sd | bias vs L=4.0 |
|---|---|---|---|---|
| 100 | 3.686 | 0.415 | **11.3 %** | −7.9 % |
| 400 | 3.846 | 0.229 | 5.9 % | −3.9 % |
| 1 000 | 3.980 | 0.222 | 5.6 % | −0.5 % |
| 7 200 | 3.992 | 0.202 | 5.1 % | −0.2 % |
| 36 000 | 3.987 | 0.197 | 4.9 % | −0.3 % |

At 100 samples the estimator carries ~11 % run-to-run error and a ~8 % downward bias: WIP is
a jump process with a heavy right tail, and 100 instantaneous probes systematically miss the
spikes. The irreducible floor is ~4.9 % — that is genuine Monte Carlo variance of a 10-hour
M/M/1 path and can only be reduced with replications or a longer horizon.

**Conclusion: 1 000 ticks buys essentially all of the available accuracy** (bias −0.5 %,
sd within 0.7 pp of the floor) at 10× the tick volume. 100 ticks is adequate as a *visual*
sparkline and inadequate as the input to `calculateLittlesLaw`. Recommended: emit ~1 000
ticks for the integral and downsample to ~150 points for the chart (the chart cannot resolve
more than that at typical widths anyway).

Note the tick count also *causes* a bias floor independent of F-2 — so fixing the
double-count alone will not make Little's Law converge at 100 ticks.

### For percentiles — ticks are irrelevant; sample count and the log cap are what matter.

Percentiles are computed from `EntityJourney` records, not ticks. The binding constraints are
F-9 (prefix truncation → p99 biased −15.5 %) and F-1 (5 synthetic points when a Queue node is
present).

With those fixed, precision is governed by the sample count. For the p-th quantile of n iid
samples the estimator's standard error is √(p(1−p)/n)/f(x_p); for the exponential tail of an
M/M/1 wait distribution with mean 5 s this gives, at n = 23 000:

| quantile | approx. rel. SE |
|---|---|
| p50 | ±0.9 % |
| p90 | ±2.0 % |
| p95 | ±2.9 % |
| p99 | ±6.6 % |

Empirically, the uncapped engine reproduced p50/p95/p99 to within 1.1 % / 2.5 % / 2.4 % of
theory — consistent with those bounds. So **p50–p95 are trustworthy at a few thousand
samples; p99 needs ~20 000+ completed entities** to be quoted to better than ±5 %, and the
UI should either surface the sample count or suppress p99 below ~2 000 samples.

The `calculatePercentiles` implementation itself is correct Hyndman & Fan Type 7 and matches
NumPy's `linear` method. One caveat: `stdDev` uses the **population** divisor (`/n`), not the
sample divisor (`/(n−1)`) — negligible at these sizes, but inconsistent with the "sample
statistics" framing.

---

## Recommended priority

| | Finding | Impact |
|---|---|---|
| 1 | F-5 blocking-after-service | Silently wrong throughput on every multi-stage model |
| 2 | F-2 WIP double-count | Little's Law and stability verdict wrong on every queued model |
| 3 | F-1 synthetic percentiles | All tail-latency KPIs fabricated on every queued model |
| 4 | F-9 log-cap truncation bias | p99 understated ~15 % on long runs |
| 5 | F-8 recurring-schedule hang | Unrecoverable browser freeze |
| 6 | F-4 multi-sink undercount | Halves reported output on branching graphs |
| 7 | F-3 source stats, F-7 zero rate, F-10 zero-wait filter, F-6 tick interval | Visible wrongness, cheap fixes |
| 8 | F-11, F-12, F-13 | Correctness debt / trust |

A regression gate worth adding: `python verification/verify_engine.py --quick` in CI,
failing the build on any scorecard regression. It runs in ~11 s.


---

## Benchmark 6 — complex multi-stage graph (added after the initial audit)

`complex_scenario.py` runs a branching hospital-triage graph — Source to a reneging
Triage queue, a 2-server Triage desk, a 70/30 Decision, then Minor (c=3) and Major (c=1)
stations into two separate Sinks. **Every station is stable in isolation**
(rho_triage = 0.72, rho_minor = 0.70, rho_major = 0.72), so any collapse is an engine
defect and not an overloaded model. Because a branching graph has no closed form, the
suite checks conservation laws and routing invariants instead.

Result: **12 of 22 invariants hold.** Routing fidelity (70.3 / 29.7 against 70 / 30) and
per-node flow balance are correct. Everything else fails, and the failures compound.

### F-14 — Blocking collapses throughput to 45 % while the utilisation KPI reads 33 % — **critical, highest priority**

With no reneging, over 7 200 s:

| | value |
|---|---|
| arrived | 8 728 |
| served | 3 956 |
| **clearance** | **0.453, 0.454, 0.463** across 3 seeds |
| entities stuck in flight at T | 4 772 |
| rho reported — triage / minor / major | **0.335 / 0.319 / 0.326** |
| rho analytic | 0.72 / 0.70 / 0.72 |
| health score | **61** |

This is F-5 at full scale. Triage servers are held for each entity's *entire* remaining
journey, so the station's real service time is the whole sojourn and its effective
capacity drops to ~0.55/s against an offered 1.2/s. The graph is saturated and shedding
55 % of demand.

The dangerous part is the KPI. `busy_seconds` only accumulates around
`env.timeout(svc_time)` ([codeGenerator.ts:198-207](../src/lib/simulation/codeGenerator.ts#L198-L207)),
so blocked-but-seized time is invisible: the product tells the user their desks are
**33 % busy with plenty of headroom** while more than half the patients never get served.

It also corrupts the health score in the wrong direction. `calculateSystemHealthScore`
awards the full 30 utilisation points for any `maxUtil <= 0.88`
([analyticsEngine.ts:—](../src/lib/simulation/analyticsEngine.ts)), so the under-reported
utilisation *earns* full marks. A system in total collapse scores 61/100 — "Moderate Line
Forming During Busy Moments" — when it should be near the floor. **The utilisation bug
actively rewards the throughput bug.**

Any fix to F-5 must be paired with counting seized-but-blocked time as busy, or the KPI
will keep hiding whatever remains.

### F-15 — With reneging on, wait-time percentiles describe *only* the customers who gave up — **critical**

Turning patience on does not fix the collapse, it disguises it: 4 537 of 8 500 patients
(53 %) renege, and "served / (arrived − reneged)" then reads **0.998**. The product would
report near-perfect service while losing over half its customers.

Worse, reneging is what makes `waitTimes` non-empty at all. The `reneged` handler is the
only path that closes a queue step and records a real `waitTime`
([analyticsEngine.ts:141-152](../src/lib/simulation/analyticsEngine.ts#L141-L152)); served
entities still hit the F-1 `nodeId` mismatch and record zero. Measured directly:

```
journeys total 3454   with waitTime > 0: 1835
status mix of the nonzero-wait samples: {'reneged': 1835}
served entities with waitTime > 0:  0 of 1607
reported wait  p50=6.31  p95=17.89  mean=7.48
```

**Every single wait sample comes from an abandoner; zero of 1 607 served customers
contribute.** So the escaping-the-F-1-fallback case is worse than the fallback: instead of
five obviously synthetic points, the UI shows confident-looking percentiles drawn entirely
from a maximally biased sub-population. Fixing F-1 fixes this too — they are the same
`stepsMap` keying defect.

### F-16 — A finite Container deadlocks permanently once full — **high**

The `container` branch has a dead conditional: the `if con.level + fill_rate <= con.capacity`
guard and its `else` both execute the identical `yield con.put(fill_rate)`
([codeGenerator.ts:—](../src/lib/simulation/codeGenerator.ts)). The comment shows a drop
was intended. Since nothing in the template ever calls `con.get()`, a Container only ever
fills, and every entity arriving after it tops out blocks in `put()` forever.

Measured — capacity 50, lambda 2/s, 600 s:

```
arrived=1209  totalCompleted=50
tank: in=1209 out=50 depth=1159 level=50
-> 1159 entities permanently blocked in con.put()
```

96 % of entities vanish into a permanent block. The run still terminates (SimPy just stops
at `until`), so there is no hang — but the results are silently meaningless.

### F-17 — Multi-sink undercount confirmed at scale

F-4 in the wild: sinkA = 2 749, sinkB = 1 206, actual output 3 955, `totalCompleted`
reported **2 749** — 30 % of the graph's output invisible, and it propagates into
throughput, completion rate, Little's Law and the executive summary.

### What Benchmark 6 changes about priority

The single-station benchmarks made F-5 look like a multi-stage edge case. It is not: on a
realistic branching graph it is a **55 % throughput loss reported as 33 % utilisation and
a health score of 61**. F-5 + F-14 together are the whole ballgame; everything else is
secondary.


---

# Part II — Fixes applied

All engine and analytics fixes below are in the working tree. Both suites now pass and
`npx tsc --noEmit` is clean.

| Suite | Before | After |
|---|---|---|
| `verify_engine.py` (5 benchmarks, 5 reps, 10 h horizon) | 21 / 29 | **28 / 28** |
| `complex_scenario.py` (Benchmark 6 invariants) | 12 / 22 | **22 / 22** |

## Benchmark 6, before and after

| | before | after | theory |
|---|---|---|---|
| clearance (served / offered) | 0.453, 0.454, 0.463 | **0.999, 0.999, 1.000** | 1.000 |
| rho triage / minor / major | 0.335 / 0.319 / 0.326 | **0.708 / 0.682 / 0.726** | 0.72 / 0.70 / 0.72 |
| entities stuck in flight at T | 4 772 | **10** | ~0 |
| `totalCompleted` vs actual | 2 749 of 3 955 | **8 531 of 8 531** | — |
| Little's Law discrepancy | 78.7 % | **0.2 %** | 0 % |
| verdict | `accumulating_backlog` (false alarm) | **`steady_state`** | stable |
| health score | 61 | **93** | — |
| reneges (patience on) | 4 537 of 8 500 (53 %) | **374 of 8 683 (4 %)** | — |
| percentiles | synthetic / abandoners only | **real, all entities** | — |

## Changes

**`codeGenerator.ts`**

- **F-5** `do_resource_service` no longer routes downstream. It `return`s the next hop and
  the caller spawns it *after* leaving the `with res.request()` block, so a server is
  released as soon as its own service ends. Both call sites (queue-fed and direct) updated.
  This is the fix behind the throughput and utilisation columns above.
- **F-2** The queue branch no longer increments the resource's `currentDepth` while an
  entity waits; the resource is credited at service start instead. WIP conservation now
  holds exactly (`sum(depth) == arrived - completed`).
- **F-1 / F-15** The queue branch emits a `queued` event against the *resource* node at
  queue-entry time, so `reconstructEntityJourneys` can close the step. Wait times are now
  recorded for served entities, not only for abandoners.
- **F-3** `spawn_entity` maintains the source node's own counters.
- **F-4** `stats_total_completed` sums every sink instead of returning the first.
- **F-7** `arrivalRate <= 0` now disables the source instead of defaulting to 1/sec.
- **F-8** A recurring schedule whose period is zero terminates instead of spinning forever.
- **F-9** The 20 000-entry log prefix is replaced by an entity-level **reservoir sample**
  (Algorithm R, `LOG_ENTITY_CAP = 4000`), using a dedicated RNG so logging never perturbs
  the simulation stream. Whole entities are sampled because a journey needs all of its
  events to be reconstructable.
- **F-11** Entity attributes are carried across the queue-to-resource hand-off.
- **F-16** A Container that would overflow drops the entity and records it, instead of
  blocking in `put()` forever. Verified: 1 159 entities that previously vanished are now
  reported as `droppedCount`, `currentDepth` returns to 0.

**`analyticsEngine.ts`**

- **F-10** Zero-wait entities are no longer filtered out of the percentile samples.
- **F-18 (new)** `calculateLittlesLaw` no longer infers stability from the L vs λW
  discrepancy. **L = λW is a theorem — it holds in overloaded systems too.** Measured on an
  unstable queue (λ=2, μ=1): both sides came out at 268.5 with a **0.0 %** discrepancy. The
  old check only ever fired because WIP was double-counted upstream; it was detecting its
  own arithmetic error, not the system's state. Fixing F-2 removed that accidental signal
  and silently turned the stability detector off — which is exactly what Benchmark 3 caught.
  Stability is now derived from the two signals that actually carry it: whether departures
  keep up with arrivals (`served fraction < 0.95`) and whether WIP trends upward across the
  run. `discrepancyPercent` is retained as an estimator-agreement / data-quality signal and
  now maps to the `transient` verdict.
- `calculateSystemHealthScore` penalises `!isStable` rather than the discrepancy. The
  overloaded benchmark now scores 45.8 (was 52.8); the healthy complex graph scores 93.

**`page.tsx`**

- **F-6** `tickInterval` is `max(0.05, T / 1000)` instead of `max(1, round(T / 100))`.

## Verified effects

Percentile bias from F-9 + F-10, M/M/1 ρ=0.8, 10 h, 3 seeds — theory is the *unconditional*
M/M/1 waiting-time distribution:

| | n | p50 | p95 | p99 |
|---|---|---|---|---|
| before (prefix cap + zero-wait filter) | 3 149 | 3.280 | 13.415 | 19.457 |
| after (reservoir, 4 000 entities) | 4 000 | **2.288** | **14.210** | **21.904** |
| after (no cap, all 28 754) | 28 754 | 2.300 | 14.120 | 22.452 |
| theory | — | 2.350 | 13.863 | 21.907 |

The 4 000-entity reservoir now tracks the full-population result, and the −15.5 % p99
understatement is gone.

## Not changed

- **F-12** fabricated KPIs (`"95%+"`, `oee = util × 92`, `jitter = stdDev × 0.45`, seconds
  labelled `ms`). These need product decisions about what each card should mean, not a
  mechanical fix.
- **F-13** minor notes: the `min(1.0, util)` clamp, `calculateResourceOperationalStates`
  per-server vs server-seconds, the duplicate final timeline point, the zero-duration
  `ValueError` (unreachable from the UI, which clamps to ≥ 1 s).
- The **`justCmul8/`** tree has its own modified `codeGenerator.ts` and was left untouched.

## Follow-up worth considering

`tickInterval` now emits ~1 000 ticks per run instead of ~100. That is what makes the WIP
integral accurate, but it is also 10× the `postMessage` traffic and 10× the React state
updates during a live run. If that shows up as jank, decouple the two: keep integrating at
1 000 samples inside Python and downsample the *chart* series to ~150 points before
emitting, rather than coarsening the tick rate again.
