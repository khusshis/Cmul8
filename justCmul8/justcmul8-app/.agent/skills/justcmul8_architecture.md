# JustCmul8 Architecture Guidelines

When working on the JustCmul8 simulation platform, adhere strictly to the following architectural constraints:

## 1. Thread Isolation (Crucial)
- **UI Thread**: The Next.js/React frontend must remain lightweight and responsive at 60fps.
- **Worker Thread**: ALL simulation logic, Python compilation, and Pyodide/SimPy execution MUST occur within the `pyodideWorker.ts` background thread. Never execute `simpy` or `pyodide` calls directly on the main thread.

## 2. Code Generator
- The bridge between the visual `SimGraph` (React Flow nodes/edges) and the Pyodide runtime is `codeGenerator.ts`.
- Any new node types or simulation features must be translated into Python code templates within `codeGenerator.ts`.
- The generated Python script leverages `simpy` to yield events and computes `nodeStats` which are posted back to the UI thread via a JSON tick payload.

## 3. Data Structures
- Centralize all simulation type definitions in `src/lib/simulation/types.ts`.
- When adding a new node property, ensure it is added to the corresponding interface (e.g., `QueueParams`, `StoreParams`) and that the UI `NodePropertiesPanel.tsx` is updated to expose it.
- Keep the `simTypeRegistry.ts` up to date with any new palettes, layouts, or KPI configurations.
