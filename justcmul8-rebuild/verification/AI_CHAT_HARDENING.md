# AI Assistant Hardening — what was broken and what now protects it

The reported symptom was the chat replying *"I couldn't process that request right now.
Please verify your Gemini API key in `.env.local`"*. **The API key was valid the whole
time.** That message was a catch-all that blamed the most plausible-sounding cause.

## Root cause

Both hard-coded models had been retired by Google. Probed against this project's key:

| model | role in old code | result |
|---|---|---|
| `gemini-2.5-flash` | primary | **HTTP 404** — "no longer available to new users" |
| `gemini-2.0-flash` | fallback | **HTTP 404** — "no longer available" |

The fallback could never succeed, so every request failed. Note the model *list* endpoint
still advertises `gemini-2.5-flash` — only an actual generation call reveals it is gone, so
"pick a model from the list" is not a safe strategy.

The same probe surfaced every other failure class a production chat must survive:

| model | result |
|---|---|
| `gemini-3.6-flash`, `3.5-flash`, `3.5-flash-lite`, `3.1-flash-lite` | 200 OK |
| `gemini-3.1-pro-preview` | 429 quota exhausted |
| `gemini-3.7-flash`, `3.8-flash` | 503 overloaded |

## Defects found beyond the dead models

| # | Defect | Consequence |
|---|---|---|
| 1 | Every AI action replaced the **entire** canvas, including `UPDATE_NODES` | A model replying to "raise capacity to 3" with only that node **wiped the user's whole model**, no undo |
| 2 | Unknown `nodeType` silently became `resource` | Built a model the user never asked for |
| 3 | Edges to non-existent nodes passed through | Broken graph reached the simulation engine |
| 4 | Decision `routes` never validated | Probabilities not summing to 1; routes with no matching edge |
| 5 | `/api/ai/chat` and `/api/ai/generate` had **no authentication** | Anyone with the URL could spend the paid Gemini quota |
| 6 | Whole enriched `simResult` sent with every message | Multi-MB uploads per chat turn (logs + entity journeys) |
| 7 | No request timeout on the client | A hung request left the UI spinning indefinitely |
| 8 | Canvas read from a stale closure | An AI edit could apply against a canvas the user had since changed |
| 9 | `res.ok === false` discarded the server's actual reason | Real cause replaced by the API-key guess |
| 10 | Every edit re-ran Dagre over the whole canvas | Destroyed hand-placed layout for a one-parameter change |

## Two failures found only by testing against the live API

**A hung attempt ran for 39 minutes.** The SDK does implement its `timeout` option, but the
timer did not fire (the host appears to have suspended mid-request). A single hung attempt
holds a serverless invocation and the user's chat open, so the router now drives its own
`AbortController` and races a wall-clock timer. Verified: a 2 000 ms budget now aborts at
2 013 ms and falls through to the next model (4 023 ms total instead of 39 minutes).

**Gemini 3 flash intermittently emits invalid JSON.** It writes LaTeX in the reply and
usually escapes it (`\\rho`), but occasionally emits a bare backslash:

```
"...mean service time of 1.5s ($\ mu = 0.667$/s, giving $\\rho = 0.75$)"
                                 ^^ single backslash + space — invalid JSON escape
```

`finishReason` was `STOP` and the JSON looked complete; only the escape was wrong. Two
fixes: `extractJSON` repairs stray escapes (only after a strict parse has already failed, so
valid output is never touched), and the system prompt now forbids LaTeX outright — **the chat
renders Markdown, not math, so `$\rho = 0.75$` was displaying as raw characters to users
anyway.**

## What was built

- **`src/lib/ai/modelRouter.ts`** (server only) — ordered model chain with per-failure-class
  handling: 404 retired → skip 6 h; 400 rejected → skip 60 s (may be this request's fault,
  so it must never earn the long TTL); 429 → cooldown honouring Google's `retryDelay`;
  5xx/timeout/network → brief cooldown, next model; bad key or safety block → stop
  immediately, because no other model can help. Per-attempt and overall deadlines. Override
  the chain with `GEMINI_MODEL` / `GEMINI_FALLBACK_MODELS` — no code change needed next time
  Google retires one.
- **`src/lib/ai/graphOps.ts`** (shared, pure) — validates and applies AI edits as a **merge**
  against the live canvas. Blocks the model doesn't mention are never deleted. Unknown block
  types are skipped rather than coerced, params are range-clamped, dangling edges and
  self-loops are dropped, and decision routing is rescaled to 1.0 — scoped to the blocks the
  edit actually touched, so a user's own routing is left alone. Every repair produces a
  warning shown under the reply.
- **`src/lib/ai/systemPrompt.ts`** — the megaprompt's role, physics and 15 primitives, with
  every engine claim verified against `codeGenerator.ts`, plus an operation-based response
  contract (`addNodes` / `updateNodes` / `deleteNodeIds`) so partial replies are structurally
  incapable of wiping the canvas.
- **Routes** — authentication, input validation, a best-effort per-user rate limit (20/min),
  summary-only telemetry, tolerant JSON parsing, and specific typed errors (`QUOTA`,
  `TIMEOUT`, `MODELS_UNAVAILABLE`, `SAFETY`, `UNAUTHENTICATED`…) each with a message that
  says what actually happened.
- **`AIChatPanel.tsx`** — behaviour only, no visual change: 110 s timeout with abort on
  unmount, slim payload, live-canvas refs, the server's real error surfaced in the existing
  bubble, layout preserved unless a rebuild genuinely needs it.

## Corrections to the megaprompt

The megaprompt asserted things this engine does not do. The prompt now states the truth,
because advice is only useful if the simulation behaves as described:

- **Queue `discipline` is ignored** — every queue is FIFO. `LIFO` and `PRIORITY` are accepted
  and have no effect.
- **`priority_resource` never passes a priority to `request()`**, and there is no
  `PreemptiveResource`. It behaves exactly like a plain `resource`; `isPreemptive` does
  nothing. The prompt now offers the dedicated-lane workaround (a `decision` routing the
  priority share to its own queue and resource) instead of recommending a priority lane the
  engine would silently ignore. **Your "VIP fast-track priority lane" starter prompt depends
  on this.** Verified in testing: the model now explains the limitation and builds a split.
- Domain ids corrected to the real `SimTypeId`s (`vehicle`, `liquid`, `network_signal`).
- All rates and times are **seconds**; the prompt requires stating the conversion. Verified:
  "90 per hour" → `arrivalRate: 0.025`.

## Verification

```
35/35  graph-operation tests (canvas-wipe, invalid output, routing, deletes, JSON parsing)
 9/9   escape-repair tests, including the real captured payload that broke the chat
 5/5   end-to-end cases against the live Gemini API
28/28  verify_engine.py --quick        (simulation suites unaffected)
22/22  complex_scenario.py
       npx tsc --noEmit                clean
       unauthenticated POST            401 on both AI routes
```

End-to-end cases, all passing: the exact prompt from the bug report (correctly returns
analysis with no canvas edit, rho maths right: 1/1.5 = 0.667/s), an incremental parameter
change (canvas stays 6 blocks), adding a station between two others, unit conversion, and the
priority-lane limitation.

One case is worth noting as the safety net working: the model emitted an edge to a `q_vip`
block it never created. Validation dropped the edge and warned, rather than passing a broken
graph to the engine.

## Known limits

- The rate limit and model-health cache are per server instance; serverless deployments do
  not share them. They bound abuse per instance rather than enforcing a global limit.
- `npx eslint` reports `no-explicit-any` in the new modules. Lint already fails repo-wide
  (314 problems before this work, including in untouched files); the new code matches the
  surrounding style. Tightening types is a separate, repo-wide decision.
- The `justCmul8/` tree has its own copy of these routes and was not touched.


---

## Addendum — megaprompt sections 4-6 reconciled

The original paste was truncated mid-section 3. With sections 4-6 supplied, the following
were added or corrected.

### Implemented

- **Section 4 (chain-of-thought).** Added as an explicit three-step internal procedure
  (perceive state, do the arithmetic, choose the smallest sufficient action), with the
  instruction not to narrate the steps. Includes propagating lambda through decision splits
  (a 30% branch receives 0.3 x lambda) and naming the binding constraint: too few servers,
  service too slow, a capacity cap dropping entities, patience causing reneges, or
  downstream backpressure.
- **`EXPLAIN_OR_DIAGNOSE`.** Section 4 lists it as an action but section 5's `actionType`
  enum omits it, so a model may well emit it. `coerceActionType()` maps it (and `EXPLAIN`,
  `DIAGNOSE`, `ANALYZE`, and any unrecognised value) to `NONE`, which is the only safe
  default because it changes nothing. Verified an alias cannot edit the canvas even when a
  graph is attached to the reply.
- **Section 5 `simulationInsights`.** Now part of the contract, validated server-side:
  `bottleneckRisk` is constrained to Low / Moderate / Critical, and the free-text fields are
  length-capped, so whatever the UI eventually renders cannot be arbitrary model output. The
  prompt derives risk from the highest station rho (Low < 0.70, Moderate 0.70-0.85, Critical
  > 0.85, always Critical at rho >= 1). It is stored on the chat message but **not rendered** —
  displaying it is a UI decision.
- **Section 3 `position`.** Accepted as a hint: honoured for newly added blocks, ignored when
  malformed, and overridden by Dagre on a full rebuild. Verified all three.
- **Section 6 "zero broken graphs".** `connectivityWarnings()` flags a rebuild with no
  source, no sink, or blocks unreachable from a source (naming them). Reported as warnings
  under the reply rather than enforced, because a half-built model the user can see and fix
  beats silently discarding their request.
- **Section 6 realistic parameters.** Grounded per-domain ranges in seconds (coffee order
  15-45 s, bank teller 120-240 s, doctor 300-900 s, toll booth 5-15 s, QA 20-90 s, packet
  propagation 0.001-0.05 s). Verified: "build a coffee shop from scratch" produced a cashier
  at 30 s and two baristas at 60 s against 0.025 arrivals/s — both stations at 75%.
- **Section 6 idempotence.** The prompt now states explicitly: keep the user's ids and
  labels, change only the params asked for, never renumber or rename to tidy up.
- **Advice vs. action.** "Suggest", "recommend", "what if", "should I" and "identify" are
  advice requests and must return `NONE`. This was added after the live run showed the model
  *applying* a stress-test arrival rate when the user had only asked it to suggest one.

### Corrected against the engine

Section 3's schemas describe behaviour the engine does not have. Already documented above for
`discipline` and `priority_resource`; sections 4-6 added two more:

- **`event_trigger.eventName` is never read.** The engine keys signals by block id, and each
  signal fires **once per run**. The prompt now says `eventName` is a display label only.
- **`container` needs `fillRate`** (units added per entity, default 1), which the
  megaprompt's schema omits, and nothing ever drains a container — so it must be sized for
  the whole run or it will start dropping.

### Not implemented: LaTeX

The megaprompt is written in LaTeX and its example output uses `$ho$` and `$\lambda$`.
**The chat panel renders Markdown, not math**, so that displays to users as literal
`$ho = 0.75$`. Instructing the model to avoid it worked only partially: it stopped
emitting backslashes (which had been breaking JSON parsing outright) but kept emitting
`$...$` with Unicode Greek letters:

```
"**Arrival Rate ($λ$):** 0.5 customers/sec ... $ρ$ = $0.5 / (2 × 0.333) = 0.75$"
```

Prompting is not a reliable filter, so `src/lib/ai/textFormat.ts` strips it deterministically
server-side: `$λ$` -> `lambda`, `$ho = rac{\lambda}{c \cdot \mu}$` ->
`rho = (lambda)/(c * mu)`. Currency is preserved — `"$5 per item and $1,200 per month"` is
untouched — by only unwrapping `$...$` whose content contains a Greek letter, a backslash or
a comparison operator. The pass is idempotent and single-line, so an unpaired `$` cannot
swallow the rest of a reply.

**Open question for the product:** render maths properly by adding KaTeX to the chat panel
(a UI change, so not made), or keep the plain-text conversion. Plain text currently reads
correctly for the non-technical audience the megaprompt targets.

### Verification after the addendum

```
35/35  graph-operation tests
14/14  section 4-6 tests (action aliases, position hints, connectivity warnings)
 9/9   JSON escape repair
15/15  LaTeX-to-Markdown conversion, including currency preservation
 3/3   end-to-end against the live API (NONE / UPDATE_NODES / REPLACE_GRAPH all correct)
28/28  verify_engine.py --quick        22/22  complex_scenario.py
       npx tsc --noEmit clean
```


---

## Addendum 2 — the three UI features

Approved and implemented in `AIChatPanel.tsx`, reusing the existing card, chip and button
tokens (`rounded-xl bg-white border-indigo-100/90 shadow-2xs`, the indigo gradient primary
button, the `text-[10px] font-black uppercase` badge). No existing styling was altered.

### Retry

Failed replies are now tagged `isError` with the prompt that failed, and render a "Try again"
chip underneath. Retry re-sends **without re-echoing the user's message** (it is already in
the thread) and removes the error bubble, so a retry loop cannot fill the thread with
duplicates. Error bubbles are excluded from the history sent to the model, as is the trailing
user message being retried, so the model never sees the same turn twice.

### Undo

Every AI edit now stores the canvas as it was *before* the change (`metadata.graphBefore`),
and the action card offers "Undo" beside "Apply / Re-Align Canvas". Undo goes through the same
validation path as any other graph write.

`snapshotForHistory()` now **keeps coordinates** (the prompt summary still omits them — they
are noise in the context window). Without that, undo would have re-run Dagre and rearranged a
layout the user had positioned by hand. `applyAIOps` only reports `needsFullLayout` when a
graph arrives without coordinates, so a fresh AI build is still auto-laid-out while a restore
keeps its geometry. The "Apply / Re-Align Canvas" button deliberately still re-runs Dagre —
that is what it is for.

Verified as a round-trip property — edit, then undo, then compare a fingerprint of every id,
type, label, param and coordinate plus every edge:

| scenario | result |
|---|---|
| parameter change | restores exactly, no re-layout |
| added station | block and its links removed, rest untouched |
| deleted block | block and its links come back |
| built from scratch | canvas returns to empty |

### Simulation insights

`metadata.simulationInsights` now renders as a card: throughput, a risk badge coloured by
level (Low emerald / Moderate amber / Critical rose) and the one-line recommendation. Values
are still validated server-side, so the badge can only ever be one of the three levels.

### Verification

```
35/35  graph-operation tests      14/14  section 4-6 tests
14/14  undo round-trip tests       9/9   JSON escape repair
15/15  LaTeX-to-Markdown           3/3   end-to-end against the live API
28/28  verify_engine --quick      22/22  complex_scenario
       npx tsc --noEmit clean      next build succeeds
```

### Not verified in a browser

The chat panel requires a signed-in session and a project, which I cannot create, so these
three features are verified by type-checking, a successful production build, and unit tests of
the logic behind them — not by clicking through the running app. Worth eyeballing: the Undo
button sitting beside Apply on an edit card, the insights card's risk badge colour, and the
"Try again" chip (force it by temporarily setting `GEMINI_MODEL=does-not-exist`).

### Observed quality caveat (not fixed)

In one live run the assistant built a model and reported *"rho = 1.13 because 2 cashiers
taking 45s each can only handle 160 customers/hour"* against 360 arrivals/hour. Its risk
grade (Critical) was right and its component figures were right, but 360/160 is 2.25, not
1.13 — the arithmetic in the prose was not self-consistent with itself. No validator can
catch that, because the number is free text.

The durable fix is to stop asking the model to do arithmetic: compute lambda, mu and rho per
station **server-side** by propagating source rates through the graph (honouring decision
splits and broadcaster fan-out) and hand those figures to the model as part of the workspace
snapshot. That is a contained change to the route and is worth doing, but it was outside this
request.


---

## Addendum 3 — the arithmetic issue, fixed

Addendum 2 recorded that the assistant's prose arithmetic was not reliably
self-consistent: one reply asserted *"rho = 1.13 because 2 cashiers taking 45s each
can only handle 160 customers/hour"* against 360 arrivals/hour. Its risk grade and
component figures were right, but 360/160 is **2.25**. Free text cannot be validated
after the fact, so the durable fix is to stop asking the model to calculate at all.

### `src/lib/ai/flowAnalysis.ts`

Computes the queueing figures deterministically from the canvas and hands them to the
model as facts, per station:

- `lambda` — arrivals/sec, propagated from every source through the graph
- `capacity`, `serviceTimeMean`, `mu`, `rho`, and `lambdaMax` (the rate at which that
  block reaches rho = 1)
- `bottleneck`, `unstable[]`, `headroomFactor`, `sustainableSourceRate` — the last is
  exactly the number a stress-test question asks for
- per-block notes where a non-queueing limit binds: a container that fills and then
  drops, a channel whose in-flight count exceeds its buffer, a queue that turns
  arrivals away or reneges

Routing mirrors the engine's `get_next_targets` exactly: a broadcaster (and a source
in broadcast mode) sends the **full** rate down every link because entities are
cloned; a decision splits by normalised route probabilities; everything else
round-robins, so N links each receive lambda/N. Rework loops are solved by fixed-point
iteration.

The system prompt now says to **quote** these figures and never recompute them, and to
say what it cannot determine when a figure is missing.

### The subtle bug this nearly shipped with

A loop returning exactly 100% of its flow grows by a *constant* each pass, not
exponentially, so it never trips a magnitude ceiling — it simply never settles. The
first implementation would have reported whatever value iteration 500 happened to
reach (about 500x the true rate) as a fact. Convergence, not magnitude, is now the
test: when the propagation does not settle, `converged` is false, every lambda and rho
is blanked with a note saying why, and the prompt instructs the model to name the loop
rather than invent numbers.

### Verification

`ai_flow_crossvalidate.py` (new, in this directory) runs each fixture graph through
both the TypeScript module and the real SimPy engine over a 40 000 s horizon with 3
seeds:

| graph / station | predicted rho | measured rho | delta |
|---|---|---|---|
| M/M/2 chain — Baristas | 0.7500 | 0.7469 | −0.41% |
| triage split — Triage Desk | 0.7200 | 0.7187 | −0.18% |
| triage split — Minor Care | 0.7000 | 0.6978 | −0.31% |
| triage split — Major Care | 0.7200 | 0.7140 | −0.83% |
| rework loop (10% back) — QA | 0.6667 | 0.6651 | −0.24% |
| round-robin split — Desk A / B | 0.8000 | 0.7955 / 0.7961 | −0.56% / −0.49% |

Every prediction matches the engine within 0.83%, and every graph predicted stable
cleared 99.97%+ of its load.

Against the live model, on the exact configuration it previously got wrong:

```
ground truth: Cashier rho = 2.25, headroom 0.444x
"Is this coffee shop able to keep up?"        -> "cannot keep up", rho 2.25, Critical
"What is the utilisation of the cashier?"     -> "225% (2.25)", overload at 0.0444/s
"Suggest a stress-test arrival rate"          -> rho 2.25, max sustainable 0.0444/s (160/hr)
```

It now states 2.25 rather than 1.13, quotes lambdaMax correctly, and grades Critical
every time.

**A note on that test.** Its first version flagged six failures that were the test's
fault, not the model's: it matched every number near the word "rho", including the
rho = 1 saturation threshold, target utilisations the model proposes, and the
0.8x/1.0x/1.2x stress multipliers the prompt itself asks for. The check now validates
the *first* rho stated — the current one, which is what was wrong before — plus any
percentage utilisation claim.

```
43/43  flow-analysis unit tests        11/11  engine cross-validation
35/35  graph-operation tests           14/14  section 4-6 tests
14/14  undo round-trip                  9/9   JSON escape repair
15/15  LaTeX-to-Markdown                3/3   live-model arithmetic consistency
28/28  verify_engine --quick           22/22  complex_scenario
       tsc clean, next build succeeds
```
