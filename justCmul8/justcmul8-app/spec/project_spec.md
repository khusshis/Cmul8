# JustCmul8 Project Specification

## 1. Project Overview
**JustCmul8** (Just Simulate) is a visually-driven, web-based Discrete Event Simulation (DES) platform. It allows users to design, configure, and execute complex systems modeling (like queuing networks, manufacturing lines, and logistics) entirely within the browser without writing code.

The platform combines a highly interactive node-based graphical interface with a robust, industry-standard simulation engine (SimPy) executed client-side via WebAssembly.

---

## 2. User Journeys

### 2.1. Onboarding & Project Creation
Users navigate the cyberpunk-themed landing page and authenticate via Supabase. Upon logging in, they enter the main dashboard where they can create a new simulation project or load a predefined starter scenario, such as the classic "Bank Renege" model.

### 2.2. Visual Model Construction
Users build their Discrete Event Simulation (DES) network using the React Flow canvas. They drag and drop nodes (e.g., \`Source\`, \`Queue\`, \`Resource\`, \`Sink\`) from the left palette and connect them via edges. Selecting a node opens the refined **Node Properties Panel**, allowing no-code configuration of advanced behaviors:
- **Arrival Schedules**: Setting fixed timetables or statistical inter-arrival rates.
- **Entity Attributes**: Assigning priority classes to flowing entities.
- **Queue Patience**: Defining reneging distributions (how long entities will wait before abandoning the line).
- **Resource Capacities**: Setting server limits and processing distributions.

### 2.3. Real-Time Simulation & Observability
Clicking "Run" compiles the visual graph into a standalone Python (SimPy) script, which is immediately executed inside a Pyodide Web Worker. The canvas updates in real-time as the simulation ticks:
- Edges animate to indicate active flow.
- Nodes display live stat badges (e.g., \`80% util | Wait: 5 | Proc: 20\`).
- Node glow states change dynamically (e.g., turning red) to visually identify bottlenecks.

### 2.4. Post-Simulation Analysis
Upon simulation completion or manual stop, the **SimResultsPanel** is presented. This dashboard allows the user to analyze aggregate KPIs, such as total renege counts, average wait times, and overall system throughput.

---

## 3. System Requirements

### 3.1. Functional Requirements
- **No-Code Visual Editor**: A drag-and-drop interface capable of defining complex discrete event simulations.
- **Client-Side Execution**: 100% of simulation computations must run locally in the user's browser without requiring server-side compute.
- **Code Generation**: Automatic, accurate translation of visual React Flow graphs into executable SimPy Python code.
- **Advanced DES Concepts**: Full support for complex modeling features including preemption, broadcast routing, scheduled arrivals, and queue reneging.
- **Real-Time Visual Feedback**: The UI must reflect the exact instantaneous state of the simulation (utilization, queue depths) as it runs.

### 3.2. Non-Functional Requirements
- **Strict UI Thread Isolation**: The simulation engine and Python compilation must execute within a Web Worker to guarantee the main browser UI thread remains responsive (60fps).
- **Consistent Cyberpunk Aesthetic**: The application must strictly adhere to a premium design system featuring deep dark backgrounds, neon accents (cyan, yellow, red), glassmorphism, and subtle glitch micro-animations.
- **Consolidated Workspace**: The simulation environment must exist within a focused, single-screen 3-panel dashboard layout, avoiding disjointed popups or separate viewports.

---

## 4. Technology Stack
- **Frontend Framework**: Next.js (App Router), React, TypeScript.
- **Styling**: Tailwind CSS with a custom "Cyberpunk" aesthetic (neon accents, dark backgrounds, glassmorphism).
- **Graph Visualization**: React Flow (\`@xyflow/react\`) for the drag-and-drop node canvas.
- **Simulation Engine**: Pyodide (Python in WebAssembly) running SimPy.
- **State Management**: React Context and local state, synchronized with Web Worker messaging.
- **Authentication/Database**: Supabase (PostgreSQL, Auth).

---

## 5. Core Architecture

The application is strictly divided into the UI thread and a background Web Worker thread to ensure the browser remains responsive during heavy simulation computations.

### 5.1. Frontend UI (Main Thread)
- **Workspace Dashboard**: A 3-panel layout consisting of:
  - **Left Panel (Node Palette)**: Draggable components categorized by function (e.g., Sources, Queues, Resources).
  - **Center Panel (Node Canvas)**: The interactive React Flow surface where users draw the simulation graph. Nodes display real-time live statistics (utilization, queue depths) using custom \`statsBadge\` rendering.
  - **Right Panel (Auxiliary)**: Tabbed area containing the \`NodePropertiesPanel\` for configuring selected nodes, and the \`SimResultsPanel\` for post-simulation analytics.
- **Code Generator (\`codeGenerator.ts\`)**: A crucial bridge layer that takes the visual React Flow \`SimGraph\` and compiles it into a standalone, executable Python script leveraging the SimPy library.

### 5.2. Simulation Engine (Web Worker)
- **Pyodide Worker (\`pyodideWorker.ts\`)**: A persistent background thread that initializes the Pyodide WebAssembly environment.
- **Execution Flow**:
  1. The UI sends the compiled Python script and simulation parameters (duration, tick interval) to the Worker.
  2. The Worker executes the script within the Pyodide environment.
  3. The Python script periodically emits JSON payloads (\`ticks\`) representing the instantaneous state of every node (queue depths, busy counts, total arrivals).
  4. The Worker forwards these ticks back to the UI thread via \`postMessage\`.
  5. The UI consumes these ticks to update the canvas glowing effects and stat badges in real-time.

---

## 6. Simulation Concepts & Node Types

The platform models discrete events using a network of interconnected nodes. Detailed specifications for each node's behavior can be found in the \`spec/nodes/\` directory.

### Core Node Categories:
1. **Generators**: \`source\` (creates entities based on rates or schedules).
2. **Buffers/Lines**: \`queue\` (FIFO/LIFO waiting areas with reneging logic), \`store\` (typed message buffers).
3. **Processors**: \`resource\` (capacity-constrained servers), \`priority_resource\` (preemptive servers), \`service\` (unconstrained delays).
4. **Routers**: \`decision\` (probabilistic branching), \`broadcaster\` (message duplication).
5. **Terminators**: \`sink\` (destroys entities and finalizes lifecycle KPIs).
6. **Advanced**: \`container\` (continuous liquids/levels), \`event_trigger\` (system sensors), \`channel\` (propagation delays).

---

## 7. Data Structures

### SimGraph
The primary representation of a user's model.
\`\`\`typescript
interface SimGraph {
  nodes: SimNode[];
  edges: SimEdge[];
}
\`\`\`

### SimNode
Contains standard graph data (x/y coordinates) plus simulation-specific parameters.
\`\`\`typescript
interface SimNode {
  id: string;
  nodeType: NodeType;
  label: string;
  params: any; // Dynamic based on nodeType (e.g., SourceParams, QueueParams)
}
\`\`\`

### Sim Tick Payload
The telemetry data sent from the Python engine to the UI during execution.
\`\`\`typescript
interface SimTick {
  type: "tick";
  data: {
    simTime: number;
    totalArrived: number;
    totalCompleted: number;
    nodeStats: Record<string, NodeStats>; // Instantaneous state of each node
    recentLogs: EventLog[];
  };
}
\`\`\`

---

## 8. Future Roadmap
1. **Analytics Dashboard**: Expand the \`SimResultsPanel\` to include interactive charts (e.g., Recharts) plotting historical queue depths and wait times over the simulation duration.
2. **Python IDE Mode**: Allow advanced users to eject from the visual code generator and write custom SimPy code directly in an integrated Monaco Editor.
3. **Cloud Execution**: For highly complex, multi-hour simulations, offload execution from the client-side Pyodide worker to a scalable Python backend service.
4. **Collaboration**: Implement CRDTs (e.g., Yjs) to allow multiple users to edit the same React Flow canvas simultaneously.
