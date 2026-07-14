# Design System — Professional (n8n-inspired) Theme

## 1. Why this replaces the cyberpunk theme
The original app used neon colors, glow effects, and glitch-text animations on a
dark background — visually striking, but it works against the synopsis's own goal
("intuitive enough for a first-year student," Section 3). Bright neon + monospace +
glitch effects read as a hacker/gaming aesthetic, which can make non-technical users
(teachers, small business owners — Section 8) feel the tool isn't "for them."

**n8n** (a popular no-code workflow automation tool) solves the same problem we
have — turning a technical, node-graph-based tool into something approachable — so we
borrow its visual language:
- Light, calm background instead of dark neon
- One confident accent color instead of five neon colors
- Soft shadows instead of glowing borders
- A light dotted-grid canvas instead of a circuit-board background image

## 2. Token system
All colors, spacing, radii, and shadows are defined **once** as CSS custom properties
in `src/app/globals.css`, under `@theme`. Components must reference these tokens
(`bg-[var(--color-surface)]`, or Tailwind's mapped utility classes) — never a raw hex
code — so the whole app can be re-themed by editing one file.

### Color roles

| Token | Value | Used for |
|---|---|---|
| `--color-bg` | `#F7F7FA` | Page background |
| `--color-surface` | `#FFFFFF` | Cards, panels, the node-properties sidebar |
| `--color-surface-sunken` | `#F0F0F4` | Canvas background, input fields |
| `--color-border` | `#E2E2E8` | Card borders, dividers |
| `--color-text-primary` | `#1A1A24` | Headings, body text |
| `--color-text-secondary` | `#6B6B7B` | Descriptions, helper text |
| `--color-accent` | `#FF6D5A` | Primary buttons, active states, selected node ring |
| `--color-accent-hover` | `#E85A47` | Hover state of accent elements |
| `--color-accent-soft` | `#FFE8E5` | Accent-tinted backgrounds (badges, selected-row highlight) |
| `--color-success` | `#12A150` | Simulation running / success toast / "Busy %" healthy range |
| `--color-warning` | `#D9A400` | Near-capacity warnings, validation warnings |
| `--color-error` | `#D9463F` | Errors, failed simulation runs, delete actions |
| `--color-info` | `#2F6FED` | Informational banners, AI Assistant accents |

### Node-type colors (used as small left-edge accents on node cards, not full glows)
Each of the 15 node types keeps a distinct color so users can recognize node types
at a glance on the canvas — same principle as the original, just muted/desaturated
to fit the light theme instead of neon:

| Node type (UI term) | Color token |
|---|---|
| Arrival Point (`source`) | `--node-source: #2F6FED` (blue) |
| Waiting Line (`queue`) | `--node-queue: #8B5CF6` (violet) |
| Staff/Machine (`resource`) | `--node-resource: #12A150` (green) |
| Processing Step (`service`) | `--node-service: #0EA5A5` (teal) |
| Split Path (`decision`) | `--node-decision: #D9A400` (amber) |
| Exit Point (`sink`) | `--node-sink: #6B6B7B` (gray) |
| Tank/Reservoir (`container`) | `--node-container: #2563EB` (deep blue) |
| Storage Buffer (`store`) | `--node-store: #7C3AED` (deep violet) |
| Condition Watcher (`event_trigger`) | `--node-event_trigger: #DB2777` (pink) |
| Priority Staff/Machine (`priority_resource`) | `--node-priority_resource: #059669` (deep green) |
| Transmission Link (`channel`) | `--node-channel: #0891B2` (cyan) |
| Broadcast Hub (`broadcaster`) | `--node-broadcaster: #EA580C` (orange) |
| Wait For Any (`any_of`) | `--node-any_of: #CA8A04` (gold) |
| Wait For All (`all_of`) | `--node-all_of: #B45309` (brown-amber) |
| Interrupt Signal (`interrupter`) | `--node-interrupter: #DC2626` (red) |

### Typography
- Font: **Inter** (already a dependency-free Google Font via `next/font`), replacing
  the original's monospace/glitch display font.
- Scale: `text-sm` (14px) body, `text-base` (16px) default, `text-lg/xl/2xl/3xl` for
  headings — standard Tailwind scale, no custom oversized display sizes.

### Shadows & radius
- `--radius-card: 12px` — all cards, panels, node boxes
- `--radius-control: 8px` — buttons, inputs
- `--shadow-card: 0 1px 3px rgba(20,20,30,0.08), 0 1px 2px rgba(20,20,30,0.04)` — soft,
  replacing the original's colored glow/box-shadow-as-neon-outline

### Canvas background (React Flow)
Light dotted grid: `background-color: var(--color-surface-sunken)` with a
`BackgroundVariant.Dots` pattern in a light gray (`#D6D6DE`), replacing the original
circuit-board PNG background image.

## 3. Status color usage (must stay consistent everywhere)
| Status | Color | Appears in |
|---|---|---|
| Running / healthy | `--color-success` | Simulation "Running" badge, healthy Busy % range, connected collaborators |
| Warning | `--color-warning` | Near-full queue/buffer, validation warning on a node |
| Error / stopped | `--color-error` | Failed simulation run, delete confirmation, disconnected state |
| Informational | `--color-info` | AI Assistant messages, tooltips, "New feature" badges |

## 4. Accessibility notes
- Accent (`#FF6D5A`) on white passes WCAG AA for large text/UI components but text
  using it directly should be `--color-accent-hover` (#E85A47) or bolder weight for
  small body text contrast.
- All status colors chosen to be distinguishable for the most common forms of color
  blindness (deuteranopia/protanopia) — verified against a standard simulator during
  token selection; icons/shapes are also paired with color (not color alone) on
  status badges (see Module 7 KPI Dashboard doc for badge component details).

---
Status: **Module 0 (design tokens) defined.** Implemented in `src/app/globals.css`
(created next) and consumed by every component from Module 3 onward.
