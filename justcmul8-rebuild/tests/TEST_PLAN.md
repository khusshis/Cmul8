# JustCmul8 — Test Plan ("miss nothing" contract)

Every page, route, lib function, user flow and collaboration feature, mapped to the test that covers it.
Status: ✅ covered · 🟡 covered, currently blocked (see reason) · ⬜ untestable (reason).

Runners: **Vitest** (`npm test`), **node:test** (`npm run test:node`), **Playwright** (`npm run test:e2e`).

## 1. Pages (src/app)

| Page | Covered by | Status |
|------|-----------|--------|
| `/` landing (hero, features, pricing, security, FAQ, nav) | e2e/landing.spec.ts | ✅ |
| `/login` (validation, wrong password, redirect param) | e2e/auth.spec.ts | ✅ |
| `/signup` (password length, success states) | e2e/auth.spec.ts | ✅ |
| `/forgot-password` (submit, neutral confirmation) | e2e/auth.spec.ts | ✅ |
| `/update-password` | — | ⬜ needs a live recovery session; form logic trivial |
| `/onboarding` (steps, invited path, plan) | middleware redirect in auth.spec; full flow via creds | 🟡 blocked (app build 500) |
| `/dashboard` (list, create/rename/delete, templates) | e2e/dashboard.spec.ts | 🟡 blocked (app build 500) |
| `/dashboard/project/[id]` workspace | e2e/workspace.spec.ts | 🟡 blocked (app build 500) |
| `/settings` (profile, billing, delete flow) | e2e/settings.spec.ts | 🟡 blocked (app build 500) |
| `/share/[token]` (read-only / unavailable) | e2e/sharing.spec.ts | 🟡 blocked (app build 500) |
| `/auth/callback` (code exchange, safe redirect) | e2e/security.spec.ts (off-site redirect) | 🟡 blocked |

## 2. API routes (src/app/api)

| Route | Cases | Covered by | Status |
|-------|-------|-----------|--------|
| `ai/chat` POST | 401, 400 empty/too-long, canvas cap, success+ops, prose, AIRouterError→status | unit/api/aiChat.test.ts | ✅ |
| `ai/generate` POST | 401, 400, graph build, 502 bad output | unit/api/aiGenerateOptimize.test.ts | ✅ |
| `ai/optimize` POST | 401, 400, recommendation sanitation | unit/api/aiGenerateOptimize.test.ts | ✅ |
| `billing` GET | — | (lazy-resync logic indirectly via server.test) | 🟡 getBilling pure part only |
| `billing/subscribe` POST | 401, 400 interval, 409 active, create | unit/api/billingRoutes.test.ts | ✅ |
| `billing/verify` POST | 401, 400 fields/signature, mock sync | unit/api/billingRoutes.test.ts | ✅ |
| `billing/webhook` POST | bad sig 400, valid sync, dedupe (SELECT), record-after-success, failure leaves no row, stale>24h, bad body | unit/api/billingRoutes.test.ts | ✅ |
| `billing/cancel` POST | 401, 400 no sub | unit/api/billingRoutes.test.ts | ✅ |
| `account/delete` POST | 401, 403 REAUTH_REQUIRED, success, 429 | unit/api/accountDelete.test.ts | ✅ |
| `projects/[id]/export` GET | 401, 404 non-UUID, 404 missing, JSON free, CSV Pro-gated | unit/api/projectRoutes.test.ts | ✅ |
| `projects/[id]/members` POST/PATCH/DELETE | 401, 403 non-owner, 400 email/role, self-invite, apostrophe-local-part | unit/api/projectRoutes.test.ts | ✅ |
| `projects/[id]/share` GET/PATCH/DELETE | 401, 404, viewer vs owner link, 403, 400, anyone→Pro | unit/api/projectRoutes.test.ts | ✅ |

## 3. Lib — simulation (src/lib/simulation)

| Module | Covered by | Status |
|--------|-----------|--------|
| distributions.ts | unit/sim/distributions.test.ts (means, bounds, dispatch) | ✅ (+1 bug via it.fails) |
| legacyWorker.ts (fallback engine) | unit/sim/legacyWorker.test.ts (M/M/1, M/M/c, decision, store/channel/broadcaster) | ✅ (+2 bugs via it.fails) |
| codeGenerator.ts | unit/sim/outputs.test.ts (placeholder fill) + pythonEngine.test.ts (SimPy vs theory) | ✅ |
| analyticsEngine.ts | unit/sim/analyticsEngine.test.ts (percentiles, journeys, Little's law, health, cost, enrich) | ✅ (+1 bug via it.fails) |
| resolveKpiMetrics.ts | unit/sim/outputs.test.ts | ✅ (+1 bug via it.fails) |
| timelineSelectors.ts | unit/sim/outputs.test.ts | ✅ |
| layoutEngine.ts | unit/sim/outputs.test.ts (dagre, row-wrap) | ✅ |
| jupyterExport.ts | unit/sim/outputs.test.ts | ✅ |
| reportGenerator.ts | unit/sim/outputs.test.ts | ✅ (+1 XSS bug via it.fails) |
| resultPersistence.ts | unit/sim/outputs.test.ts | ✅ |
| simTypeRegistry.ts | unit/sim/simTypeRegistry.test.ts (every palette/starter type handled by engine) | ✅ |
| clientEngine/pyodideEngine/pyodideWorker/pythonEngineStub | exercised via legacyWorker + pyodide E2E | 🟡 pyodide path blocked by app 500 |
| monteCarlo.ts, monteCarloRunner.ts | src/lib/simulation/monteCarlo.test.ts (node:test, by MC agent) | ✅ 12 tests |

## 4. Lib — AI (src/lib/ai)

| Module | Covered by | Status |
|--------|-----------|--------|
| graphOps.ts | unit/ai/graphOps.test.ts (sanitize, normalize, caps, bulk-delete guard, apply, repair) | ✅ |
| flowAnalysis.ts | unit/ai/flowAnalysis.test.ts (lambda/mu/rho, decision split, broadcast, unstable, divergence) | ✅ |
| textFormat.ts | unit/ai/textFormat.test.ts (LaTeX→markdown, currency kept, idempotent) | ✅ |
| modelRouter.ts | unit/ai/modelRouter.test.ts (extractJSON, modelChain) | ✅ |
| systemPrompt.ts | exercised via aiChat route test (buildSystemPrompt) | ✅ |
| injection.test.ts (by AI agent) | src/lib/ai/injection.test.ts (node:test) | ✅ 20 tests |

## 5. Lib — billing / security / realtime

| Module | Covered by | Status |
|--------|-----------|--------|
| billing/plans.ts | unit/billing/plans.test.ts | ✅ |
| billing/server.ts | unit/billing/server.test.ts (hmac, mock REST, syncSubscription) | ✅ |
| billing/checkout.ts (client) | — | ⬜ browser-only Razorpay popup |
| supabase/safeRedirect.ts | unit/security/safeRedirect.test.ts | ✅ |
| supabase/rateLimit.ts | unit/security/rateLimit.test.ts (DB result, memory fallback, 429 shape) | ✅ |
| middleware.ts (CSRF + auth gate) | unit/security/middleware.test.ts + e2e/security.spec.ts | ✅ |
| realtime/usePresence.ts | e2e/collaboration.spec.ts | 🟡 blocked (app 500) + pending SQL |

## 6. User flows / features (E2E)

| Flow | Covered by | Status |
|------|-----------|--------|
| Landing nav / pricing toggle / FAQ | landing.spec.ts | ✅ |
| Signup / login / forgot / protected-route redirect | auth.spec.ts | ✅ (login-error needs Supabase) |
| Dashboard CRUD + templates | dashboard.spec.ts | 🟡 blocked |
| Workspace: palette, run, results dashboard (all 8 tabs), code inspector, export JSON | workspace.spec.ts | 🟡 blocked |
| AI assistant: ops applied, images NOT rendered | ai.spec.ts (mocked /api/ai/*) | 🟡 blocked |
| **Monte Carlo**: run N, progress, cards, chart, CDN-block failure state | montecarlo.spec.ts | 🟡 blocked |
| **Scenario A/B**: capture A+B, compare, verdict+significance | scenario.spec.ts | 🟡 blocked |
| Sharing: create link, read-only anon, revoke→unavailable | sharing.spec.ts | 🟡 blocked |
| **Collaboration**: invite, 2nd user sees it, presence, live edits, remove revokes | collaboration.spec.ts | 🟡 blocked |
| Settings: profile, billing, delete up to confirm (never deletes) | settings.spec.ts | 🟡 blocked |
| Security: /api 401, CSRF 403, webhook exempt, open-redirect, headers | security.spec.ts | ✅ (ran before 500) |
| Accessibility smoke (axe) + responsive 375px | a11y-responsive.spec.ts | ✅ |

## 7. Untestable / out of scope (with reason)
- `billing/checkout.ts`, Razorpay popup — real third-party browser popup; server side is covered.
- `/update-password` — requires a live Supabase recovery token.
- Real email delivery (nodemailer) — mocked; SMTP not exercised.
- Digital Twin canvas (PixiJS) — rendered-only; covered by "workspace opens" smoke, no pixel assertions.
