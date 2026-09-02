# Module 03: Visual Graph Editor

## Overview
The Visual Graph Editor is the core interactive component of JustCmul8. It provides a drag-and-drop canvas where Citizen Modelers can visually construct their simulation logic by connecting blocks that represent physical or logical entities in the system.

The module is built entirely using `@xyflow/react` (React Flow), providing a production-grade, highly performant node-based UI capable of handling complex simulation architectures.

## Architecture

The editor is encapsulated primarily in the `NodeCanvas.tsx` component within the `workspace` directory.

### Core Components
- **`NodeCanvas`**: The primary wrapper for the `<ReactFlow>` instance. It manages the state of all `nodes` and `edges`, handles drag-and-drop from the `NodePalette`, and manages the selection state.
- **`NodePalette`**: The sidebar containing draggable simulation primitives (Source, Queue, Resource, Decision, Sink, etc.). 
- **`CustomNodes`**: JustCmul8 defines custom React components for rendering each block type within the canvas.

### Data Flow
1. **Drag and Drop**: Users drag a block from the palette. The HTML5 Drag and Drop API transfers the block type (`nodeType`).
2. **Instantiation**: `NodeCanvas` intercepts the drop event, instantiates a new `SimNode` object with default parameters based on the block type, and adds it to the React Flow state.
3. **Connectivity**: Users connect blocks by dragging from a source handle to a target handle. React Flow manages the `Edge` creation.
4. **Validation**: The canvas implements `validateGraphConnectivity()` to ensure that the constructed graph is topologically valid for simulation.

## Visual Styling (Premium 3D-Inspired Theme)
- **Background**: The canvas features a calm, light dotted grid background (`var(--color-surface-sunken)`).
- **Block Nodes**: Nodes are styled to match the premium 3D-inspired aesthetic of the Landing Page, featuring a sleek, wider profile (`170px`) with completely hidden connection handles for seamless aesthetics. Active or selected nodes display a crisp drop shadow (`shadow-lg scale-105`) and the left border color dynamically mirrors the node's domain base color.
- **Edges**: Connections utilize smooth Bezier curves (`getBezierPath`). Nodes automatically color their outgoing edges to match their own base color, creating an intuitive multi-colored visual flow. When the simulation runs, edges are animated with flowing dash-patterns based on throughput.
- **Terminology**: The UI exclusively uses plain-language terms (e.g., "Start Point", "Waiting Line", "Counter") abstracted away from raw SimPy terms via the central `NODE_LABELS` registry.
- **Minimap & Controls**: Styled with matching light backgrounds and professional accents.

## Interaction with Other Modules
- **Block Configuration (Module 04)**: Clicking a block in the graph editor selects it and triggers the `NodePropertiesPanel`.
- **Simulation Engine (Module 05)**: When the user clicks "Run", the current state is sent to the Pyodide WebWorker for execution.
- **AI Assistant (Module 06)**: The AI can programmatically generate `nodes` and `edges`.
