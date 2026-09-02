# Glossary — Technical Term → Plain-Language UI Term

## Why this file exists
JustCmul8's simulation engine is built on real Discrete Event Simulation (DES) theory
(SimPy, queuing theory terms like "resource," "preemption," "discipline"). These words
are correct and necessary in the **code** — changing them there would break compatibility
with SimPy's own vocabulary and confuse anyone reading the source later.

But a non-technical user (a student, teacher, or small business owner — see synopsis
Section 8, "Target Users") should never have to learn what a "preemptive priority
resource" is just to model a coffee shop. So:

- **Code, database columns, SimPy generation** → keep the technical term (correctness,
  matches the underlying science).
- **Anything rendered in the browser** (labels, buttons, tooltips, docs shown to the
  user) → use the UI Term below.

Every component must import labels from `src/lib/simulation/simTypeRegistry.ts`
(`PaletteNode.label`, `desc`) rather than hardcoding technical names — that registry is
where this glossary is actually enforced in code.

---

## Node types (the building blocks of a simulation)

| Technical term (code / SimPy) | UI Term (what the user sees) | Plain-language description shown to user |
|---|---|---|
| `source` | **Start Point** | "Where new customers, items, or requests enter the system" |
| `queue` | **Waiting Line** | "A line where things wait their turn" |
| `resource` | **Limited Counter** | "A worker or machine that serves one thing at a time" |
| `service` | **Counter** | "A step that takes a fixed or random amount of time" |
| `decision` | **Decision Block** | "Sends each item down one of several paths, by chance" |
| `sink` | **Exit Point** | "Where things leave the system — results are counted here" |
| `container` | **Storage Tank** | "Holds a continuous amount of something (like liquid or stock)" |
| `store` | **Storage Rack** | "Holds a limited number of items until they're needed" |
| `event_trigger` | **Event Trigger** | "Waits for a condition to become true, then fires an event" |
| `priority_resource` | **Priority Counter** | "Like Staff/Machine, but urgent items go first" |
| `channel` | **Transport Channel** | "Carries a signal or message with a travel delay" |
| `broadcaster` | **Broadcaster** | "Copies one message out to every connected path at once" |
| `any_of` | **Any-One Gate** | "Continues as soon as ONE of several things happens" |
| `all_of` | **Wait-for-All Gate** | "Continues only once ALL of several things have happened" |
| `interrupter` | **Breakdown Block** | "Stops another step partway through, on purpose" |

> Synopsis note: the synopsis (Section 5, Module 3) states "13 node types." The actual
> registry defines 15 (table above). We are keeping all 15 for 100% functional parity
> with the original engine — flagged to the project owners; the synopsis wording can be
> corrected to "15" in the final report if desired.

## Simulation domains (the 6 "skins")

| Technical term | UI Term |
|---|---|
| `human_queue` | **People & Service Lines** (e.g. banks, clinics, shops) |
| `vehicle` | **Traffic & Vehicles** |
| `liquid` | **Liquid & Material Flow** |
| `manufacturing` | **Manufacturing Line** |
| `logistics` | **Warehouse & Logistics** |
| `network_signal` | **Network & Signals** |

## Distributions (randomness models)

| Technical term | UI Term | Plain description |
|---|---|---|
| `exponential` | **Random (typical spacing)** | "Most common — random gaps, like customers arriving unpredictably" |
| `normal` | **Random (around an average)** | "Values cluster around a typical value" |
| `uniform` | **Random (equally likely range)** | "Any value in a range is equally likely" |
| `constant` | **Fixed (always the same)** | "No randomness — always takes the same amount of time" |

## Other recurring terms

| Technical term | UI Term |
|---|---|
| Discipline: FIFO | **Serve in arrival order (first come, first served)** |
| Discipline: LIFO | **Serve most recent first** |
| Discipline: PRIORITY | **Serve most urgent first** |
| Utilization | **Busy %** (how much of the time a resource was in use) |
| Throughput | **Completed per hour** |
| Bottleneck | **Slowest Step** |
| RLS (Row-Level Security) | *(not user-facing — backend data-privacy rule)* |
| Preemptive resource | **Can interrupt lower-priority work** |

---

*This file is updated whenever a new node type, distribution, or user-facing concept
is introduced. Last updated: Module 0 (project scaffold).*
