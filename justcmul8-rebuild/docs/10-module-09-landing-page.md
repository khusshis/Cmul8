# Module 09: Landing Page

## Overview
The Landing Page is the public-facing entry point of JustCmul8. It serves as a marketing showcase to introduce the product's capabilities, target audience (Citizen Modelers), and core technologies (React Flow, WebAssembly, Pixi.js, Gemini AI).

The entire landing page sits on a deep void black background (`#0a0a0f`) with a subtle animated cyan grid (`cyber-grid`) overlay and CRT scanline effects to strictly adhere to the Cyberpunk design theme.

## Architecture

The Landing Page is structured as a vertically scrolling single-page marketing site (`src/app/page.tsx`), divided into several specialized section components located in `src/components/landing`.

### Core Sections

1. **HeroSection (`HeroSection.tsx`)**
   - The primary above-the-fold component.
   - Features the `JUSTCMUL8` logo with high-intensity chromatic aberration via the `<GlitchText>` component.
   - Includes primary CTAs linking to `/signup` and `/login`.
   - Utilizes `framer-motion` for a staggered fade-slide-up entrance.

2. **System Status Ticker (`TickerSection.tsx`)**
   - A full-width marquee ribbon providing a "tactical terminal" aesthetic.
   - Uses `JetBrains Mono` and CSS infinite marquee animations to scroll mock system stats horizontally.

3. **Features — "Model Anything. Code Nothing." (`FeaturesSection.tsx`)**
   - Introduces the "Block" (formerly Node) primitives used in the simulation engine.
   - Splits into a Bento-box layout: Core Primitives (Green `⬢`) and Advanced Logic Blocks (Yellow `⚡`).
   - Replaced all visual instances of the term "Node" with "Block" to align with the rebuilt application terminology.

4. **Simulation Types (`SimTypesSection.tsx`)**
   - Displays interactive glass cards for each supported simulation domain (Human Queue, Vehicle, Liquid, Manufacturing, Logistics).
   - Showcases the Pixi.js viewport aesthetic variations that correspond to the engine selection.

5. **AI Co-Pilot (`AISection.tsx`)**
   - A dedicated feature highlight detailing the Gemini integration.
   - Contains an animated mock terminal demonstrating the AI taking a prompt ("Create a hospital ER...") and outputting a simulated graph structure over time.

6. **Engine Capabilities (`EngineSection.tsx`)**
   - Highlights the core technical achievements: WebAssembly (Pyodide) compilation, Real-time Bottleneck Detection, and the Pixi.js GPU viewport.

7. **Security & Pricing (`SecurityPricingSection.tsx`)**
   - Outlines the dual-tier pricing model (Free vs Pro).
   - Communicates Supabase-backed security (Row Level Security).

## Shared UI Primitives

To support the cyberpunk aesthetic consistently across the landing page, the following reusable UI primitives were ported:

- **`GlassCard`**: A wrapper providing a blurred glassmorphism backdrop (`rgba(0,0,0,0.4)`), optional notched corners (`clip-path`), and cyan hover glow effects.
- **`GlitchText`**: A React wrapper component that renders duplicating text layers with offset RGB text-shadows and CSS keyframe animations, giving a digital distortion effect.

## Layout Components

- **`Navbar`**: Floating, auth-aware header. Shows Login/Sign Up for guests, and Dashboard/Logout for authenticated users. Implements corner-bracket borders.
- **`PreLoader`**: A full-screen initialization sequence displayed before the main application mounts. Provides a fake boot-sequence with a loading progress bar to immerse the user immediately into the theme.

## Dependencies

- **Framer Motion**: Heavy usage for scroll-triggered viewport reveals (`whileInView`).
- **Lucide React**: Provides all iconography (e.g., `Cpu`, `Activity`, `Shield`).
- **React Lenis**: (Wrapper defined in root layout) Provides physics-based smooth scrolling inertia to the entire page.
