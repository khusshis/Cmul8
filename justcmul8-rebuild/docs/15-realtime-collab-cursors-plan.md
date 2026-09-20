# Mega Plan: Figma/Canva-Style Realtime Collaborative Cursors & Node Co-Editing

> Handoff document for an autonomous coding agent (e.g. Antigravity) working in this
> repo (`justcmul8-rebuild`, Next.js 16 + React 19 + `@xyflow/react` + Supabase).
> Goal: two or more users open the same project (`/dashboard/project/[id]`) and see
> each other's live cursors, selections, and edits on the canvas — including both
> editing the **same node** at the same time without clobbering each other.

---

## 0. Current State Audit (read this before writing any code)

Realtime collaboration is **partially built**, not greenfield. Do not re-architect
from scratch — extend what exists.

| Piece | File | Status |
|---|---|---|
| Presence channel (join/leave, colors) | [src/lib/realtime/usePresence.ts](../src/lib/realtime/usePresence.ts) | Working |
| Broadcast for node/edge changes | `usePresence.ts` (`broadcastOp`/`onRemoteOp`) | Working, but see bugs below |
| Cursor rendering | [src/components/workspace/LiveCursor.tsx](../src/components/workspace/LiveCursor.tsx) | Working but dumb (no interpolation, no viewport awareness) |
| Wiring into the workspace page | [src/app/dashboard/project/[id]/page.tsx](../src/app/dashboard/project/[id]/page.tsx) (lines ~88-93, ~180-198, ~552-565, ~619-649) | Working for drag/connect, missing for param edits |
| Node rendering / selection ring | [src/components/workspace/NodeCanvas.tsx](../src/components/workspace/NodeCanvas.tsx) `SimNode` (~line 348-500) | No remote-presence awareness at all |
| Param editing UI | [src/components/workspace/NodePropertiesPanel.tsx](../src/components/workspace/NodePropertiesPanel.tsx) | `onUpdate` calls are **local-only**, never broadcast |
| Design vision doc (already written, aspirational) | [docs/14-module-11-collaboration.md](14-module-11-collaboration.md) | Superset of this plan; CRDT/Yjs mentioned there is explicitly **out of scope** for this plan (see §7) |

### Known bugs to fix as part of this work

1. **Param edits don't sync.** In `page.tsx`, `NodePropertiesPanel`'s `onUpdate` prop
   (line ~704-708) only calls `onUpdateNodes(...)` — it never calls `broadcastOp`.
   Two users editing the Properties panel on the same node will silently diverge
   until the next drag/connect event forces a resync (which won't happen — there's
   no periodic full-state reconciliation either). **This is the #1 fix**, since it's
   the literal "two people interacting with one node" scenario the user asked for.
2. **Cursor coordinates are screen-space, not flow-space.** `page.tsx` (~line 619-630)
   computes cursor position as `clientX - bounds.left` relative to the wrapper div
   and broadcasts that raw. If User A and User B have different pan/zoom on the
   React Flow viewport (extremely likely — each user pans/zooms independently),
   User A's cursor will render in the wrong place on User B's screen relative to
   the actual nodes. Must convert to flow-space coordinates before broadcast, and
   convert back to each viewer's own screen-space on render.
3. **No remote selection/focus indication on nodes.** `SimNode` only knows about its
   *own* client's `selected` prop from React Flow. There's no concept of "node X is
   currently selected/being edited by remote user Y" — the actual Figma-style
   "presence on an object" feature — so this needs new state.
4. **No stale-presence cleanup.** If a tab crashes instead of unmounting cleanly,
   `channel.unsubscribe()` never runs. Supabase Presence has its own server-side
   timeout for this, but confirm behavior (§5.4) rather than assuming.
5. **Cursor broadcast has no idle/leave handling** — a user's ghost cursor can
   linger at its last position if they move their mouse off the canvas and Supabase
   presence sync doesn't immediately clear `.cursor`. Needs an explicit
   `mouseleave` broadcast of `cursor: undefined`.

---

## 1. Scope for this plan

In scope (do all of this):
- Flicker-free, viewport-correct multiplayer cursors (Figma-style).
- Remote user name labels on cursors (already exists, just needs the coordinate fix).
- Visual indication on a **node** when another user has it selected or is actively
  editing its parameters (colored ring + small avatar chip on the node, like Figma's
  colored selection outline + avatar).
- Full realtime sync of node **parameter edits** from the Properties panel, not just
  drag/connect/delete.
- Presence avatar stack in the toolbar (already exists — polish only).
- Two users can select/inspect the *same* node simultaneously without one
  overwriting the other's in-flight edit (last-write-wins per field, not per whole
  node object — see §3.4).

Out of scope for this plan (explicitly deferred, do not attempt unless asked):
- True CRDT (Yjs/Automerge) conflict resolution — mentioned as "proposed future" in
  `docs/14-module-11-collaboration.md` but is overkill for this feature; last-write-wins
  with field-level granularity + presence-based soft locking is sufficient for a
  small-group collaborative canvas and is what Figma effectively does under the hood
  for simple property edits anyway.
- Synchronized simulation playback (§ in the same doc) — separate feature, separate plan.
- Comments/annotations, version history, @mentions.

---

## 2. Architecture decisions

### 2.1 Transport
Keep using **Supabase Realtime** — one channel per project (`project:${projectId}`),
already established in `usePresence.ts`. Do not introduce a second transport (no raw
WebSocket server, no Yjs provider). Two logical message types already exist and are
sufficient:
- `presence` (who's online — id, name, color, and now: `selectedNodeId`, `editingNodeId`)
- `broadcast` event `graph-op` (ephemeral high-frequency ops: cursor moves, node
  changes, edge changes, param changes)

### 2.2 Coordinate system for cursors
Broadcast cursor position in **React Flow coordinate space** (i.e.
`reactFlowInstance.screenToFlowPosition({x, y})`), not raw pixel offsets. Each
client independently converts incoming flow-space coordinates back to their own
screen space with `reactFlowInstance.flowToScreenPosition(...)` (or
equivalent — confirm exact API name against the installed `@xyflow/react` version,
see §5.1) at render time. This makes cursors render correctly regardless of each
user's individual pan/zoom state — this is the single most important correctness
fix in this plan.

### 2.3 Presence-based "who's on this node" instead of locking
Do not implement hard locks (no one is blocked from editing anything). Instead:
- When a user selects a node, broadcast `selectedNodeId` via **presence** (part of
  the tracked payload, not a broadcast event — presence is the right primitive here
  since it's a durable "current state" fact, not an ephemeral event).
- When a user has the Properties panel open/focused for a node, broadcast
  `editingNodeId` similarly.
- Every client renders a colored ring + tiny avatar badge on any node that appears
  in another user's `selectedNodeId`/`editingNodeId`, using that user's assigned
  color (`CURSOR_COLORS` already exists in `usePresence.ts`).
- Field-level edits still last-write-wins (see §3.4) but the visual presence cue is
  what prevents users from *accidentally* colliding — same UX contract as Figma.

### 2.4 Throttling / interpolation
- Cursor broadcast: keep the existing `requestAnimationFrame` throttle in `page.tsx`
  (already reasonable), but confirm it's not exceeding ~20-30 msg/s per user.
- Cursor rendering: add CSS transform transition (short, e.g. 60-80ms ease-out) in
  `LiveCursor.tsx` so remote cursors glide rather than jump between broadcast
  frames — partially present already (`transition-transform duration-75`), verify
  it's actually applied to the transform that changes (it currently is — keep it,
  just don't regress it when you touch coordinate math).

---

## 3. Step-by-step implementation

### 3.1 Fix cursor coordinate space (bug #2)

Files: `page.tsx`, `LiveCursor.tsx`, `usePresence.ts` (types only).

1. In `page.tsx`, the canvas wrapper's `onMouseMove` handler (~line 619-630)
   currently does:
   ```ts
   broadcastOp({ kind: "cursor", changes: [{ x: e.clientX - bounds.left, y: e.clientY - bounds.top }] });
   ```
   Replace with a flow-space conversion using the `useReactFlow()` instance. Note
   `page.tsx` doesn't currently hold a `ReactFlowInstance` reference — it's inside
   `InnerCanvas` in `NodeCanvas.tsx` (~line 642: `const { fitView, setNodes, setEdges } = useReactFlow();`).
   Two viable approaches — pick one and be consistent:
   - **(A, preferred)** Move the `onMouseMove` cursor-broadcast logic *into*
     `NodeCanvas.tsx`'s `InnerCanvas` (which already has `useReactFlow()`), and add
     a `broadcastCursor` callback prop passed down from `page.tsx`, since
     `broadcastOp` is already owned by `page.tsx` via `usePresence`. `InnerCanvas`
     calls `screenToFlowPosition({x: e.clientX, y: e.clientY})` and invokes the
     callback with flow coordinates.
   - **(B)** Keep the handler in `page.tsx` but obtain a `ReactFlowInstance` by
     passing a ref down through `NodeCanvasHandle` (already an imperative handle
     pattern used for `canvasRef.current?.addNode`, see line 83, 616) — add a
     `screenToFlow`/`flowToScreen` method to that handle.
   Prefer (A): it keeps React Flow API usage co-located with the `ReactFlowProvider`
   subtree and avoids threading more imperative-handle surface area.
2. Update `GraphOp["changes"]` cursor payload shape in `usePresence.ts` to carry
   flow-space `{x, y}` (type is already loose `any[]`, but add a proper
   `CursorPos = {x: number; y: number}` type for clarity).
3. On the receiving side, wherever `LiveCursor` is rendered (`page.tsx` ~line
   645-647), convert the stored flow-space cursor back to *this* client's screen
   space before passing `x`/`y` to `LiveCursor`. This also needs access to the
   `ReactFlowInstance` at the render site — same threading consideration as above;
   simplest fix is to render `LiveCursor` markers *inside* `NodeCanvas`'s
   `InnerCanvas` (which already has the RF instance) as an absolutely-positioned
   overlay layered above the `<Background>`/`<Controls>` but below UI chrome,
   rather than in the outer wrapper div in `page.tsx`. This means moving the
   `remoteUsers.filter(...).map(...)` cursor-rendering block from `page.tsx` into
   `NodeCanvas.tsx`, passing `remoteUsers` down as a prop.
4. Add a `onMouseLeave` handler alongside `onMouseMove` that broadcasts
   `{ kind: "cursor", changes: [{ x: null, y: null }] }` (or a distinct
   `leave` flag) so `usePresence`'s handler can clear `.cursor` for that user
   instead of leaving a ghost cursor at the last known position (bug #5).

### 3.2 Node-level remote presence (selection + editing rings)

Files: `usePresence.ts`, `NodeCanvas.tsx` (`SimNode`), `page.tsx`.

1. Extend `PresenceUser` in `usePresence.ts`:
   ```ts
   export interface PresenceUser {
     id: string;
     name: string;
     color: string;
     cursor?: { x: number; y: number };
     selectedNodeId?: string | null;
     editingNodeId?: string | null;
   }
   ```
2. Add a method to `usePresence`'s return value, e.g. `updatePresence(partial: Partial<PresenceUser>)`,
   that calls `channel.track({...currentTrackedPayload, ...partial})`. This needs
   `usePresence` to keep the last-tracked payload in a ref (it currently only
   tracks once on `SUBSCRIBED`, at line 58) so subsequent updates merge rather than
   clobber `id`/`name`/`color`.
3. In `page.tsx`'s `handleSelectNode` (~line 200-203), after `setSelectedNodeId(id)`,
   call `updatePresence({ selectedNodeId: id })`.
4. In `NodePropertiesPanel`, when it mounts/receives a new `node` prop (i.e. the
   panel is actively showing a node's config), the parent (`page.tsx`) should call
   `updatePresence({ editingNodeId: node.id })`; when the panel is unmounted /
   switched away (user switches to "AI Assistant" tab, or `activeRightPanel`
   changes, or `selectedNodeId` becomes null), call
   `updatePresence({ editingNodeId: null })`. Wire this via a `useEffect` in
   `page.tsx` keyed on `[selectedNodeId, activeRightPanel]`.
5. In `NodeCanvas.tsx`, pass `remoteUsers: PresenceUser[]` down to `SimNode` (via
   the `nodeTypes` mapping — React Flow custom nodes receive `data`, so the
   simplest approach is to compute, in `InnerCanvas`, a `Map<nodeId, PresenceUser[]>`
   of "who has this node selected/being edited" and inject it into each node's
   `data.remotePresence` before passing to React Flow's `nodes` prop, OR use
   React Flow's node `data` update pattern already used elsewhere in this file).
   Confirm which pattern the codebase already uses for per-node computed data
   (e.g. how `bottleneckNodeId` prop, referenced at line 637, is threaded into
   `SimNode` — follow that exact existing convention for consistency rather than
   inventing a new one).
6. In `SimNode` (~line 428-435), extend the className/style logic that currently
   handles `selected` (local) to also render a ring when `remotePresence` is
   non-empty:
   - Selection ring color = the remote user's `color` (reuse the `ring-2` pattern
     already used for local selection, but with an inline `style` for
     `boxShadow`/`borderColor` since Tailwind can't do dynamic per-user colors).
   - If multiple remote users have it selected, pick the first (or stack rings —
     keep it simple, first is fine for v1).
   - Render a small circular avatar chip (reuse the same avatar-circle markup
     already used in the toolbar presence stack, `page.tsx` ~line 552-565) pinned
     to a corner of the node (e.g. `absolute -top-2 -left-2`, mirroring how the
     delete button is already pinned `-top-2.5 -right-2.5` at line 496).
   - Distinguish "selected" (thin ring) vs "editing" (solid ring + pulsing
     avatar or a small pencil icon) so users can tell at a glance whether someone
     is just looking or actively typing into that node's params.

### 3.3 Broadcast param edits (bug #1 — the core ask)

Files: `page.tsx`, `usePresence.ts`.

1. In `page.tsx`, the `NodePropertiesPanel`'s `onUpdate` callback (~line 704-708)
   currently:
   ```ts
   onUpdate={(id, partialData) => {
     onUpdateNodes((prev) =>
       prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...partialData } } : n))
     );
   }}
   ```
   Change this to *also* broadcast the change. Reuse the existing `"nodes"` op kind
   with a synthetic React Flow `NodeChange` isn't quite right (React Flow's
   `NodeChange` types are for position/selection/dimensions/add/remove, not
   arbitrary data patches). Instead, add a new `GraphOp.kind`: `"nodeData"`, whose
   `changes` is `[{ id, partialData }]`. Update `GraphOp` in `usePresence.ts`
   accordingly, and add a case for it in the `onRemoteOp` handler switch in
   `page.tsx` (~line 180-188) that applies the same `prev.map(...)` merge shown
   above, and in `usePresence.ts`'s internal broadcast listener (~line 42-54) make
   sure `"nodeData"` isn't accidentally treated as a cursor op (the current
   `if (payload.kind === "cursor") {...} else if (opHandlerRef.current) {...}`
   branch already generalizes to any non-cursor kind, so this should just work —
   confirm by testing, don't assume).
2. **Debounce, don't broadcast per-keystroke.** Some `NodePropertiesPanel` inputs
   fire `onUpdate` on every keystroke (e.g. numeric fields, label text — check
   lines 461, 625, 688, 773, 815, 832, 846, 853, 884, 927 for the various
   `onUpdate` call sites). Broadcasting on every keystroke will flood the channel
   and cause visible jank for remote viewers as the field rewrites on every
   character. Add a debounce (150-250ms, trailing) around the broadcast call only
   — local state should still update instantly for the typing user's own
   responsiveness, only the *outbound broadcast* is debounced. A `useRef` + 
   `setTimeout` debounce local to the `onUpdate` wrapper in `page.tsx` is
   sufficient; no need for a library.
3. **Field-level last-write-wins, not whole-node overwrite.** Because
   `partialData` is a shallow merge (`{...n.data, ...partialData}`), two users
   editing *different* fields of the same node concurrently will not clobber each
   other as long as each `onUpdate` call only includes the field(s) that actually
   changed (this is already true today — e.g. line 461 only sends
   `{ params: { ...params, [key]: value } }`, spreading existing params first).
   Verify this invariant holds for every call site listed above — if any call site
   sends a stale full `params` object captured in a closure from before a remote
   update arrived, that would silently revert the other user's concurrent edit to
   a different field. This is the main correctness risk in this whole plan; write
   a manual test for it (see §6, test case 3).

### 3.4 Presence avatar stack polish (minor)

File: `page.tsx` (~line 552-565).

- Already functional. Optional improvements: tooltip shows name (already does via
  `title`), add a subtle "•" online indicator, cap overflow with a `+N` chip
  (currently `.slice(0, 4)` silently drops extras — add a `+{remoteUsers.length - 4}`
  chip when `remoteUsers.length > 4`).

### 3.5 Cleanup / edge cases

- Confirm Supabase project's Realtime settings allow presence + broadcast on this
  channel pattern (check `supabase/schema.sql` and the Supabase dashboard's
  Realtime settings — RLS policies can silently block broadcast if the project has
  Realtime Authorization enabled; if so, the channel config in `usePresence.ts`
  line 30-32 needs `config: { broadcast: { self: false }, presence: { key: selfId } }`
  and possibly a `private: true` channel with proper RLS, depending on Supabase
  project settings — inspect before assuming public channels are enabled).
- Handle `currentUser` display name collisions — currently derived from
  `email.split("@")[0]` (page.tsx line 91), which is fine for now; not in scope to
  add custom display names/avatars.
- On unmount/route away, ensure `channel.unsubscribe()` (already present,
  `usePresence.ts` line 63) fires reliably — also add an `editingNodeId: null`
  presence update on the Properties-panel-close path so a user who navigates away
  mid-edit doesn't leave a stale "editing" ring on the node for other viewers
  (presence `sync`/`leave` events should already clear the whole user on disconnect,
  but confirm timing — there can be a several-second lag before Supabase fires the
  leave event).

---

## 4. Files touched (summary)

- `src/lib/realtime/usePresence.ts` — extend `PresenceUser`, add `updatePresence`,
  add `"nodeData"` op kind, switch cursor payload to flow-space type.
- `src/components/workspace/NodeCanvas.tsx` — move cursor capture + rendering
  in/near `InnerCanvas` where `useReactFlow()` lives; thread `remotePresence` into
  `SimNode`; add selection/editing ring + avatar chip rendering in `SimNode`.
- `src/components/workspace/LiveCursor.tsx` — no structural change needed, just
  confirm it still receives correct (now flow-derived, screen-converted) coordinates.
- `src/app/dashboard/project/[id]/page.tsx` — wire `updatePresence` calls on
  select/edit, debounce param-edit broadcasts, remove the now-relocated cursor
  mousemove/render logic if moved into `NodeCanvas.tsx` per §3.1 option (A).

## 5. Pre-flight checks before coding

1. Confirm exact `@xyflow/react` v12 API names for coordinate conversion —
   `screenToFlowPosition` / `flowToScreenPosition` (or whatever the installed
   version exports; check `node_modules/@xyflow/react/dist/.../types` or the
   bundled docs) rather than assuming v11 names like `project()`/`unproject()`,
   which changed in v12.
2. Re-read `NodeCanvas.tsx` in full (824 lines) before editing — it already has
   nontrivial logic for hover z-index, bottleneck highlighting, and simulation-tick
   visuals on `SimNode` that must not regress.
3. Re-read all `onUpdate(...)` call sites in `NodePropertiesPanel.tsx` (10 sites
   listed in §3.3.3) individually — some may need per-site adjustment to guarantee
   the shallow-merge invariant.

## 6. Test plan (manual — no automated realtime test harness exists in this repo)

Run two browser sessions (e.g. one normal window, one incognito) logged in as two
different accounts, both viewing the same project:

1. Move mouse in window A at various pan/zoom levels (zoom in, pan around) — cursor
   in window B should track correctly over the same visual node, not drift.
2. Select a node in A — B should see a colored ring + avatar chip appear on that
   node within ~200ms; deselect in A — ring disappears in B.
3. **Core scenario**: both A and B select the *same* node, open Properties panel.
   A edits field X, B edits field Y (different fields) concurrently — both fields
   should end up correct on both screens, neither field should revert or flicker.
   Then have both edit the *same* field in quick succession — last write should
   win cleanly (no corrupted/merged value).
4. A drags the node — B sees it move smoothly (already-working path, regression check).
5. Close window B's tab entirely (not navigate) — within a few seconds, A's toolbar
   avatar stack and any selection/editing rings attributed to B should clear.
6. Move mouse off the canvas area in A — B's rendering of A's cursor should
   disappear rather than freeze in place.

## 7. Explicitly not doing (revisit only if asked later)

- Yjs/Automerge CRDT integration (per `docs/14-module-11-collaboration.md`'s
  "proposed architecture" — that doc is aspirational/long-term; this plan's
  presence-based soft-indication + field-level last-write-wins is the pragmatic
  version for the current scale of the app).
- Synchronized simulation run playback across clients.
- Per-field hard locks that block a second user from typing.
- Comment threads / annotations on nodes.
