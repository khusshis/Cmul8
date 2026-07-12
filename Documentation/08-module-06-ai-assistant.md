# Module 6 — AI Assistant

## 1. Purpose
Lets a user type a plain-English description of the system they want (e.g. "a
bank with 3 tellers and a queue, customers arrive every 2 minutes") and have
Google Gemini generate a complete, ready-to-run graph on the canvas — the
synopsis's headline "no-code" differentiator (Section 7: "AI-powered model
generation").

## 2. Files owned by this module
| File | Role |
|---|---|
| `src/app/api/ai/generate/route.ts` | Server-side Next.js API route — the only place the Gemini API key is used (never exposed to the browser) |
| `src/components/workspace/AIChatPanel.tsx` (119 lines) | The chat UI: message list, input box, loading indicator |

## 3. Algorithm / logic
1. **Client side** (`AIChatPanel.tsx`): keeps `messages` as local React state only
   (see gap below). On send, `POST /api/ai/generate` with `{prompt, simType,
   currentGraph}`. If the response contains a `graph` field, it calls
   `onGraphGenerated(nodes, edges)` — the exact same setter the manual canvas
   editing uses (Module 3), so an AI-generated graph is indistinguishable from a
   hand-built one from that point on (fully editable, participates in auto-save,
   etc.).
2. **Server side** (`route.ts`):
   - Builds a single hardcoded `SYSTEM_PROMPT` string describing available node
     types and the exact JSON response shape expected (React-Flow-compatible
     `{nodes, edges}`, with each node's `data` containing `label`, `nodeType`,
     `params`).
   - Calls `gemini-2.0-flash` via `@google/generative-ai`'s
     `model.generateContent()`, with `responseMimeType: "application/json"`
     (structured output mode — Gemini is constrained to return valid JSON,
     reducing but not eliminating parse failures) and `temperature: 0.7`.
   - Passes the current graph's node/edge **count only** as context (`"Current
     graph has N nodes and M edges"`) — not the actual graph structure — so the AI
     cannot reference or modify specific existing nodes by name; every request is
     closer to "generate a new graph" than "edit the current graph."
   - Falls back to regex-extracting a JSON object from the raw text
     (`text.match(/\{[\s\S]*\}/)`) if `JSON.parse` fails outright, before giving up
     and returning the raw text as a chat message.
   - If the user's message reads as a question rather than a build request, the
     system prompt instructs Gemini to respond with only `{"message": "..."}`
     (no `graph` key) — the client's `if (data.graph)` check is what branches
     between "update the canvas" and "just reply in chat."

## 4. ⚠️ Gaps flagged
1. **The AI can only generate 10 of the app's 15 node types.** The hardcoded
   `SYSTEM_PROMPT` in `route.ts` documents `source`, `queue`, `resource`,
   `service`, `decision`, `sink`, `priority_resource`, `container`, `store`,
   `event_trigger` — it never mentions `channel`, `broadcaster`, `any_of`,
   `all_of`, or `interrupter`. A user asking the AI to "add a broadcast step" or
   "make these two things wait for each other" will get a graph that either
   ignores the request or approximates it with the wrong node type, since Gemini
   has no knowledge those node types exist.
2. **Per-domain AI prompts are defined but never used.** `simTypeRegistry.ts`
   defines an `aiSystemPrompt: string` field on every one of the 6
   `SimTypeConfig` entries, with a doc comment stating it should be "injected into
   the Gemini API route." Confirmed by direct search: `route.ts` never imports
   `SIM_TYPE_REGISTRY` or references `aiSystemPrompt` anywhere — every domain gets
   the exact same generic prompt regardless of whether the user is building a bank
   queue or a network topology. This means the AI has no domain-specific guidance
   (e.g. it doesn't know the Vehicle domain calls a resource a "Bay/Pump" — see
   Module 3's palette labeling) even though that data already exists in the
   codebase, unused.
3. **Chat history is not persisted.** `AIChatPanel.tsx`'s `messages` state is
   local to the component and resets to just the welcome message on every page
   refresh or re-navigation into the project. The `chat_history` database table
   defined in `justcmul8-app/supabase-schema.sql` (see Module 2's schema-gap note)
   appears to have been built for exactly this purpose and is simply never wired
   up.

These are flagged as known gaps in the original app, not changed silently. Fixing
#1 and #2 together (teach Gemini all 15 types, and actually pass the domain's
`aiSystemPrompt` as additional context) is a meaningful, well-scoped correctness
improvement worth discussing with your supervisor — it doesn't add a new feature,
it makes an existing one work as the registry's own code already intended.

## 5. Design notes for the rebuild
- Keep the request/response contract with Gemini identical — same model, same
  response shape, same server-only API key handling (**never** move the Gemini
  call to the client).
- Restyle the chat bubbles from the neon cyan/purple scheme to
  `--color-accent`(user)/`--color-info`(AI) with the standard card surface, and
  swap "AI ASSISTANT" / "GEMINI" badge styling for the professional theme, keeping
  the same welcome message content (in plain language, already reasonably
  accessible) and the same Enter-to-send / Shift+Enter-for-newline behavior.

## 6. Connections to other modules
- **Visual Graph Editor (Module 3)**: `onGraphGenerated` writes into the exact
  same `nodes`/`edges` state the canvas renders — see Module 3, Section 6.
- **Simulation Engine (Module 5)**: the node types and param shapes the AI must
  produce are defined by that module's `types.ts` — any new node type added there
  needs a matching update to the `SYSTEM_PROMPT` here to be AI-generatable.
- **Template Gallery / simTypeRegistry (Module 8)**: owns the unused
  `aiSystemPrompt` field described in gap #2 above.

## 7. Database tables touched
None currently (see gap #3). If chat persistence is added, it would use
`chat_history` (project_id, user_id, role, message) — schema already exists in one
of the two schema files (Module 2).
