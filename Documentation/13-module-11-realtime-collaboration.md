# Module 11: Real-Time Collaboration

## Purpose
Enables multiplayer collaboration on the simulation canvas. Multiple users can see each other's live cursor positions and see nodes/edges update instantly as they are added or moved.

## Files Owned
| File | Role |
|---|---|
| `src/lib/realtime/usePresence.ts` | The core React hook wrapping Supabase Realtime functionality. Tracks users, manages the channel subscription, and exposes broadcast/receive primitives. |
| `src/components/workspace/LiveCursor.tsx` | UI component that renders a remote user's cursor as an SVG with their colored name tag. |

## Algorithm / Logic
- **Presence Sync:** On mount, `usePresence` connects to a channel named `project:[projectId]`. It registers the local user using `channel.track()` and maintains a list of `remoteUsers` via the `presence_sync` event.
- **Broadcasting:** When nodes, edges, or cursors move locally, `broadcastOp()` sends a custom `graph-op` message over the channel containing the updated payload.
- **Throttling:** Cursor movements are throttled via `requestAnimationFrame` and a ref flag to prevent channel flooding.
- **Echo Guard:** When a remote update is received (`onRemoteOp`), the raw state setters (`onUpdateNodes` / `onUpdateEdges`) are invoked directly. This prevents triggering the `handleNodesChange` functions that would otherwise re-broadcast the same changes and cause an infinite ping-pong loop.

## Gaps Flagged & Addressed
- **Gap 10:** No Real-Time Collaboration existed in the original codebase. Implemented fully in Phase 3.

## Connections
- **Module 3 (Visual Graph Editor):** The realtime layer acts as an invisible wrapper inside the Workspace `page.tsx` intercepting and propagating React Flow state changes.

## DB Tables & RLS
- **No dedicated tables:** Supabase Realtime channels are memory-only pub/sub systems. 
- **Security:** In this implementation, the realtime channel relies on the client's session. Users can only broadcast changes if they are authenticated and authorized to view the project (which is governed by the `projects` table RLS).
