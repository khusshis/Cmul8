# Resume prompt: JustCmul8 (paste this into a new Claude Code session)

You are picking up work on **JustCmul8**, a discrete-event simulation SaaS. Read this whole file before touching code. It records the state as of **23 Oct 2026**, after a session covering security hardening, Monte Carlo statistics plus customization, UI polish, a full test suite, a Vercel deployment, INR Razorpay billing, Google/GitHub OAuth, and an instant workspace loader.

---

## 1. What the product is

Users drag blocks (Start Point, Waiting Line, Counter, Limited Counter, Decision, Exit…) onto a canvas to model queues: banks, traffic, factories, logistics, networks. They run the model and get analytics: throughput, waits, bottlenecks, cost/ROI, entity journeys, and a digital-twin animation.

Extras:
- **Reliability Lab:** Monte Carlo stress testing plus scenario comparison.
- **AI assistant:** Gemini; edits the graph through validated ops.
- **Real-time collaboration:** presence, cursors and live edits.
- **Share links**, plus PDF, HTML, JSON and Jupyter exports.
- **Billing:** a Free plan with 100 credits a month, and a Pro plan with 500 credits a month and a 14-day trial, via Razorpay subscriptions.

## 2. Where everything is

| Thing | Location |
|---|---|
| Git repo root | `D:\Cmul8` (remote `origin` = github.com/khusshis/Cmul8) |
| **The app** | `D:\Cmul8\justcmul8-rebuild` (older `justCmul8/` folder is legacy, ignore) |
| Production | **https://justcmul8.vercel.app** (Vercel project `justcmul8`, account `mohit30121011`, CLI deploys — GitHub auto-deploy is NOT connected) |
| Database / auth / realtime | Supabase project `nyqzhullqmfpagkmhazz` (free tier; pauses after ~1 week idle → user restores it in the dashboard) |
| Secrets | `justcmul8-rebuild/.env.local` (gitignored). Never print values. Vercel has its own copy. |
| E2E test creds | `justcmul8-rebuild/.env.test.local` (gitignored): `e2e-a@example.com` (owner, **Pro plan**, 2000 credits) and `e2e-b@example.com` (free, 2000 credits). Never print passwords. |
| Team protocol | `D:\Claude-Code & Whisperflow\team\PROTOCOL.md` (task files in `team/tasks/{inbox,doing,review,done}`) |
| Memory notes | `C:\Users\mohit\.claude\projects\d--Cmul8\memory\` |

## 3. Stack, and the gotchas that matter

- **Next.js 16.2** (App Router), React 19, Tailwind 4, framer-motion, recharts 3, @xyflow/react 12, zustand.
  - **This Next version has breaking changes.** Read `node_modules/next/dist/docs/` before writing framework code.
  - Middleware is now **`src/proxy.ts`**, exporting `proxy`.
  - The dev server writes to `.next/dev`, so `next build` can run alongside it. Only one dev server is allowed per repo; it's usually on :3000.
- **Supabase**: auth (email, Google, GitHub), Postgres with RLS everywhere, Realtime broadcast/presence on private channels.
- **Simulation engine runs in the user's browser, not on a server.**
  - Pyodide 0.24.1 (from cdn.jsdelivr.net) plus SimPy (from PyPI via micropip), inside a Web Worker.
  - Code paths: `src/lib/simulation/codeGenerator.ts` builds the Python, `pyodideWorker.ts` runs it.
  - If Pyodide can't load, it falls back to the JS engine `legacyWorker.ts`.
  - Vercel only serves the site and the API routes.
- **Gemini** is called server-side in `src/app/api/ai/*`. **Razorpay** is wired through `src/lib/billing/*` and `src/app/api/billing/*`.
- Windows machine. Use the Bash tool (Git Bash) with POSIX syntax. Editing files through `node -e` with template literals mangles regex backslashes, so use the Edit tool for regexes.

## 4. What was done in the last session (all live on production)

### Security (cyber + agentic)
- **Headers** in `next.config.ts`: CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP.
  - The CSP allowlists Supabase, jsdelivr, PyPI, Razorpay and Google Fonts.
  - It still needs `'unsafe-eval'` (Pyodide and pixi).
  - `upgrade-insecure-requests` is added only when `process.env.VERCEL` is set.
- **CSRF**: `src/proxy.ts` rejects cross-origin POST/PUT/PATCH/DELETE to `/api/*`; the Razorpay webhook is exempt.
- **Rate limiting** works across serverless instances.
  - Postgres function `rate_limit_hit`, called from `src/lib/supabase/rateLimit.ts` with the service role.
  - Falls back to memory if the function is missing.
  - Also a global Gemini budget key.
- **Webhook**: HMAC check, replay dedupe in the `webhook_events` table (the event is recorded only after success), stale events ignored, and subscription state re-fetched from Razorpay.
- **Validation** of every API body: UUIDs, emails, enums and sizes. Generic error messages; details are only logged.
- **Agentic**:
  - Untrusted project data is wrapped in tags in prompts (`src/lib/ai/systemPrompt.ts`).
  - `src/lib/ai/graphOps.ts` allow-lists op and node types, clamps numbers, caps a reply at 60 ops, and blocks more than 5 deletes unless confirmed.
  - Images in AI markdown are not rendered; only http(s) links are allowed.
- **Holes found and fixed (all verified):**
  1. Python injection through a block label: `String.replace` expanded `$'`/`` $` ``. Fixed with function replacers in `codeGenerator.ts`.
  2. Any signed-in user could create an "anyone/editor" share link on any project. Fixed with an owner-only policy.
  3. A viewer could forge `fromUserId` and broadcast graph edits. Realtime is now split:
     - `project:<id>`: graph edits, editors only.
     - `project-presence:<id>`: presence, cursors and sync requests, all members.
     - Code is in `src/lib/realtime/usePresence.ts`; the policies are in SQL section 6.
  4. Stored XSS in the exported HTML report: `esc()` in `reportGenerator.ts`.
  5. Open redirect on `/login?redirect=/\evil.com`: shared helper `src/lib/safeRedirect.ts`.
- **DB changes** are all in `supabase/security.sql`. It's idempotent and has been **applied to live**.
  - **Rule:** re-running `schema.sql` or `collaboration.sql` resets share functions and realtime policies to their weaker originals, so **always re-run `security.sql` afterwards**.
  - Client changes that depend on new SQL need the SQL applied **before** deploy.

### Collaboration
- A data-loss race is fixed. Autosave used to save the graph captured when it was scheduled, so a peer's edit arriving during the 1.5 s debounce got overwritten. It now reads `nodesRef`/`edgesRef` when the timer fires (`src/app/dashboard/project/[id]/page.tsx`).
- Known ceiling: whole-graph last-writer-wins. A `ponytail:` comment suggests Yjs if people co-edit the same block often.

### Monte Carlo / Reliability Lab (`src/components/workspace/MonteCarloPanel.tsx`, `montecarlo/*`, `src/lib/simulation/{monteCarlo,monteCarloRunner,stressTransforms,stressAnalysis,scenarioDiff,decisionScore,mcStorage}.ts`)
- **Statistics:**
  - Exact Student-t CI at 90/95/99%.
  - Welch t-test with an exact incomplete-beta p-value; verified against scipy.
  - Wilson interval for target pass rates.
  - NaN guards.
  - CI clamped only at real bounds.
- **Runner:** unsubscribe-able engine callbacks, AbortSignal cancel (destroys the worker so a late run can't leak into the next batch), a concurrency guard, and `stopWhen` for run-until-precise.
- **Stress test:** Customize drawer with:
  - Run count from 5 to 500, run-until-precise, a duration override, confidence level and risk band.
  - Stress conditions: demand ×, service ×, ±servers.
  - Breaking-point sweep, targets/SLA, bottleneck frequency, run history with pin, and CSV/JSON/PNG/summary export.
- **Compare:**
  - Up to 4 scenarios (A–D), any of which can be the baseline, plus a tweak table and an auto change list.
  - Weighted priorities with a leaderboard. The score uses a 25% minimum scale so noise doesn't look like a landslide, and a winner is called only if it's significant on the top-weighted metric.
  - Apply-to-canvas with a confirm (editors only) and a scenario library.
- **Storage:** history, library and settings are in **localStorage per project**, not synced to collaborators.
- **Deliberately not built:** a variability multiplier (the engine has no spread parameter) and common random numbers / seeds (the engine uses `Math.random`, with no seed).

### UI
- Shared components in `src/components/ui/`:
  - `MetricCard.tsx`: tone, help tip, delta pill, sparkline, range bar.
  - `ChartCard.tsx`, `ChartTooltip.tsx`, `TabStrip.tsx`.
  - `chartTheme.ts`: tones, a CVD-safe series palette, and formatters that never print NaN.
- These are applied across `results-dashboard/*`, `SimResultsPanel`, `AdvancedResultsDashboard` and the dashboard page.
- Reduced motion is respected; contrast is fixed to AA.
- **Instant loader:** clicking a project on the dashboard shows `WorkspaceLoader` in about 140 ms (dev). There's also `src/app/dashboard/project/[id]/loading.tsx`. The loader has no fade-in, so the screen stays continuous.

### Billing (Razorpay, **test mode**: keys start `rzp_test`)
- Prices are in INR from one source, `src/lib/billing/plans.ts`: ₹2,990 a month, or ₹25,000 a year (shown as ₹2,083/mo, "Save 30%"), with a 14-day trial.
- On Vercel: the monthly and yearly plan IDs and the webhook secret. Webhook URL: `https://justcmul8.vercel.app/api/billing/webhook`, subscribed to every `subscription.*` event.
- Verified live: a signed webhook gets 200 and a forged one 400; monthly and yearly subscriptions are created with the trial; test subscriptions were cancelled.
- `RAZORPAY_MOCK=1` in `.env.local` only works under `next dev`.

### Auth
- Email/password, plus **Google and GitHub OAuth**. Both are enabled in Supabase; client IDs are set and their redirect checks pass.
- Callback: `src/app/auth/callback/route.ts`. Failed or cancelled OAuth shows a message on `/login`.
- Supabase URL config: Site URL is the Vercel domain; redirect URLs are the Vercel domain and `localhost:3000`.

## 5. Tests (all green at handoff)

| Command (run in `justcmul8-rebuild`) | What | Count |
|---|---|---|
| `npm test` | Vitest: lib logic, API routes with mocked Supabase/Razorpay/Gemini, security | 208 |
| `npm run test:node` | node:test: MC stats, Reliability Lab, injection, plans | 41 |
| `npm run test:e2e` | Playwright against the :3000 dev server (auth setup + 40 specs incl. two-user collaboration) | 41 |
| `E2E_BASE_URL=https://justcmul8.vercel.app npm run test:e2e` | same suite against production | 41 |
| `node tests/live/realtime-viewer-spoof.mjs` | live DB check: viewer cannot broadcast graph edits | PASS |

Notes:
- `tests/e2e/cleanup.ts` runs as global setup/teardown and deletes the e2e accounts' `e2e-*` projects.
- `openProject()` always creates a fresh project, costing 40 credits. Top up with the service role if the e2e accounts run low.
- If Playwright auth fails, re-run `npx playwright test --project=setup`.
- `tests/TEST_PLAN.md` maps every feature to its test; `tests/TEST_REPORT.md` is the QA report.

## 6. How to deploy

```bash
cd /d/Cmul8/justcmul8-rebuild
npx tsc --noEmit -p . && npm test && npm run test:node   # must be clean
npx next build                                            # must pass
vercel deploy --prod --yes                                # Vercel CLI is installed and logged in
```
- `.vercelignore` keeps `.env*`, docs, `motion/` (1.3 GB), tests and other large or non-app folders out of the upload.
- Add env vars with `printf '%s' "$val" | vercel env add NAME -e production --sensitive --force --yes`. Use `--no-sensitive` for `NEXT_PUBLIC_*`.
- Current production vars:
  - Supabase URL and anon key, plus the service role key.
  - `GEMINI_API_KEY`.
  - `GMAIL_USER` and `GMAIL_APP_PASSWORD`.
  - Razorpay: key ID and secret, webhook secret, and both plan IDs.
  - `APP_URL`.

## 7. Open items / backlog (ask the user before starting any)

1. **Razorpay live mode**: after KYC, recreate both plans and the webhook in Live Mode, then swap `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` and the plan IDs on Vercel.
2. Self-host Pyodide plus the SimPy wheel in `/public` (~25 MB), to drop the jsdelivr/PyPI dependency and tighten the CSP.
3. Security backlog:
   - Cloudflare Turnstile on auth, and MFA.
   - Sentry, an audit log and PITR.
   - Replace the Gmail app password with Resend or SES.
   - A share-link default expiry (currently never).
   - The `server-only` package (not installed).
   - Drop `'unsafe-eval'` (pixi has an `unsafe-eval` build; Pyodide needs a worker-specific policy).
4. Sync the Reliability Lab history and library to the project (DB) so collaborators see them; today they're per-browser.
5. Seeded RNG in both engines, for reproducible runs and common random numbers in Compare.
6. `enrichSimResult` fabricates percentiles when per-entity logs are missing (AUDIT F-1/F-10). Label them "estimated" in the UI.
7. Connect GitHub to Vercel for auto-deploys (`vercel git connect`). The CLI attempt failed on repo access.
8. Lint: 176 older `no-explicit-any` / `set-state-in-effect` errors remain in older files. Next 16 builds don't run lint, so they don't block deploys.

## 8. Working rules from the user
- The user writes in Hinglish and wants things to look like a **finished product**: custom cards, good charts, friendly for non-experts.
- Multi-agent work is welcome. Give each agent strict file ownership, ban `next build`/`next dev` inside agents, and review everything (the strict-reviewer agent) before calling it done.
- No task is done without tests or a check that proves it. Report honestly, including failures.
- Confirm before anything outward-facing or destructive (deploys of risky changes, emails, deleting data, payments).
- Never print secrets. The user pastes secrets into `.env.local` themselves; read them from there.
