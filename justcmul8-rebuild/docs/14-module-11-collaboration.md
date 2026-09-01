# Module 11: Real-Time Collaboration

## Overview
The Real-Time Collaboration module represents the most technically ambitious future addition to JustCmul8. Inspired by collaborative platforms like Figma and Miro, this module allows multiple Citizen Modelers to simultaneously view, edit, and run the same simulation graph in real-time.

## Proposed Architecture

### 1. Supabase Realtime (WebSockets)
- The module will leverage the **Supabase Realtime API** (specifically Broadcast and Presence features) built on Elixir and WebSockets.
- **Presence**: Tracks who is currently active in the workspace.
- **Broadcast**: Ephemeral, high-frequency state changes (like cursor movements) are broadcasted directly between clients without touching the Postgres database, minimizing latency.

### 2. State Synchronization
- **Graph Edits**: When a user drags a block, connects an edge, or modifies a parameter in the Block Configuration Panel, the changes are emitted via WebSockets.
- **Conflict Resolution**: Zustand state management will be augmented with CRDTs (Conflict-free Replicated Data Types) like Yjs or Automerge to ensure that simultaneous edits to the same block do not result in a corrupted graph state.

### 3. Synchronized Simulation Execution
- If User A clicks "Run", the simulation state must sync across all clients.
- The `SimGraph` payload is locked, the engine executes, and the resulting `SimTick` logs are broadcasted so that all users watch the Pixi.js 2D viewport animate in perfect synchronization.

## Design Integration (Professional Light Theme)
- **Multiplayer Cursors**: Each collaborator's mouse cursor will be rendered on the React Flow canvas. 
- **Collaborator Colors**: Each user will be assigned a distinct color that is legible against the light canvas background (`var(--color-surface-sunken)`), such as `var(--color-info)`, `var(--color-success)`, or `var(--color-accent)`.
- **Presence Avatars**: The top-right of the Navbar will display a row of active users. These will be rendered as clean, circular avatars with an outer ring matching their assigned color.
