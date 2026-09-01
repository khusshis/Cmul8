# Module 06: AI Assistant

## Overview
The AI Assistant is a defining feature of JustCmul8, acting as an AI Co-Pilot that allows Citizen Modelers to bypass the manual drag-and-drop process entirely. Users can describe a real-world scenario in plain natural language, and the AI will automatically design and construct a complete, valid simulation graph.

## Architecture

The AI module is split across the frontend interface (`AIChatPanel.tsx`) and a backend Next.js API route (`api/ai/generate/route.ts`).

### 1. The Frontend Interface (`AIChatPanel.tsx`)
- **Location**: Resides as a collapsible side-panel in the simulation workspace.
- **UI Design**: Implements a clean, professional chat interface utilizing the light theme tokens. Chat bubbles are clearly distinguished without relying on harsh neon colors, using soft accents (`var(--color-accent-soft)`) and information blues (`var(--color-info)`).
- **Interaction Flow**:
  1. User types a prompt (e.g., "Create a hospital ER with 2 triage nurses and 3 doctors...").
  2. The UI enters a "Generating..." state.
  3. The prompt, along with the current graph state (if any) and the active `simType`, is sent to the backend API.
  4. The response contains the updated graph structure, which is then rendered on the canvas.

### 2. The Backend API Route (`/api/ai/generate`)
- **LLM Integration**: Utilizes the `@google/generative-ai` SDK to interface directly with Google's **Gemini 2.0 Flash** model.
- **System Prompt**: The API constructs a highly detailed, rigid system prompt that instructs the LLM on the exact JSON schema.
- **Context Awareness**: The API passes the existing graph structure to the LLM.

### 3. Auto-Layout (`dagre`)
Because LLMs cannot reliably predict spatial 2D coordinates for visual graphs, the frontend intercepts the JSON payload and processes it through **Dagre** (a directed graph layout engine). Dagre calculates the optimal `x` and `y` positions.
