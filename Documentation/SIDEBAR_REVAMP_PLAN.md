# Block Configuration Sidebar — Revamp Implementation Plan

**Prepared for:** Antigravity, executing sequentially.
**Scope:** Visual revamp of the "Block Configuration" panel (`NodePropertiesPanel.tsx` + its wrapper in `project/[id]/page.tsx`), relocating the AI/Props toggle, and changing the default-panel behavior on node selection. Grounded in the screenshot you shared and the actual live code — including one real bug found while investigating why the fields look unstyled.

## 0. Ground truth — including one concrete bug that explains the screenshot

**Root cause of the "broken-looking" plain-text inputs in your screenshot: `.input-surface` does not exist anywhere in the codebase.**

I checked. `NodePropertiesPanel.tsx` defines:
```ts
const inputCls = "input-surface w-full mt-1";
const selectCls = "input-surface w-full mt-1";
```
and every single field (`Capacity`, `Service Time Mean`, `meanTimeBetweenFailures`, etc.) uses `className={inputCls}`. But `input-surface` is never defined in `src/app/globals.css` (the only CSS file in the project) or anywhere else — grepping the whole `src/` tree, the class is *used* in two files (`NodePropertiesPanel.tsx` and `src/app/settings/page.tsx`) and *defined* in zero. That's why "Capacity" and "Service Time (Mean)" render as bare unstyled numbers with no visible box in your screenshot, while "Service Time Randomness" (a `<select>`) shows a border — that's the browser's own default `<select>` chrome peeking through, not intentional styling; text/number inputs don't get that same default border in this browser/reset combo, so they look broken while selects look "accidentally OK." Phase 1 fixes this at the root — one CSS rule fixes every field in the panel (and also silently fixes the same bug in `settings/page.tsx`, built in an earlier plan, which has the exact same problem).

Also confirmed from the screenshot + code (`ResourceProperties`, lines 193–229):
- "Can interrupt lower-priority work" is a plain `<button>` toggling text between `"YES"`/`"NO"` (line 216) — not a switch control. Revamped in Phase 2.
- The AI/Props toggle pill is positioned `absolute top-4 -left-32` (page.tsx line 564) relative to the right-panel's wrapper `<div className="relative">` — i.e. it floats 128px to the *left* of the panel, over the canvas, near the top. That's exactly the odd top-left placement in your screenshot. Phase 3 moves it to float at the bottom of the sidebar itself.
- `activeRightPanel` defaults to `"ai"` (page.tsx line 50) and nothing currently changes it when a node is selected — `onSelectNode={setSelectedNodeId}` (line 508) only updates which node is selected, never which panel is showing. Phase 4 fixes this.

---

## Phase 1: Fix the root input-styling bug

**File:** `src/app/globals.css`

Step 1. Add a new rule after the existing `.card-surface` block (after line 64):
```css
.input-surface {
  display: block;
  width: 100%;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  padding: 0.5rem 0.75rem;
  font-size: 13.5px;
  color: var(--color-text-primary);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.input-surface::placeholder {
  color: var(--color-text-secondary);
  opacity: 0.7;
}
.input-surface:hover {
  border-color: color-mix(in srgb, var(--color-border) 60%, var(--color-text-secondary));
}
.input-surface:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-soft);
}
.input-surface:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
```
Step 2. This single addition fixes every input/select across both `NodePropertiesPanel.tsx` and `settings/page.tsx` immediately — no changes needed in either component file for this specific bug, since they already reference the class name correctly, it just never existed. Verify in the browser: every number/text field in Block Configuration should now show a light gray bordered box on a slightly sunken (`--color-bg`) background, with a colored focus ring when clicked — matching the one field in your screenshot that accidentally already looked right.
Step 3. Do not use `--color-surface` (white) as the input background — `--color-bg` (the app's very light gray, `#f7f7fa`) is used instead so inputs read as a distinct "well" sunk into the white panel background, rather than blending invisibly into it. This is the standard sunken-field pattern already used elsewhere in the app's premium styling (e.g. `--color-surface-sunken` hover states in `NodePalette.tsx`).

---

## Phase 2: Revamp the panel's visual structure (card-grouped sections, real switches)

### Task 2.1 — Turn flat divided sections into bordered cards

**File:** `src/components/workspace/NodePropertiesPanel.tsx`

Step 1. Replace the shared style constants (current lines 13–18):
```ts
// ─── Common Styles ─────────────────────────────────────────────
const inputCls = "input-surface w-full mt-1";
const selectCls = "input-surface w-full mt-1";
const labelCls = "block text-sm font-medium text-text-secondary";
const sectionCls = "space-y-4 pt-4 border-t border-border";
const sectionHeadingCls = "text-xs font-bold tracking-widest mb-2 flex items-center gap-1.5 text-text-primary uppercase";
```
with:
```ts
// ─── Common Styles ─────────────────────────────────────────────
const inputCls = "input-surface w-full mt-1.5";
const selectCls = "input-surface w-full mt-1.5";
const labelCls = "block text-[12.5px] font-semibold text-text-secondary";
const sectionCls = "space-y-4 rounded-[14px] border border-border/80 bg-surface shadow-sm p-4";
const sectionHeadingCls = "text-[11px] font-bold tracking-widest mb-1 flex items-center gap-1.5 uppercase";
```
Step 2. Update `SectionHeading` (current lines 20–27) to color the icon+text with the section's own accent instead of flat gray, and add a bottom border so it reads as a card header, not just a label floating above fields:
```tsx
function SectionHeading({ icon: Icon, children, accent = "var(--color-accent)" }: { icon: any; children: React.ReactNode; accent?: string }) {
  return (
    <div className={sectionHeadingCls} style={{ color: accent }}>
      <Icon size={13} />
      {children}
    </div>
  );
}
```
Step 3. Because `sectionCls` is now a self-contained bordered card (not a divider that relies on a parent's `space-y-4` to separate it from the next section), the outer container that stacks multiple `XProperties` sections needs its own gap. Find the main exported `NodePropertiesPanel` function's return statement (the switch/dispatch that renders e.g. `<SourceProperties .../>`, `<QueueProperties .../>` in sequence for node types with more than one section) and wrap the sequence in `<div className="space-y-4">...</div>` if it isn't already — confirm by reading how multiple sections currently stack (some node types render just one `XProperties` block, others render more than one in sequence, e.g. a node might show both its own settings and a shared "Advanced" section).
Step 4. Apply this same `SectionHeading`/`sectionCls` change uniformly — it's already referenced by every one of the ~14 `XProperties` sub-components (`SourceProperties`, `QueueProperties`, `ResourceProperties`, `ServiceProperties`, `DecisionProperties`, `SinkProperties`, `ContainerProperties`, `StoreProperties`, `EventTriggerProperties`, and the rest for `priority_resource`, `channel`, `broadcaster`, `any_of`, `all_of`, `interrupter`). Because Step 1–2 only touched the shared constants/component, **every section automatically becomes a bordered card with zero further edits needed** — this is exactly why the panel was built with shared style constants in the first place; do not go and hand-edit each of the 14 functions individually.
Step 5. Per-section accent color: pass the node type's own registry color into `SectionHeading` instead of the default `--color-accent` for every card, so "Worker/Machine Settings" on a Resource node picks up green (`--color-node-resource`), "Processing Settings" on a Service node picks up teal (`--color-node-service`), etc. — reusing the exact same `--color-node-*` tokens already defined in `globals.css` (lines 23–37). Do this by having the top-level `NodePropertiesPanel` function pass `nodeType`'s color down (it already knows `node.data.nodeType` — this is the same prop-threading already required by Task 3.3/3.5 of the earlier `MEGA_IMPLEMENTATION_PLAN.md`, which added a `nodeType` prop to every sub-component for the glossary eyebrow; if that task already landed, reuse the same `nodeType` prop here rather than adding a second one). Add one small lookup: `import { NODE_BASE_COLORS } from "@/components/workspace/NodeCanvas";` (confirm this map is exported from `NodeCanvas.tsx` — it's already used internally there for node border colors per the original build; export it if it's currently a private module-level `const`), then `<SectionHeading icon={Server} accent={NODE_BASE_COLORS[nodeType]}>Worker / Machine Settings</SectionHeading>`.

### Task 2.2 — Replace the YES/NO button with a real toggle switch

**New file:** `src/components/ui/Switch.tsx`

Step 1. Create a small reusable switch, matching the app's pill/rounded-full visual language already used for the Run/Pause toolbar buttons and the dashboard tab pill:
```tsx
"use client";
import React from "react";
import { motion } from "framer-motion";

export default function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative w-10 h-6 rounded-full transition-colors flex-shrink-0"
      style={{ background: checked ? "var(--color-accent)" : "var(--color-border)" }}
      aria-label={label}
    >
      <motion.span
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
        animate={{ x: checked ? 16 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
      />
    </button>
  );
}
```
Step 2. **File:** `src/components/workspace/NodePropertiesPanel.tsx` — replace the `isPreemptive` button (current lines 215–218):
```tsx
<div className="flex items-center justify-between mt-4">
  <label className={labelCls}>Can interrupt lower-priority work</label>
  <button onClick={() => setParam("isPreemptive", !params.isPreemptive)} className={`px-3 py-1 text-xs font-mono rounded ${params.isPreemptive ? "bg-accent text-white" : "bg-surface border border-border text-text-secondary"}`}>
    {params.isPreemptive ? "YES" : "NO"}
  </button>
</div>
```
with:
```tsx
<div className="flex items-center justify-between">
  <label className={labelCls}>Can interrupt lower-priority work</label>
  <Switch checked={!!params.isPreemptive} onChange={(v) => setParam("isPreemptive", v)} label="Can interrupt lower-priority work" />
</div>
```
Add `import Switch from "@/components/ui/Switch";` at the top of the file.
Step 3. Search the rest of `NodePropertiesPanel.tsx` for any other boolean field currently rendered as a YES/NO or true/false button (grep for `? "YES" : "NO"` and similar patterns across all ~14 sub-components — the `isPriorityNode`/preemptive pattern is likely duplicated at least once more, e.g. on `PriorityResourceProperties` or a `collectKPIs` flag on `SinkProperties`). Replace every match with the same `<Switch>` component for consistency — a panel should not mix button-toggles and switch-toggles for the same kind of yes/no setting.

### Task 2.3 — Tighten field-to-field spacing and add a subtle divider inside multi-field cards where a field is conditionally revealed

**File:** `src/components/workspace/NodePropertiesPanel.tsx`

Step 1. In `ResourceProperties`, the breakdown fields currently use a manual `pt-4 border-t border-border mt-4` (line 220) to visually separate "breakdown" settings from the main capacity/service fields, inside what is now (post Task 2.1) already a bordered card. Change it to a lighter internal separator so it doesn't look like a second nested card:
```tsx
<div className="pt-3 mt-1 border-t border-border/60 space-y-4">
  <div>
    <label className={labelCls}>How often does this break down, on average?</label>
    <input type="number" min={0} value={params.meanTimeBetweenFailures ?? ""} placeholder="Never" onChange={(e) => setParam("meanTimeBetweenFailures", e.target.value ? Number(e.target.value) : undefined)} className={inputCls} />
  </div>
  {params.meanTimeBetweenFailures > 0 && (
    <div>
      <label className={labelCls}>Average Repair Time</label>
      <input type="number" min={0} value={params.repairTimeMean ?? 1} onChange={(e) => setParam("repairTimeMean", Number(e.target.value))} className={inputCls} />
    </div>
  )}
</div>
```
Step 2. Apply this same lighter-internal-divider pattern (`border-border/60` instead of full-opacity `border-border`, since the card's own outer border already provides the strong boundary) anywhere else in the file a sub-component currently nests a `border-t` divider inside its own section — this is a search-and-replace-by-pattern task across the file, not a one-off.

---

## Phase 3: Move the AI/Props toggle to float at the bottom of the sidebar

**File:** `src/app/dashboard/project/[id]/page.tsx`

Step 1. Remove the current toggle block entirely (lines 563–581):
```tsx
{/* Panel Toggle */}
<div className="absolute top-4 -left-32 flex bg-surface rounded-full border border-border p-1 shadow-sm">
  <button onClick={() => setActiveRightPanel("ai")} className={...}>AI</button>
  <button onClick={() => setActiveRightPanel("properties")} className={...}>Props</button>
</div>
```
Step 2. Add it back inside the right-panel wrapper as a floating pill docked to the bottom-center, above the panel's own content, overlapping neither the header nor the canvas:
```tsx
<div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex bg-surface rounded-full border border-border p-1 shadow-lg z-20">
  <button
    onClick={() => setActiveRightPanel("ai")}
    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-colors ${
      activeRightPanel === "ai" ? "bg-text-primary text-surface" : "text-text-secondary hover:text-text-primary"
    }`}
  >
    <Sparkles size={13} /> AI
  </button>
  <button
    onClick={() => setActiveRightPanel("properties")}
    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-colors ${
      activeRightPanel === "properties" ? "bg-text-primary text-surface" : "text-text-secondary hover:text-text-primary"
    }`}
  >
    <Settings size={13} /> Props
  </button>
</div>
```
Add `Sparkles` to the existing `lucide-react` import at the top of the file (`Settings` is already imported per the previous plan's Task 3.3).
Step 3. This pill is positioned relative to the same outer `<div className="relative">` that already wraps both the Properties panel and the `AIChatPanel` (current line 519) — `bottom-5 left-1/2 -translate-x-1/2` centers it horizontally within that 320px-wide panel and docks it 20px above the panel's bottom edge, floating over whichever panel content is currently showing (both the Properties card list and the AI chat's message thread are scrollable containers, so a floating pill docked at the bottom won't visually conflict with either — confirm this by checking `AIChatPanel.tsx`'s own layout doesn't already reserve that exact bottom strip for its message-input box; if it does, bump this pill up to `bottom-20` instead of `bottom-5` so it floats above the chat input rather than on top of it).
Step 4. Give the pill a darker "selected" state (`bg-text-primary text-surface`, i.e. a solid dark pill with white text) rather than the previous version's `bg-bg-surface-sunken text-color-info` — this makes it read as a proper segmented control (the two-tab pattern already used successfully for the Advanced Results Dashboard's tab switcher, `RESULTS_DASHBOARD_MEGA_PLAN.md` Task 2.1) instead of a faint highlight that's easy to miss, matching your "premium, easy to read" requirement.
Step 5. Manually verify after this change: the pill no longer overlaps the canvas at all (it was previously bleeding 128px left of the panel, over the canvas edge — exactly as seen in your screenshot's top-left "AI Props" pill sitting oddly disconnected from everything); it now reads as clearly attached to and hovering over the bottom of the 320px-wide right panel only.

---

## Phase 4: Default to Properties when a node is selected

**File:** `src/app/dashboard/project/[id]/page.tsx`

Step 1. Change the initial state (current line 50) from defaulting to AI to defaulting to Properties, since the panel now has a proper empty state ("Select a block on the canvas to configure it") that's a more useful default landing view than an empty AI chat thread:
```ts
const [activeRightPanel, setActiveRightPanel] = useState<"ai" | "properties">("properties");
```
Step 2. Add the actual behavior you asked for — selecting a node always switches to Properties, even if the AI panel was open. Change the `onSelectNode` wiring on `<NodeCanvas>` (current line 508) from a bare state setter to a small wrapper function:
```ts
function handleSelectNode(id: string | null) {
  setSelectedNodeId(id);
  if (id) setActiveRightPanel("properties");
}
```
Add this function definition near the other handler functions (alongside `handleNodesChange`/`handleEdgesChange`), then change line 508 from `onSelectNode={setSelectedNodeId}` to `onSelectNode={handleSelectNode}`.
Step 3. This intentionally only forces the switch **to** Properties on selection — it does not force a switch back to AI when a node is *deselected* (clicking empty canvas). A user who deliberately clicked "AI" and then clicked empty canvas to deselect should stay on whichever panel they were looking at; only the act of selecting a specific block should assert "you're now configuring something, here are its settings," matching your stated requirement precisely (properties first when a node is clicked) without also inventing an unrequested auto-switch-back behavior.
Step 4. Manually verify: open a project, land on the workspace — Properties panel shows the empty state by default (Step 1). Click "AI" — chat panel shows. Click any node on the canvas — panel snaps to Properties showing that node's settings, even though AI was active a moment ago. Click a second node — stays on Properties, now showing the second node's settings. Click empty canvas — selection clears, Properties panel shows its empty state again (it does not jump back to AI).

---

## Phase 5: Final polish pass

Step 1. Confirm the Switch component (Task 2.2) and the new bottom-docked toggle pill (Phase 3) both use only `var(--color-*)` tokens — no hardcoded hex — consistent with the design-system discipline already enforced across the rest of the app.
Step 2. Re-check `settings/page.tsx` after Phase 1's CSS fix lands — its own `input-surface` usages (built in the earlier `MEGA_IMPLEMENTATION_PLAN.md`'s Task 3.5) were silently broken the same way and will now render correctly with zero further edits there; just confirm visually, don't skip this check since it's an easy free win riding along with this plan.
Step 3. Run `npx tsc --noEmit -p .` and confirm the error count/set matches the established baseline (same pre-existing errors as before, nothing new introduced by the new `Switch.tsx` file or the `NodePropertiesPanel.tsx`/`page.tsx` edits).
Step 4. Open the panel for at least three different node types (e.g. a Resource, a Source, a Decision block) to confirm the card-based section revamp (Task 2.1) looks correct across sub-components that have very different field counts — a one-field section (like `ServiceProperties`) and a many-field section (like `ResourceProperties` with its conditional repair-time field) should both look like well-proportioned cards, not oversized empty boxes or cramped overflowing ones.
