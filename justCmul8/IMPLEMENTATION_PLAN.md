# JustCmul8 — Implementation Plan (v8 — UI Polish Complete)

## Goal Description

Build a no-code, browser-accessible discrete event simulation platform. Users create simulations visually using a node graph editor (React Flow), choose a **simulation type** that determines the 2D visual assets, execute the model in-browser via Pyodide/SimPy, and watch the results play out in a dedicated **2D viewport** (Pixi.js) alongside interactive KPI dashboards. An **AI Chat Assistant** (powered by Gemini) allows users to describe simulations in natural language and have them auto-generated.

---

## All Decisions Finalized

| Decision | Answer |
|---|---|
| **Theme** | 🎨 **Cyberpunk** — inspired by [Infothon 2026](https://infothon-2026.vercel.app/) |
| **Auth** | Supabase Auth — `.env.local` with placeholders |
| **Persistence** | Supabase Postgres + RLS |
| **Payments** | Deferred — Stripe added later |
| **Delivery** | Phase-wise — Phase 1+2 first |
| **Visualization** | 2D viewport using Pixi.js |
| **Simulation Types** | Extensible — 5 types initially |
| **Viewport Sync** | Live sync — node drag triggers sprite picker |
| **AI Chat** | Gemini-powered graph generation |
| **LLM Provider** | **Google Gemini** (gemini-2.0-flash) |
| **Smooth Scroll** | **Lenis** — physics-based inertia scroll via `<ReactLenis root>` |
| **Navbar** | Floating centered HUD (1040px), corner-bracket borders, auth-aware |
| **Border Style** | Corner-bracket only (no full borders) — CSS variable driven system |

---

## 🗺️ User Workflow — End-to-End Journey

> [!IMPORTANT]
> This defines the complete user experience from first visit to running a simulation. Every route, page, and transition in the app follows this flow.

### Visual Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   🌐 User visits justcmul8.com                                          │
│       │                                                                  │
│       ▼                                                                  │
│   ┌────────────────────────────────┐                                     │
│   │  1. LANDING PAGE  (/)          │  ◄── Public, no auth required       │
│   │                                │                                     │
│   │  • Hero with glitch animation  │                                     │
│   │  • Features grid               │                                     │
│   │  • Simulation types showcase   │                                     │
│   │  • AI feature highlight        │                                     │
│   │  • Pricing cards               │                                     │
│   │                                │                                     │
│   │  [Get Started] [Login]         │                                     │
│   └──────────┬─────────────────────┘                                     │
│              │                                                           │
│              ▼                                                           │
│   ┌────────────────────────────────┐                                     │
│   │  2. AUTH GATE                  │  ◄── Required before any workspace  │
│   │                                │                                     │
│   │  ┌──────────┐  ┌───────────┐  │                                     │
│   │  │  LOGIN   │  │  SIGNUP   │  │                                     │
│   │  │ /login   │  │ /signup   │  │                                     │
│   │  │          │  │           │  │                                     │
│   │  │ Email +  │  │ Email +   │  │                                     │
│   │  │ Password │  │ Password  │  │                                     │
│   │  │   OR     │  │   OR      │  │                                     │
│   │  │ Google   │  │ Google    │  │                                     │
│   │  │ GitHub   │  │ GitHub    │  │                                     │
│   │  └──────────┘  └───────────┘  │                                     │
│   └──────────┬─────────────────────┘                                     │
│              │  ✅ Authenticated                                         │
│              ▼                                                           │
│   ┌────────────────────────────────┐                                     │
│   │  3. DASHBOARD  (/dashboard)    │  ◄── Protected route               │
│   │     "My Projects"              │                                     │
│   │                                │                                     │
│   │  ┌────────┐ ┌────────┐        │                                     │
│   │  │Project │ │Project │ ...    │  ◄── List of user's projects        │
│   │  │  A     │ │  B     │        │      (from Supabase, RLS filtered)  │
│   │  │ 🧍 HR  │ │ 🚗 VEH │        │                                     │
│   │  │ Mar 28 │ │ Mar 25 │        │                                     │
│   │  └───┬────┘ └───┬────┘        │                                     │
│   │      │           │             │                                     │
│   │  [+ NEW SIMULATION]           │  ◄── Opens "Create Project" modal   │
│   │                                │                                     │
│   └──────────┬─────────────────────┘                                     │
│              │                                                           │
│         ┌────┴────────────────────────────┐                              │
│         │                                  │                              │
│    Click existing                    Click [+ NEW]                       │
│    project card                           │                              │
│         │                                  ▼                              │
│         │                    ┌──────────────────────────┐                │
│         │                    │  CREATE PROJECT MODAL     │                │
│         │                    │                           │                │
│         │                    │  Project Name: [_______]  │                │
│         │                    │                           │                │
│         │                    │  Select Simulation Type:  │                │
│         │                    │  ┌────┐ ┌────┐ ┌────┐   │                │
│         │                    │  │ 🧍 │ │ 🚗 │ │ 💧 │   │                │
│         │                    │  │    │ │    │ │    │   │                │
│         │                    │  └────┘ └────┘ └────┘   │                │
│         │                    │  ┌────┐ ┌────┐          │                │
│         │                    │  │ 🏭 │ │ 📦 │          │                │
│         │                    │  │    │ │    │          │                │
│         │                    │  └────┘ └────┘          │                │
│         │                    │                           │                │
│         │                    │  [CREATE PROJECT ▶]       │                │
│         │                    └──────────┬───────────────┘                │
│         │                               │                                │
│         └───────────┬───────────────────┘                                │
│                     │                                                    │
│                     ▼                                                    │
│   ┌────────────────────────────────────────────────────────────────┐     │
│   │  4. WORKSPACE  (/dashboard/project/[id])                       │     │
│   │     One project = One workspace                                │     │
│   │                                                                │     │
│   │  ┌─────────┬──────────────┬───────────────┬──────────────┐    │     │
│   │  │ Node    │ React Flow   │ 2D Viewport   │ AI Chat      │    │     │
│   │  │ Palette │ Canvas       │ (Pixi.js)     │ Panel        │    │     │
│   │  │         │              │               │              │    │     │
│   │  │ Drag    │ Build your   │ See animated  │ "Create a    │    │     │
│   │  │ nodes   │ simulation   │ simulation    │  bank with   │    │     │
│   │  │ here    │ graph        │ play out      │  3 tellers"  │    │     │
│   │  │         │              │               │              │    │     │
│   │  └─────────┴──────────────┴───────────────┴──────────────┘    │     │
│   │  ┌────────────────────────────────────────────────────────┐    │     │
│   │  │ KPI Dashboard (collapsible bottom panel)               │    │     │
│   │  └────────────────────────────────────────────────────────┘    │     │
│   │                                                                │     │
│   │  Toolbar: [▶ Run] [⏸ Pause] [⏹ Stop] [⏩ Speed] [💾 Saved]   │     │
│   └────────────────────────────────────────────────────────────────┘     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Route Map

| Route | Page | Auth Required | Description |
|---|---|---|---|
| `/` | Landing Page | ❌ No | Public marketing page with hero, features, pricing |
| `/login` | Login | ❌ No | Email/password + OAuth (Google, GitHub) |
| `/signup` | Sign Up | ❌ No | New account registration |
| `/dashboard` | My Projects | ✅ Yes | List of user's simulation projects |
| `/dashboard/project/[id]` | Workspace | ✅ Yes | Full simulation workspace (1 project = 1 workspace) |

### Step-by-Step User Journey

#### Step 1: Landing Page (`/`)
- User visits the URL and sees the cyberpunk-themed landing page.
- **No login required** — this is a public marketing page.
- The page showcases features, simulation types, AI capabilities, and pricing.
- Two primary CTAs:
  - **"Get Started"** → redirects to `/signup`
  - **"Login"** → redirects to `/login`
- Navbar also shows Login / Sign Up buttons (visible when not authenticated).
- If user is **already authenticated** (has active session), navbar shows "Dashboard" button instead and CTAs change to "Go to Dashboard".

#### Step 2: Authentication (`/login` or `/signup`)
- **Required before accessing any project or workspace.**
- Cyberpunk-themed auth forms with glass panels and terminal-style inputs.
- **Sign Up** (`/signup`):
  - Email + password registration.
  - OAuth: Google, GitHub.
  - On success → redirect to `/dashboard`.
  - Supabase creates the user record automatically.
- **Login** (`/login`):
  - Email + password.
  - OAuth: Google, GitHub.
  - On success → redirect to `/dashboard`.
- **Auth Middleware** (`middleware.ts`):
  - Any request to `/dashboard` or `/dashboard/*` checks for a valid Supabase session.
  - If no session → redirect to `/login` with a `?redirect=/dashboard` param.
  - After successful login → redirect back to the originally requested page.

#### Step 3: Dashboard — My Projects (`/dashboard`)
- **Protected page** — only accessible after authentication.
- Displays a **list of all projects** belonging to the logged-in user.
- Data comes from Supabase `projects` table, filtered by Row-Level Security (only the user's own projects are visible).
- Each project is shown as a **cyberpunk glass card** with:
  - Project name
  - Simulation type badge (🧍 Human Queue, 🚗 Vehicle, 💧 Liquid, 🏭 Manufacturing, 📦 Logistics)
  - Last modified date
  - Quick actions: **Open** / **Delete** (with confirmation modal)
- **"+ New Simulation"** button (prominent CTA):
  - Opens a **Create Project modal**:
    1. Enter project name (terminal-style input).
    2. Select simulation type from 5 animated icon cards.
    3. Click "Create Project" → inserts a row into Supabase `projects` table → redirects to the new workspace at `/dashboard/project/[new-id]`.
- **Empty state**: If user has no projects, show a centered message: *"No simulations yet. Create your first one!"* with a large CTA button.
- **Navbar on dashboard**: Shows user avatar/email, "Dashboard" active link, and a "Logout" button.

#### Step 4: Workspace (`/dashboard/project/[id]`)
- **Protected page** — requires auth + the project must belong to the user (enforced by Supabase RLS).
- **One project = One workspace.** Opening a project takes you directly into its full simulation workspace.
- The workspace features a 4-panel layout:
  - **Left**: Node palette (drag simulation primitives onto canvas)
  - **Center-left**: React Flow canvas (node graph editor)
  - **Center-right**: Pixi.js 2D viewport (live animation)
  - **Right**: AI Chat panel (Gemini-powered)
  - **Bottom**: KPI dashboard (collapsible, visible during/after simulation)
  - **Top**: Toolbar (Run/Pause/Stop/Speed, sim clock, save status)
- **Two ways to build a simulation**:
  1. **Manual**: Drag nodes from palette → sprite picker appears → connect nodes → configure properties.
  2. **AI Chat**: Describe the simulation → AI generates the complete graph + sprites.
- **Auto-save**: Every change (node position, properties, connections) is debounce-saved to Supabase.
- **"Back to Dashboard"** button: Returns to `/dashboard` (project list).

### Auth Boundary Diagram

```
        PUBLIC                    │              PROTECTED
        (No auth needed)          │              (Auth required)
                                  │
   /  (Landing Page)              │    /dashboard  (My Projects)
   /login                        │    /dashboard/project/[id]  (Workspace)
   /signup                        │
                                  │
──────────────────────────────────┤
                                  │
                            middleware.ts
                            checks Supabase session
                            redirects to /login if missing
```

---

## 🎨 Cyberpunk Theme — Complete Design System

> [!IMPORTANT]
> This is the visual DNA of JustCmul8. Every component, page, and interaction must adhere to this theme. Directly inspired by the [Infothon 2026](https://infothon-2026.vercel.app/) aesthetic.

### Reference Screenshots

The Infothon 2026 site features:
- Pitch-black backgrounds with Japanese neon cityscape imagery
- Neon cyan (`#00f2ff`) as the dominant accent
- Magenta/purple (`#7000ff`, `#ff00ff`) as secondary glow
- Glassmorphism cards with glowing borders
- Monospaced "terminal" inputs
- Notched/clipped corners on cards
- CRT scanline overlays
- Bold uppercase headings with glow effects

### Color Palette

```
┌─────────────────────────────────────────────────────────────┐
│  CYBERPUNK COLOR SYSTEM                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Backgrounds                                                 │
│  ──────────                                                  │
│  bg-primary:     #0a0a0f    (Deep void black)               │
│  bg-secondary:   #0d0d15    (Slightly lifted dark)          │
│  bg-surface:     rgba(0,0,0,0.40)   (Glass panels)         │
│  bg-surface-alt: rgba(10,10,20,0.60) (Heavier glass)       │
│                                                              │
│  Neon Accents                                                │
│  ────────────                                                │
│  neon-cyan:      #00f2ff    (Primary action, borders, glow) │
│  neon-magenta:   #ff00ff    (Secondary glow, gradients)     │
│  neon-purple:    #7000ff    (Tertiary, deep accents)        │
│  neon-green:     #10b981    (Success, active states)        │
│  neon-yellow:    #fbbf24    (Warnings, queue nodes)         │
│  neon-red:       #ef4444    (Errors, bottlenecks, sink)     │
│  neon-orange:    #f97316    (Resource nodes, busy state)    │
│                                                              │
│  Text                                                        │
│  ────                                                        │
│  text-primary:   #ffffff    (Headings, primary content)     │
│  text-secondary: #9ca3af    (Descriptions, labels)          │
│  text-muted:     #4b5563    (Disabled, hints)               │
│  text-accent:    #00f2ff    (Links, highlighted data)       │
│                                                              │
│  Gradients                                                   │
│  ─────────                                                   │
│  gradient-primary:  linear-gradient(135deg, #00f2ff, #7000ff)│
│  gradient-danger:   linear-gradient(135deg, #ef4444, #ff00ff)│
│  gradient-surface:  linear-gradient(180deg,                  │
│                     rgba(0,242,255,0.05), transparent)       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Typography

| Role | Font | Weight | Style Notes |
|---|---|---|---|
| **Display / Hero Headings** | **Orbitron** | 700–900 | Uppercase, letter-spacing `0.15em`, neon text-shadow glow |
| **Section Headings** | **Orbitron** | 600 | Uppercase, `tracking-wider` |
| **Body Text** | **Inter** | 400 | Clean readability on dark backgrounds |
| **UI Labels / Buttons** | **Inter** | 500–600 | Uppercase, `tracking-widest` |
| **Data / Code / Terminal** | **JetBrains Mono** | 400 | Monospaced — used in AI chat, sim clock, KPI values, search inputs |

Google Fonts import:
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Orbitron:wght@400;500;600;700;800;900&display=swap');
```

### Glow & Neon Effects

```css
/* Neon text glow (for headings) */
.text-glow-cyan {
  text-shadow: 0 0 7px #00f2ff, 0 0 10px #00f2ff, 0 0 21px #00f2ff, 0 0 42px #0fa;
}

/* Neon border glow (for cards, panels) */
.border-glow-cyan {
  box-shadow: 0 0 5px rgba(0, 242, 255, 0.3),
              inset 0 0 5px rgba(0, 242, 255, 0.1);
}

/* Stronger hover glow */
.hover-glow-cyan:hover {
  box-shadow: 0 0 10px rgba(0, 242, 255, 0.5),
              0 0 20px rgba(0, 242, 255, 0.3),
              inset 0 0 10px rgba(0, 242, 255, 0.15);
}

/* Pulse glow animation (for active simulation nodes) */
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 5px rgba(0, 242, 255, 0.3); }
  50% { box-shadow: 0 0 20px rgba(0, 242, 255, 0.6), 0 0 40px rgba(0, 242, 255, 0.3); }
}

/* Glitch effect (for hero text) */
@keyframes glitch {
  0% { text-shadow: 2px 0 #ff00ff, -2px 0 #00f2ff; }
  25% { text-shadow: -2px 0 #ff00ff, 2px 0 #00f2ff; }
  50% { text-shadow: 2px 2px #ff00ff, -2px -2px #00f2ff; }
  75% { text-shadow: -2px 2px #ff00ff, 2px -2px #00f2ff; }
  100% { text-shadow: 2px 0 #ff00ff, -2px 0 #00f2ff; }
}
```

### Glassmorphism Specification

```css
.glass-panel {
  background: rgba(0, 0, 0, 0.40);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 242, 255, 0.15);
  border-radius: 8px;  /* or use clip-path for notched corners */
}

.glass-panel-heavy {
  background: rgba(10, 10, 20, 0.60);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(0, 242, 255, 0.25);
}
```

### Notched / Clipped Corners (Cyberpunk Signature)

```css
/* Notched corner card — top-left and bottom-right corners are cut */
.notched-card {
  clip-path: polygon(
    16px 0%, 100% 0%, 100% calc(100% - 16px),
    calc(100% - 16px) 100%, 0% 100%, 0% 16px
  );
}
```

### Background Effects

```css
/* Animated grid overlay */
.cyber-grid {
  background-image:
    linear-gradient(rgba(0, 242, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 242, 255, 0.03) 1px, transparent 1px);
  background-size: 50px 50px;
  animation: grid-scroll 20s linear infinite;
}

@keyframes grid-scroll {
  0% { background-position: 0 0; }
  100% { background-position: 50px 50px; }
}

/* CRT scanline overlay */
.scanlines::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.1) 2px,
    rgba(0, 0, 0, 0.1) 4px
  );
  pointer-events: none;
  z-index: 10;
}
```

### Component Style Guide

#### Navbar ✅ IMPLEMENTED
- **Layout**: Floating centered container, `top: 12px`, `max-width: 1040px`, not full-width.
- **Background layer** is a sibling `div` (outside `<motion.nav>`) so `backdrop-filter` works natively without framer-motion stacking context interference.
- **Corner-bracket borders** on the container using CSS multi-gradient background — same system as cards/buttons.
- **Glowing bottom edge line**: Thin `h-px` neon cyan line with box-shadow glow.
- **Vertical `|` dividers** with gradient fade between logo / nav links / CTAs zones.
- **`//` hover prefix** on nav links — slides in from left with a `pl-4` transition.
- **Underline glow** on nav link hover — scales in from left with box-shadow.
- **Auth-aware**: detects Supabase session on mount + `onAuthStateChange` subscription.
  - **Guest**: shows `LOGIN` + `GET STARTED` buttons.
  - **Authenticated**: shows `DASHBOARD` + `LOGOUT` buttons (email removed from inline nav to prevent overflow).
- **Glassmorphism on scroll**: transitions from `blur(8px)` background at idle to `blur(20px)` + darker bg once scrolled past 20px.
- **Consistent across all pages**: Dashboard, login, signup, and landing all import `<Navbar />` with zero props.

#### Cards (Feature Cards, Project Cards, Pricing) ✅ IMPLEMENTED
- `glass-panel` with `hover-glow-cyan` on hover.
- Thin `border-cyan/15` default → `border-cyan/40` on hover.
- **No rounded corners** — uses `.notched-card` (clip-path diagonal) or `.card-cyber` (corner-bracket system) instead.
- Category tags: small pill with `bg-cyan/10 text-cyan` or `bg-magenta/10 text-magenta`.
- Price badges: positioned absolute top-right, `bg-neon-green/20 text-neon-green` with glow.
- `GlassCard` component supports `heavy`, `notched`, `hover`, `accentColor` props.

#### Buttons ✅ IMPLEMENTED — Corner-Bracket System

All buttons use **corner-bracket-only borders** (no full border, no border-radius). Implemented via CSS `::before` multi-gradient background:

```css
/* Corner bracket CSS variables */
--corner-color: rgba(0,242,255,0.7);
--corner-w: 12px;   /* horizontal arm length */
--corner-h: 12px;   /* vertical arm length */
--corner-t: 1.5px;  /* stroke thickness */

/* Primary CTA — transparent bg, cyan brackets, pulse glow animation */
.btn-cyber-primary {
  background: transparent;
  color: #00f2ff;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  position: relative;
  /* Corner brackets via ::before pseudo-element */
}

/* Ghost — dim bracket corners, muted text → cyan on hover */
.btn-cyber-ghost { ... }

/* Danger — red bracket variant for destructive actions */
.btn-cyber-danger { ... }
```

> [!NOTE]
> Use `.animate-pulse-glow` alongside `.btn-cyber-primary` for a breathing neon shadow effect on CTAs.

#### Inputs & Search Bars (Terminal Style)
- Dark background `bg-black/60`, monospaced font (`JetBrains Mono`).
- Thin `border-white/10` → `border-cyan/40` on focus.
- Placeholder text in `text-muted` with typewriter effect.
- Blinking cursor dot (like the Infothon search bar).

#### Tags / Badges
- Small, rounded pills: `bg-accent/10 text-accent border border-accent/20`.
- Simulation type badges: each type gets its own neon color.

#### Timeline / Progress Indicators
- Vertical glowing line with pulsing circular nodes.
- Perfect for simulation step progress and the preloader.

### Preloader Animation
- Full-screen `bg-primary` with centered content.
- **Orbitron** text: `JUSTCMUL8` with glitch animation.
- Below: `INITIALIZING SIMULATION ENVIRONMENT...` in **JetBrains Mono** with typewriter effect.
- Progress bar with neon-cyan fill and glow.
- Subtle CRT scanline overlay.

### Workspace-Specific Theme

#### Node Editor (React Flow)
- Canvas background: `#0a0a0f` with subtle cyan grid lines.
- Node cards: `glass-panel` with colored left-border accent per node type.
- Selected node: stronger glow matching its accent color.
- Edges: semi-transparent cyan lines with animated dash pattern.
- Minimap: tinted with cyberpunk colors.

#### 2D Viewport (Pixi.js)
- Background: dark with faint animated grid (cyber-grid effect).
- CRT scanline overlay for a "tactical terminal" feel.
- Sprites: clean SVG/PNG with subtle neon outlines.
- Entity paths: dotted neon lines.

#### AI Chat Panel
- `glass-panel-heavy` background.
- Messages: user messages right-aligned with `bg-cyan/10`, AI messages left-aligned with `bg-purple/10`.
- Input: terminal-style with monospaced font and blinking cursor.
- "Generating…" state: pulsing dots with cyan glow.
- Header: `🤖 AI ASSISTANT` in **Orbitron** with subtle glow.

#### KPI Dashboard
- Charts use neon color palette (cyan, magenta, green, yellow).
- Chart backgrounds: semi-transparent dark glass.
- KPI value readouts: **JetBrains Mono** with large font and neon color.
- Bottleneck highlight: red pulsing glow on identified node.

---

## Core Design: AI Chat Assistant (Gemini-Powered)

### User Experience Flow

1. User opens project workspace → AI Chat panel visible on right.
2. User types: *"Create a hospital ER with 2 triage nurses and 3 doctors. Patients arrive every 5 minutes."*
3. AI responds with a plan → generates complete graph → nodes appear on canvas one by one → viewport populates with sprites.
4. User can follow up: *"Add a VIP lane"*, *"What if I add another nurse?"*

### Architecture

```
User prompt
    │
    ▼
┌────────────────────────────────────┐
│  POST /api/ai/generate             │  (Next.js API route)
│                                    │
│  System prompt includes:           │
│  • Simulation type + sprite catalog│
│  • Node type schemas               │
│  • Current graph state             │
│  • JSON output schema              │
│                                    │
│  Uses: @google/generative-ai       │
│  Model: gemini-2.0-flash           │
└─────────────┬──────────────────────┘
              │
              ▼
┌────────────────────────────────────┐
│  Client: Parse + Validate + Load   │
│  • Auto-layout nodes (dagre)       │
│  • Staggered build animation       │
│  • Viewport sprite sync            │
└────────────────────────────────────┘
```

### AI Capabilities

| Capability | Example |
|---|---|
| **Generate from scratch** | "Create a bank with 3 tellers" |
| **Modify existing** | "Add a VIP lane" |
| **Explain** | "Why is there a bottleneck?" |
| **Optimize** | "What if I add another pump?" |
| **Configure** | "Change arrival rate to 1/min" |

---

## Live Viewport Sync & Sprite Asset Picker

### Manual Mode
1. Drag node → sprite picker modal → select sprite → viewport updates.
2. Move/delete/connect nodes → viewport syncs in real-time.

### AI Mode
1. AI generates graph + sprite assignments → canvas and viewport populate automatically with build animation.
2. User can then manually adjust anything.

---

## Extensible Simulation Type System (5 Types)

| Type | Icon | Assets |
|---|---|---|
| 🧍 Human Queue | `Users` | People, counters, desks, barriers, doors |
| 🚗 Vehicle | `Car` | Cars, trucks, pumps, roads, lights |
| 💧 Liquid | `Droplets` | Tanks, pipes, valves, flow particles |
| 🏭 Manufacturing | `Factory` | Conveyors, machines, bins, robotic arms |
| 📦 Logistics | `Package` | Forklifts, shelves, docks, packages |

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Framework | Next.js 14+ (App Router) | SSR, routing, API routes |
| Styling | Tailwind CSS + custom CSS | Cyberpunk theme, glassmorphism |
| Animation | Framer Motion | Page transitions, micro-interactions |
| Smooth Scroll | **Lenis** (`lenis/react`) | Physics-based inertia scrolling via `<ReactLenis root>` |
| Node Editor | `@xyflow/react` | Drag-and-drop simulation graph |
| 2D Viewport | Pixi.js | GPU-accelerated sprite animation |
| Sim Engine | Pyodide (Web Worker) | In-browser Python/SimPy |
| AI Chat | **Google Gemini** (`@google/generative-ai`) | Graph generation, insights |
| State | Zustand | Cross-component state |
| Charts | Recharts | KPI dashboards |
| Icons | Lucide React | UI iconography |
| Auth | Supabase Auth | Signup, login, sessions |
| Database | Supabase Postgres | Projects, chat history (RLS) |
| Payments | Stripe (deferred) | Added later |

---

## Phase 1: Foundation — *The Shell*

### 1.1 — Project Bootstrap

#### [NEW] Next.js Project
- `npx create-next-app@latest ./` with App Router, TypeScript, Tailwind CSS, ESLint.
- Install: `framer-motion`, `lucide-react`, `zustand`, `@supabase/supabase-js`, `@supabase/ssr`, `@google/generative-ai`.

#### [NEW] `.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here
GEMINI_API_KEY=your-gemini-api-key-here
```

#### [NEW] Tailwind Config — Cyberpunk Design Tokens
- All colors from the Cyberpunk Color System above.
- Font families: Orbitron, Inter, JetBrains Mono.
- Custom keyframes: `pulse-glow`, `glitch`, `grid-scroll`, `fade-slide-up`, `float`.
- Utility classes for glow, glass, notched corners.

#### [NEW] `app/globals.css`
- Google Fonts import (Orbitron, Inter, JetBrains Mono).
- All glow effects, glass panels, cyber-grid, scanlines, notched-card.
- Button styles (`btn-cyber-primary`, `btn-cyber-ghost`).
- Terminal input styles.

### 1.2 — Layout Components

#### [NEW] `components/layout/Navbar.tsx`
- Cyberpunk glass navbar: transparent → blur on scroll.
- `JUSTCMUL8` logo in Orbitron with cyan glow.
- Nav links with hover underline glow.

#### [NEW] `components/layout/PreLoader.tsx`
- Full-screen cyberpunk boot sequence.
- Glitching `JUSTCMUL8` text → `INITIALIZING...` typewriter → progress bar.
- CRT scanline overlay.

#### [NEW] `components/ui/GlassCard.tsx`
- Glassmorphism with hover glow and optional notched corners.

### 1.3 — Landing Page (`/`) — Full Wireframe & Content

#### [NEW] `app/page.tsx`

The landing page is a single vertically-scrolling page divided into **8 distinct sections**. All sections use scroll-triggered Framer Motion reveals (fade-up + stagger). The entire page sits on the `bg-primary` (#0a0a0f) background with the `cyber-grid` animated overlay.

---

#### SECTION 1: Navbar (Fixed)

```
┌──────────────────────────────────────────────────────────────────────┐
│  ⬡ JUSTCMUL8          Features  Engine  Security  Pricing     [LOGIN] [GET STARTED]  │
└──────────────────────────────────────────────────────────────────────┘
```

- Fixed at top, floating centered container at `max-width: 1040px`, `z-50`.
- `JUSTCMUL8` in **Orbitron** with cyan text-glow and `<GlitchText intensity="normal">` wrapper.
- Nav links: `//` hover prefix, smooth-scroll to page sections. `text-secondary` → `text-accent` on hover with underline glow.
- **Corner-bracket container borders** on the entire navbar panel.
- **Thin glowing bottom edge** line (neon cyan, fades at edges).
- **Vertical `|` section dividers** between logo / nav / CTAs.
- **Auth-aware CTAs**: Guest → `[LOGIN]` `[GET STARTED]`; Authenticated → `[DASHBOARD]` `[LOGOUT]`.
- **Glassmorphism activates on scroll** (`blur(8px)` → `blur(20px)`).

---

#### SECTION 2: Hero

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│             ▓▓▓ animated cyber-grid background ▓▓▓                   │
│                                                                      │
│                 TRANSFORM YOUR OPERATIONS                            │
│              WITH THE NO-CODE SIMULATION ENGINE                      │
│                                                                      │
│    Finally, high-fidelity discrete event simulation is accessible    │
│    to everyone. Build complex industrial models visually, and let    │
│    JustCmul8 instantly transpile your design into performant         │
│    Python/SimPy logic, executed at speed in your browser via         │
│    WebAssembly. Identify bottlenecks, test "what-if" scenarios,      │
│    and optimize your processes in a risk-free environment.           │
│                                                                      │
│    [START YOUR FREE PROJECT →]     [EXPLORE FEATURES ↓]             │
│     (1 Active Project Included)                                      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Visual Treatment (✅ IMPLEMENTED):**
- **Fixed cyberpunk background image** (`/public/cyberpunk_fixed_bg.png`) applied globally as `fixed inset-0`, blended with `mix-blend-screen opacity-50`. All page sections scroll over this fixed layer.
- **Global `cyber-grid` overlay** — subtle animated dot grid at `z-0`.
- **CRT scanline sweep** animates over the logo container.
- Hero logo: `/public/justcmul8new.png` displayed via `next/image` with `mix-blend-screen`, `drop-shadow` glow, and a sweeping animated scanline.
- Headline: **Orbitron 900**, wrapped in `<GlitchText intensity="high" delay={0}>` — dual cyan/magenta chromatic aberration glitch.
- Subheadline `TRANSFORM YOUR OPERATIONS`: wrapped in `<GlitchText intensity="high" delay={0.8}>` — **offset by 0.8s** so logo and text never glitch simultaneously.
- Primary CTA: `btn-cyber-primary` with corner brackets. Secondary: `btn-cyber-ghost`.
- **Smooth scrolling**: `<ReactLenis root>` wraps entire page for physics-based inertia.

---

#### SECTION 3: System Status Ticker (Full-Width Marquee)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ◆ SYSTEM_STATUS: DISCRETE EVENT ENVIRONMENT ONLINE ◆ RUNNING SIMPY  │
│ CORE v4.1 ◆ PYODIDE WASM ACTIVE ◆ 12,847 SIMULATIONS EXECUTED ◆    │
│ ENTITIES PROCESSED: 2.4M ◆ AVG THROUGHPUT: 847/hr ◆ UPTIME: 99.97% │
└──────────────────────────────────────────────────────────────────────┘
```

**Visual Treatment:**
- Full-width bar, `bg-secondary` (#0d0d15) with top/bottom 1px `border-cyan/10`.
- Text: **JetBrains Mono 400**, ~13px, `text-cyan`, uppercase.
- CSS `marquee` animation (infinite scroll left-to-right, ~40s duration).
- Diamond separator `◆` between items, also in cyan.
- Appears between hero and features — creates a "data feed" tactical feel.

---

#### SECTION 4: Features — "Model Anything. Code Nothing." (id="features")

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│     ── SIMULATION TOOLKIT ──                                         │
│                                                                      │
│     MODEL ANYTHING. CODE NOTHING.                                    │
│                                                                      │
│     The core of JustCmul8 is a 2D drag-and-drop workspace powered   │
│     by React Flow, enabling anyone — the "Citizen Modeler" — to     │
│     build a rigorous system model.                                   │
│                                                                      │
│  ┌─────────────────────────┐  ┌────────────────────────────────────┐ │
│  │                         │  │                                    │ │
│  │   CORE PRIMITIVES       │  │   ADVANCED LOGIC NODES             │ │
│  │                         │  │                                    │ │
│  │   ⬢ Source (Generator)  │  │   ⚡ Priority Resource             │ │
│  │     Generate entities   │  │     High-priority entities bypass  │ │
│  │     at defined intervals│  │     standard waiting lines         │ │
│  │                         │  │                                    │ │
│  │   ⬢ Service / Delay     │  │   ⚡ Preemptive Resource           │ │
│  │     Time-consuming      │  │     Critical processes interrupt   │ │
│  │     activities          │  │     lower-priority tasks           │ │
│  │                         │  │                                    │ │
│  │   ⬢ Resource (Capacity) │  │   ⚡ Wait with Timeout (Renege)    │ │
│  │     Limited staff or    │  │     Entities exit if max wait      │ │
│  │     machines            │  │     time exceeded                  │ │
│  │                         │  │                                    │ │
│  │   ⬢ Queue (Buffer)      │  │   ⚡ Container / Level             │ │
│  │     Waiting areas       │  │     Manage flowable substances     │ │
│  │                         │  │     like fuel or material          │ │
│  │   ⬢ Decision (Router)   │  │                                    │ │
│  │     Route by logic      │  │   ⚡ Event Trigger / Condition      │ │
│  │                         │  │     React to state changes         │ │
│  │   ⬢ Sink (Termination)  │  │                                    │ │
│  │     KPI calculation     │  │   ⚡ Store / Pipe                   │ │
│  │                         │  │     Async process communication    │ │
│  └─────────────────────────┘  └────────────────────────────────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Visual Treatment:**
- Section label: **JetBrains Mono**, small, `text-cyan`, uppercase, tracking-widest. Horizontal lines on either side (`── SIMULATION TOOLKIT ──`).
- Heading: **Orbitron 700**, ~40px, white with subtle cyan glow.
- Description: **Inter 400**, `text-secondary`, max-width 600px.
- Two cards side by side (Bento layout): `glass-panel` with `hover-glow-cyan`.
  - **Core Primitives** card: Left, ~40% width. Green hexagon icons `⬢`.
  - **Advanced Logic** card: Right, ~60% width. Yellow lightning bolt icons `⚡`.
- Each node item: Icon + node name (**Inter 600**, white) + one-line description (**Inter 400**, `text-secondary`).
- **Framer Motion**: Cards slide in from left/right respectively on scroll, staggered 100ms per item.

---

#### SECTION 5: AI-Powered Simulation — "Your AI Co-Pilot" (id="ai")

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│     ── AI ENGINE ──                                                  │
│                                                                      │
│     DESCRIBE IT. WE SIMULATE IT.                                     │
│                                                                      │
│     Don't know simulation theory? No problem. Just describe what     │
│     you need in plain English and our Gemini-powered AI assistant    │
│     builds the entire model for you — nodes, connections, sprites,   │
│     and optimized parameters.                                        │
│                                                                      │
│  ┌────────────────────────────┐  ┌──────────────────────────────────┐│
│  │  🤖 AI ASSISTANT           │  │  GENERATED RESULT               ││
│  │                            │  │                                  ││
│  │  You: "Create a hospital   │  │  ┌──────┐    ┌──────┐          ││
│  │  ER with 2 triage nurses   │  │  │Source├───►│Queue │          ││
│  │  and 3 doctors. Patients   │  │  │ 🧍   │    │ 🧍🧍🧍│          ││
│  │  arrive every 5 minutes."  │  │  └──────┘    └──┬───┘          ││
│  │                            │  │                 │               ││
│  │  AI: "Building your ER     │  │           ┌─────▼─────┐        ││
│  │  simulation now..."        │  │           │ Resource   │        ││
│  │                            │  │           │ 👩‍⚕️ Triage  │        ││
│  │  ████████████░░░ 78%       │  │           └─────┬─────┘        ││
│  │                            │  │                 │               ││
│  │  ✅ 6 nodes created        │  │           ┌─────▼─────┐        ││
│  │  ✅ 5 connections made     │  │           │ Resource   │        ││
│  │  ✅ Sprites assigned       │  │           │ 👨‍⚕️ Doctors │        ││
│  │                            │  │           └─────┬─────┘        ││
│  │  [Type your simulation...] │  │                 │               ││
│  └────────────────────────────┘  │           ┌─────▼─────┐        ││
│                                  │           │  Sink ✓   │        ││
│                                  │           └───────────┘        ││
│                                  └──────────────────────────────────┘│
│                                                                      │
│     ✦ Generate from scratch     ✦ Modify existing models            │
│     ✦ Explain bottlenecks       ✦ Optimize parameters               │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Visual Treatment:**
- Section label: `── AI ENGINE ──`, same style as above.
- Heading: **Orbitron 700**, white, with magenta glow variant.
- Two-panel demo:
  - **Left**: AI Chat mockup — `glass-panel-heavy`, terminal-style. JetBrains Mono for user/AI messages. Animated progress bar with cyan fill. Checkmarks appear sequentially (staggered Framer Motion).
  - **Right**: Generated graph preview — `glass-panel`, shows a simplified node graph being built step-by-step (animated SVG or Framer Motion).
- Capability bullets below: 4 items in a row, each with `✦` cyan accent, **Inter 500**.
- **Framer Motion**: Left panel slides in from left, right panel from right. Chat messages type in one by one. Graph nodes pop in sequentially.

---

#### SECTION 6: The Engine — "Speed & Precision in Your Browser" (id="engine")

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│     ── SIMULATION ENGINE ──                                          │
│                                                                      │
│     THE ENGINE: SPEED & PRECISION IN YOUR BROWSER                    │
│                                                                      │
│     We bridge the gap between visual design and technical rigor      │
│     by automatically generating and running Python's SimPy logic.    │
│                                                                      │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌──────────┐ │
│  │               │ │               │ │               │ │          │ │
│  │  PYODIDE &    │ │  REAL-TIME    │ │  BOTTLENECK   │ │  SMART   │ │
│  │  WEBASSEMBLY  │ │  KPI          │ │  DETECTION    │ │  SPEED   │ │
│  │               │ │  DASHBOARDS   │ │               │ │  CONTROL │ │
│  │  ⚙️ Full sim   │ │  📊 Throughput │ │  🔴 Auto-ID    │ │  ⏩ 1x to │ │
│  │  engine runs  │ │  📊 Utiliz.   │ │  the slowest  │ │  10x to  │ │
│  │  in-browser   │ │  📊 Wait Time │ │  process node │ │  Max     │ │
│  │  via WASM.    │ │  📊 Flow Rate │ │  in real-time │ │  speed   │ │
│  │  Zero server  │ │               │ │               │ │          │ │
│  │  costs.       │ │  Live charts  │ │  Red glow on  │ │  Step or │ │
│  │               │ │  update as    │ │  bottleneck   │ │  run     │ │
│  │               │ │  sim runs.    │ │  node.        │ │  freely. │ │
│  └───────────────┘ └───────────────┘ └───────────────┘ └──────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Visual Treatment:**
- 4 Bento-style cards in a row. Each is a `glass-panel` with `notched-card` clip-path.
- Card headers: **Orbitron 600**, ~16px, uppercase.
- Card icons: large emoji or Lucide icon above the title.
- Card body: **Inter 400**, `text-secondary`.
- Each card has a different subtle accent (cyan, green, red, yellow border-left glow).
- **Framer Motion**: Cards stagger in from below, 150ms apart.

---

#### SECTION 7: Simulation Types — "Visualize Any Industry" (id="simulations")

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│     ── SIMULATION TYPES ──                                           │
│                                                                      │
│     VISUALIZE ANY INDUSTRY                                           │
│                                                                      │
│     Choose your simulation context. Each type comes with curated     │
│     2D sprite assets for realistic, animated visualization.          │
│                                                                      │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────┐ ┌──────┐   │
│  │            │ │            │ │            │ │      │ │      │   │
│  │   🧍‍🧍‍🧍      │ │    🚗🚙     │ │    💧🔬     │ │  🏭  │ │  📦  │   │
│  │            │ │            │ │            │ │      │ │      │   │
│  │  HUMAN     │ │  VEHICLE   │ │  LIQUID /  │ │ MFG  │ │ LOGI │   │
│  │  QUEUE     │ │            │ │  MATERIAL  │ │      │ │ STIC │   │
│  │            │ │            │ │            │ │      │ │      │   │
│  │ Bank       │ │ Gas station│ │ Water      │ │ Asmbly│ │ Ware- │   │
│  │ Hospital   │ │ Traffic    │ │ treatment  │ │ line │ │ house│   │
│  │ Airport    │ │ Drive-thru │ │ Fuel tanks │ │ QC   │ │ Sort │   │
│  │            │ │            │ │            │ │      │ │      │   │
│  │  [TRY →]   │ │  [TRY →]   │ │  [TRY →]   │ │[TRY]│ │[TRY]│   │
│  └────────────┘ └────────────┘ └────────────┘ └──────┘ └──────┘   │
│                                                                      │
│  + Extensible: More types added regularly. Custom types on Pro.      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Visual Treatment:**
- 5 cards: first 3 larger (Bento-style uneven grid), last 2 smaller. `glass-panel` + `hover-glow-cyan`.
- Each card: Large icon/emoji centered, type name in **Orbitron 600**, example scenarios in **Inter 400** `text-secondary`, and a small "TRY →" link in `text-cyan`.
- Each type has its own neon accent border-top:
  - 🧍 Human Queue → `neon-green`
  - 🚗 Vehicle → `neon-cyan`
  - 💧 Liquid → `neon-purple`
  - 🏭 Manufacturing → `neon-orange`
  - 📦 Logistics → `neon-yellow`
- Extensibility note: Small text below cards, `text-muted`, with "Pro" badge in `neon-magenta`.
- **Framer Motion**: Cards scale up from 0.9 → 1.0 with fade-in on scroll, staggered 100ms.

---

#### SECTION 8: Security & Pricing — "Built for Security. Ready for Scale." (id="security", id="pricing")

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│     ── SECURITY & SCALE ──                                           │
│                                                                      │
│     BUILT FOR SECURITY. READY FOR SCALE.                             │
│                                                                      │
│     JustCmul8 is a scalable SaaS platform with enterprise-grade     │
│     security and a tiered pricing model.                             │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  ENTERPRISE-GRADE SECURITY                                       │ │
│  │                                                                  │ │
│  │  🔒 DATA ISOLATION          🛡️ AUTHENTICATION                    │ │
│  │  Strict Multi-Tenant        Mandatory secure auth with           │ │
│  │  model. Your projects,      Multi-Factor Authentication          │ │
│  │  results, and assets are    (MFA) support. OAuth via             │ │
│  │  invisible to all other     Google & GitHub.                     │ │
│  │  users. Row-Level                                                │ │
│  │  Security enforced.         🔐 ENCRYPTION                       │ │
│  │                             All communication via TLS/SSL.       │ │
│  │                             Data encrypted at rest.              │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│     ── PRICING ──                                                    │
│                                                                      │
│     CHOOSE YOUR TIER                                                 │
│                                                                      │
│  ┌────────────────┐  ┌─────────────────────┐  ┌──────────────────┐  │
│  │                │  │   ★ RECOMMENDED      │  │                  │  │
│  │  FREE          │  │                     │  │  ENTERPRISE      │  │
│  │                │  │  PRO                │  │                  │  │
│  │  $0/mo         │  │                     │  │  Custom Quote    │  │
│  │                │  │  $29/mo             │  │                  │  │
│  │  • 1 Active    │  │                     │  │  • Unlimited     │  │
│  │    Project     │  │  • Unlimited        │  │    Projects      │  │
│  │  • Full visual │  │    Projects         │  │  • SSO           │  │
│  │    builder     │  │  • Priority         │  │    integration   │  │
│  │  • Real-time   │  │    execution        │  │  • Full team     │  │
│  │    execution   │  │  • Custom sprite    │  │    collaboration │  │
│  │  • Standard    │  │    uploads          │  │  • Dedicated     │  │
│  │    KPIs        │  │  • Advanced KPI     │  │    compute       │  │
│  │  • AI Chat     │  │    exports (CSV,    │  │    resources     │  │
│  │    (limited)   │  │    PNG, JSON)       │  │  • Priority      │  │
│  │                │  │  • Unlimited AI     │  │    support       │  │
│  │                │  │    Chat             │  │                  │  │
│  │  [GET STARTED] │  │                     │  │  [CONTACT US]    │  │
│  │                │  │  [UPGRADE TO PRO]   │  │                  │  │
│  └────────────────┘  └─────────────────────┘  └──────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Visual Treatment:**
- **Security block**: Wide `glass-panel` card. Two columns: Data Isolation (left) and Auth + Encryption (right). Lock/shield icons in `neon-cyan`. Descriptions in `text-secondary`.
- **Pricing cards**: 3 cards side by side.
  - **Free**: `glass-panel`, standard border. CTA: `btn-cyber-ghost`.
  - **Pro** (center, slightly raised/larger): `glass-panel` with brighter `border-cyan/40` and `★ RECOMMENDED` badge in `neon-cyan`. CTA: `btn-cyber-primary` with `pulse-glow`.
  - **Enterprise**: `glass-panel`, `border-magenta/20`. CTA: `btn-cyber-ghost` with magenta tint.
- Pricing values: **Orbitron 700**, large, `text-primary`. Features list: **Inter 400**, `text-secondary`, with `•` bullet points.
- **Framer Motion**: Security card fades in, then 3 pricing cards stagger up from below.

---

#### SECTION 9: Footer

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ⬡ JUSTCMUL8                           Features · Engine · Pricing  │
│                                                                      │
│  The no-code simulation engine.         [GitHub] [Twitter]           │
│  © 2025 JustCmul8. All rights reserved.                             │
│                                                                      │
│  ─────────────────────────────────────────────────── neon line ───── │
└──────────────────────────────────────────────────────────────────────┘
```

**Visual Treatment:**
- `bg-secondary` background (#0d0d15). Top border: 1px `gradient-primary` (cyan → purple).
- Logo: **Orbitron**, `text-secondary`. Tagline below.
- Right column: nav links + social icons. All `text-muted` → `text-cyan` on hover.
- Copyright: **JetBrains Mono**, small, `text-muted`.

### 1.4 — Supabase Auth

#### [NEW] `lib/supabase/client.ts` + `lib/supabase/server.ts`
#### [NEW] `app/login/page.tsx` + `app/signup/page.tsx`
- Cyberpunk-themed auth forms: glass panels, neon borders, terminal-style inputs.
#### [NEW] `middleware.ts`

### 1.5 — Dashboard

#### [NEW] `app/dashboard/page.tsx`
- Cyberpunk dashboard: glass cards for projects, neon type badges.
- "New Simulation" modal: select from 5 types with animated cyberpunk icons.

#### [NEW] Supabase Schema
```sql
create table projects (...);  -- same as v5
create table chat_history (...);  -- same as v5
```

---

## Phase 2: Node Editor + Viewport + AI Chat

### 2.1 — Workspace Layout
- Cyberpunk-themed 4-panel workspace (palette, canvas, viewport, AI chat).
- Cyber-grid canvas background with neon node cards.

### 2.2 — Node Library (Core + Advanced)
- 15 node types, each with cyberpunk-styled cards and colored accent borders.
- Glow state changes during simulation (idle/busy/bottleneck).

### 2.3 — Sprite Asset Picker
- Glass modal with sprite grid filtered by sim type + node type.

### 2.4 — Live Viewport Sync
- Pixi.js viewport with cyber-grid background + scanline overlay.

### 2.5 — AI Chat Panel (Gemini)
- Terminal-style glass panel on the right.
- JetBrains Mono input with blinking cursor.
- Streamed responses with cyan/purple message bubbles.
- Graph generation with staggered build animation.

### 2.6 — Persistence
- Auto-save graph + viewport config + chat history to Supabase.

---

## Phase 3: Simulation Engine — *Pyodide & SimPy*

### 3.1 — Web Worker + Transpiler
- `public/workers/pyodide-worker.js` — Pyodide + SimPy in Web Worker.
- `lib/simulation/transpiler.ts` — React Flow JSON → Python/SimPy.

### 3.2 — Live Feedback
- Node editor: cyberpunk glow states (pulsing, color changes).
- Viewport: animated entities with neon outlines.
- AI can trigger and summarize simulation runs.

---

## Phase 4: KPI Dashboards

### 4.1 — Results Dashboard
- Recharts with neon cyberpunk color palette.
- Glass panel backgrounds, JetBrains Mono values.
- Bottleneck: red pulse glow on identified node.

### 4.2 — AI Insights
- Ask AI: "What are the bottlenecks?" → contextualized analysis.

### 4.3 — Export
- CSV, PNG, JSON.

---

## Phase 5: Payments & Tiers *(Deferred)*

> [!NOTE]
> Added later when the core product is ready.

- Stripe integration, subscription schema, tier enforcement.

---

## Phased Delivery

| Phase | Contents | Checkpoint |
|---|---|---|
| **Phase 1 + 2** | Shell + Cyberpunk theme + Auth + Dashboard + Node editor + Viewport + AI Chat | ✅ **First review** |
| **Phase 3** | Pyodide/SimPy engine + transpiler + live animation | Engine review |
| **Phase 4** | KPI dashboards + export + AI insights | Analytics review |
| **Phase 5** | Stripe payments + subscription tiers | When ready |

---

## Verification Plan

### After Phase 1+2
- `npm run build` — zero errors.
- `npm run dev` and verify:
  - ✅ Cyberpunk preloader animation.
  - ✅ Landing page: glitch hero, cyber-grid, glassmorphism cards, neon glows, Orbitron headings.
  - ✅ Fixed cyberpunk background visible behind all scrollable page sections.
  - ✅ Lenis smooth scroll with inertia active site-wide.
  - ✅ Navbar: floating centered HUD, corner-bracket borders, glassmorphism on scroll.
  - ✅ Navbar: auth-aware — LOGIN/GET STARTED for guests, DASHBOARD/LOGOUT for users.
  - ✅ Navbar consistent across landing, dashboard, login, signup pages.
  - ✅ `GlitchText` delay offsets — logo and heading glitch at different times.
  - ✅ Corner-bracket system on all buttons (primary, ghost, danger) and cards.
  - ✅ Auth: Supabase login/signup with cyberpunk-styled forms.
  - ✅ Dashboard: project list, new sim modal with type selection, uses shared Navbar.
  - ✅ Workspace: Node editor with cyberpunk nodes → sprite picker → viewport sync.
  - ✅ AI Chat: Gemini generates graph from description → canvas + viewport populate.
  - ✅ Auto-save to Supabase.

---

## 🧩 Reusable Component Library (Design System)

All patterns are captured as reusable components. Any new page can compose from these building blocks.

### React Components

| Component | File | Props |
|---|---|---|
| `<GlitchText>` | `src/components/ui/GlitchText.tsx` | `intensity`, `delay`, `active` |
| `<GlassCard>` | `src/components/ui/GlassCard.tsx` | `heavy`, `notched`, `hover`, `accentColor`, `as` |
| `<JustCmul8Icon>` | `src/components/ui/JustCmul8Icon.tsx` | `className` |
| `<Navbar>` | `src/components/layout/Navbar.tsx` | *(none — fully self-contained, auth-aware)* |

### Global CSS Utility Classes

| Class | Purpose |
|---|---|
| `.btn-cyber-primary` | Primary CTA button — corner brackets, cyan, pulse-glow |
| `.btn-cyber-ghost` | Ghost button — dim brackets, muted text |
| `.btn-cyber-danger` | Danger/destructive button — red bracket variant |
| `.animate-pulse-glow` | Breathing neon box-shadow animation |
| `.glass-panel` | Standard glassmorphism panel |
| `.glass-panel-heavy` | Heavier blur glassmorphism for modals |
| `.card-cyber` | Corner-bracket card (no full border) |
| `.notched-card` | Diagonal clip-path corner cut (16px) |
| `.notched-card-sm` | Diagonal clip-path corner cut (10px) |
| `.cyber-grid` | Animated scrolling dot grid overlay |
| `.text-glow-cyan` | Static cyan text shadow |
| `.hover-glow-cyan` | Glow box-shadow on hover |
| `.animate-float` | Gentle vertical float animation |

### New Page Template

```tsx
import Navbar from "@/components/layout/Navbar";

export default function NewPage() {
  return (
    <div className="min-h-screen relative" style={{ background: "var(--bg-primary)" }}>
      <div className="fixed inset-0 cyber-grid opacity-10 pointer-events-none" />
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 pt-24 pb-16">
        {/* content using GlassCard, GlitchText, btn-cyber-* */}
      </main>
    </div>
  );
}
```
