# Cyberpunk Aesthetics & UI Guidelines

JustCmul8 is designed to have a premium, high-intensity cyberpunk aesthetic. When creating or modifying UI components, follow these design principles:

## 1. Color Palette
- **Backgrounds**: Use deep, dark themes (`var(--bg-primary)`, `var(--bg-secondary)`) such as dark slate, deep blue, or pure black (`bg-black/50`). Avoid bright or pure white backgrounds.
- **Accents (Neon)**: Use vibrant neon colors sparingly but purposefully for active states, highlights, and borders.
  - Cyan (`var(--neon-cyan)`) for primary interaction and structure.
  - Magenta/Pink (`var(--neon-pink)`) for active data/buffers.
  - Yellow (`var(--neon-yellow)`) for warnings or queues.
  - Green (`var(--neon-green)`) for sources and success states.
  - Red (`var(--neon-red)`) for destructors, sinks, and errors.

## 2. Textures & Effects
- **Glassmorphism**: Use semi-transparent backgrounds with borders (e.g., `bg-black/30 border border-cyan-500/20`) to create depth.
- **Glows**: Use subtle drop-shadows or box-shadows to emulate neon glows on active elements (especially on React Flow edges and Node stat badges).
- **Typography**: Utilize monospace fonts (`var(--font-mono)`) for data, logs, and technical inputs. Ensure text contrasts sufficiently against dark backgrounds (`text-gray-400` for labels, `text-white` for values).

## 3. Layout constraints
- The application uses a unified 3-panel dashboard layout. Avoid creating disjointed popups, floating modals (unless strictly necessary for deep config), or secondary viewports. Keep the user in the single-screen flow.
