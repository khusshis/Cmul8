# JustCmul8 — Missing Feature Specs for Anti-Gravity

This folder contains one Markdown spec per feature that still needs to be built in the JustCmul8 codebase (`D:\Cmul8\justcmul8-rebuild`). Each file is self-contained: current status, what's missing, exact files to touch, and working code to adapt — hand them to the implementing agent one at a time, in order, since some depend on earlier ones.

## Recommended build order

| # | File | Feature | Depends on | Effort |
|---|---|---|---|---|
| 1 | `01-cost-roi-calculator.md` | Cost & ROI data layer (node cost fields + cost roll-up math) | — | Small |
| 2 | `02-kpi-cost-roi-dashboard.md` | Cost & ROI dashboard tab (display layer) | #1 | Small |
| 3 | `03-monte-carlo-scenario-comparison.md` | Monte Carlo multi-run + 95% CI + Baseline vs Optimized A/B comparison | — (pairs well with #1) | Medium |
| 4 | `04-digital-twin-playback.md` | Pixi.js animated 2D playback with VCR controls | — | Large (build Phase A only first) |
| 5 | `05-ai-system-optimizer.md` | Real Gemini-driven bottleneck diagnosis + one-click "Apply Fix" | — (reuses existing AI chat infra) | Medium |
| 6 | `06-executive-pdf-report.md` | True one-click binary PDF export with canvas snapshot | — | Medium |
| 7 | `07-python-code-inspector-jupyter-export.md` | View generated SimPy code + download as `.ipynb` | — | Small |

Files 3–7 have no hard dependency on each other and can be built in parallel by different people/sessions if needed. 1→2 must be sequential.

## Ground truth this was audited against (2026-09-19)

Full codebase audit confirmed:
- **Fully working already, do not touch unless bugs are found:** Auth/login/signup/OAuth, project CRUD, Visual Graph Editor (React Flow, 15 node types), AI Assistant chat (real Gemini), Template Gallery (6 domains), Real-Time Collaboration (live cursors/presence).
- **Partially working, these 7 MD files close the gaps:** Node Config Panel (no cost fields), Simulation Engine (no code inspector/Jupyter export), the mislabeled "AI Diagnosis" (currently rule-based, not real AI, no apply-fix), KPI Dashboard (no cost/ROI panel), Executive Report (HTML print-dialog, not real PDF).
- **Not started at all:** Monte Carlo/scenario comparison, Digital Twin animated playback.

## Conventions used across every spec in this folder

- Every file names the **exact existing file path and line numbers** where new code plugs in — verify those paths still match before starting, since the codebase will have moved on since this audit.
- Code snippets are adapted from patterns **already used elsewhere in this codebase** (same Tailwind classes, same component shape, same API route structure) — don't introduce a different styling/architecture convention for these new features.
- `npm` is the package manager (see `package-lock.json`) — do not switch to `pnpm`/`yarn`.
- Every new optional field added to existing TypeScript interfaces (`NodeParams`, `SimResult`, etc.) is additive/optional — never make a saved-project-breaking required field.
