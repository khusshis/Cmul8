# Benchmark 6 -- Complex Multi-Stage Graph

- Horizon 7200s, lambda=1.2/s, 3 seeds
- Every station is stable in isolation (rho_triage=0.72, rho_minor=0.70, rho_major=0.72)

| Invariant | Expected | Observed | Result | Detail |
|---|---|---|---|---|
| I4 totalCompleted == all sinks [patience on] | 8301 | 8301 | PASS | sinkA=5819 sinkB=2482 |
| I1 conservation residual >= 0 [patience on] | >= 0 | 8 | PASS | arrived=8683 done=8301 reneged=374 dropped=0 |
| I1 residual < 5% of arrivals [patience on] | < 434 | 8 | PASS | large residual = stuck entities |
| I3 decision split == 0.70 [patience on] | 0.700 | 0.700 | PASS | n=8308 |
| I5 throughput clears offered load [patience on] | >= 0.95 | 0.999 | PASS | 8301 of 8309 served |
| I6 rho[triage] ~ 0.72 [patience on] | 0.72 | 0.705 | PASS |  |
| I6 rho[minor] ~ 0.70 [patience on] | 0.70 | 0.690 | PASS |  |
| I6 rho[major] ~ 0.72 [patience on] | 0.72 | 0.697 | PASS |  |
| I2 flow balance [dec] [patience on] | in=8308 | out+depth=8308 | PASS |  |
| I2 flow balance [sinkA] [patience on] | in=5819 | out+depth=5819 | PASS |  |
| I2 flow balance [sinkB] [patience on] | in=2482 | out+depth=2482 | PASS |  |
| I4 totalCompleted == all sinks [patience off] | 8531 | 8531 | PASS | sinkA=5861 sinkB=2670 |
| I1 conservation residual >= 0 [patience off] | >= 0 | 10 | PASS | arrived=8541 done=8531 reneged=0 dropped=0 |
| I1 residual < 5% of arrivals [patience off] | < 427 | 10 | PASS | large residual = stuck entities |
| I3 decision split == 0.70 [patience off] | 0.700 | 0.687 | PASS | n=8540 |
| I5 throughput clears offered load [patience off] | >= 0.95 | 0.999 | PASS | 8531 of 8541 served |
| I6 rho[triage] ~ 0.72 [patience off] | 0.72 | 0.708 | PASS |  |
| I6 rho[minor] ~ 0.70 [patience off] | 0.70 | 0.682 | PASS |  |
| I6 rho[major] ~ 0.72 [patience off] | 0.72 | 0.726 | PASS |  |
| I2 flow balance [dec] [patience off] | in=8540 | out+depth=8540 | PASS |  |
| I2 flow balance [sinkA] [patience off] | in=5861 | out+depth=5861 | PASS |  |
| I2 flow balance [sinkB] [patience off] | in=2670 | out+depth=2670 | PASS |  |

**22 / 22 invariants hold.**

## Run summaries

### [patience on]
- arrived=8683 served=8301 reneged=374 stuck-residual=8
- clearance across 3 seeds: 0.956, 0.958, 0.954
- Little's Law: L=7.63 lambdaW=7.88 disc=3.2% verdict=steady_state
- health score=91  percentiles synthetic=False

### [patience off]
- arrived=8541 served=8531 reneged=0 stuck-residual=10
- clearance across 3 seeds: 0.999, 0.999, 1.000
- Little's Law: L=8.56 lambdaW=8.58 disc=0.2% verdict=steady_state
- health score=93  percentiles synthetic=False

## Exotic node-type smoke test

- completed without error: arrived=1225 totalCompleted=2450
  - `bc` (broadcaster): in=1225 out=1225 depth=0 dropped=0 level=None
  - `ch` (channel): in=1225 out=1225 depth=0 dropped=0 level=None
  - `st` (store): in=1225 out=1225 depth=0 dropped=0 level=None
  - `cont` (container): in=1225 out=1225 depth=0 dropped=0 level=1225
  - `sink1` (sink): in=1225 out=1225 depth=0 dropped=0 level=None
  - `sink2` (sink): in=1225 out=1225 depth=0 dropped=0 level=None
