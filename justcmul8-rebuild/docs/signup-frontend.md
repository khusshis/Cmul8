# Signup Frontend Documentation

## Overview
The `/signup` page was rebuilt to provide a pixel-perfect, highly aesthetic split-pane UI inspired by the design system of JustCmul8. It serves as the gateway for users to join the discrete event simulation platform.

## Layout Structure
The page uses a standard 2-column layout on desktop, collapsing to a single column on mobile (`md:flex-row`):
- **Container**: `min-h-screen bg-[#F7F7FA]` with a centered, rounded `max-w-[1400px]` inner card.
- **Left Panel (Information/Branding)**: 
  - Gradient background (`from-[#EFEBFB] to-[#F8F7FC]`).
  - Contains the JustCmul8 logo, optimized copywriting, a custom flex/SVG-based flow diagram representing a Source -> Queue -> Server -> Sink simulation, and floating metric cards.
  - *Note: Hidden on mobile views to prioritize the form and reduce clutter.*
- **Right Panel (Form)**:
  - White background.
  - Houses the Supabase-integrated signup form with Material-style floating labels.

## Styling Details (Tailwind)
The UI heavily utilizes Tailwind CSS utility classes with some custom hex colors to match the exact design tokens:

- **Primary Brand Color**: `#6C5CE7` (Indigo/Purple)
- **Background Gradient**: `bg-gradient-to-b from-[#EFEBFB] to-[#F8F7FC]`
- **Text Colors**: `#111827` (Primary), `#6B7280` (Secondary/Gray)
- **Nodes Colors**:
  - Source: `#8B7CF6`
  - Queue: `#5B93F0`
  - Server: `#2FD1B4`
  - Sink: `#E4DEFB` (text `#6C5CE7`)
- **Success/Metrics**: `#10B981` (Green)

## Components Used
- `lucide-react` icons: `Mail`, `Lock`, `Eye`, `EyeOff`, `Users`, `Layers`, `Server`, `Flag`, etc.
- Custom SVG path with `preserveAspectRatio="none"` and `vectorEffect="non-scaling-stroke"` for responsive flow diagram connection lines.
- SVG donut chart for the Utilization metric card.
- **Reusable UI Components**:
  - `AuthDiagram`: Extracts the entire left-panel animated simulation diagram into a reusable component.
  - `FloatingInput`: A pill-shaped (`rounded-full`) text input that implements a Material Design floating label which scales and transitions to sit on the top border on focus/type.

## Mobile Responsiveness & Polish
- **Layout**: Switches from a two-panel side-by-side view to a stacked, single-column view on mobile screens.
- **Form UI**: All inputs and primary buttons are perfectly pill-shaped (`rounded-full`).
- **OAuth Buttons**: On mobile, the Google and GitHub OAuth buttons elegantly collapse into circular icons side-by-side to save vertical space. On desktop, they expand into full-width buttons with text labels.
- **Parity**: The exact same layout, animations, and reusable components are cloned to the `/login` page to ensure a perfect 1:1 consistent experience.

## State Management (Preserved)
No backend logic was modified. The UI securely binds to the existing React state for:
- `email`, `password`
- `loading`, `error`, `success`
- `showPw` (for password visibility toggle)
- Connects to Supabase via `handleSignup` and `handleOAuth`.
