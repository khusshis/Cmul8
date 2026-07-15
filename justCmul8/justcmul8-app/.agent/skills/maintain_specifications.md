# Maintain Specifications (Spec Driven Development)

The JustCmul8 platform relies heavily on technical documentation to bridge the gap between visual React Flow graphs and complex SimPy Python logic.

## 1. Specification Triggers
**EVERY TIME** you perform any of the following actions, you MUST proactively update the documentation in the `spec/` directory:
- Add a new `NodeType`.
- Add or modify a property parameter (e.g., in `types.ts`).
- Alter the routing, execution logic, or core behavior in `codeGenerator.ts` or `pyodideWorker.ts`.
- Create a new major UI workflow.

## 2. Target Files
- **Node Specs (`spec/nodes/*.md`)**: If you alter how a specific node behaves, open its corresponding markdown file and update the technical definition, parameters, and expected SimPy translation behavior. If you create a new node, you must create a new spec file for it.
- **Project Spec (`spec/project_spec.md`)**: If you change the global architecture, data structures, UI thread/worker threading model, or high-level user journeys, you must update the overarching project specification.

## 3. Enforcement
Do not wait for the user to ask you to update the specifications. Treat the `spec/` folder as a critical part of the codebase that must compile alongside the code. A feature is not complete until its specification reflects the newly committed reality.
