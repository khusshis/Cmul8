# Module 04: Block Configuration Panel

## Overview
The Block Configuration Panel provides the interface for users to specify the mathematical and logical parameters of the simulation primitives they have placed on the visual graph editor.

It is a dynamic, context-sensitive side panel that appears when a user selects a block in the workspace. The input fields presented are strictly typed and conditionally rendered based on the specific `nodeType` of the selected block.

## Architecture

The module is primarily contained within `NodePropertiesPanel.tsx`. 

### State Management
- The panel takes the currently selected `SimNode` as a prop (`node`).
- It manages local React state for form inputs to allow for fluid typing without triggering a global React Flow re-render.
- Changes are committed upstream via an `onUpdate(nodeId, newParams)` callback.

### Dynamic Rendering by Block Type
The panel reads `node.nodeType` and renders a specific configuration form:

1. **Source Block**: Arrival Rate, Distribution, Max Entities, Priority/Class.
2. **Queue Block**: Capacity, Discipline, Renege Parameters.
3. **Resource Block**: Capacity, Service Time Mean, Service Distribution, Preemption, Breakdown Parameters.
4. **Decision (Router) Block**: Routing Mode, Routes List.
5. **Sink Block**: Collect KPIs toggle.

## Design Aesthetic (Professional Light Theme)
The panel adheres to the platform's professional, n8n-inspired aesthetic:
- **Background**: Clean white surface (`var(--color-surface)`).
- **Header**: Features the block's name in `Inter` with a subtle accent color corresponding to the block type.
- **Inputs**: Standard, clean inputs with light backgrounds (`var(--color-surface-sunken)`) and soft borders (`var(--color-border)`). Focus states use the primary brand accent (`var(--color-accent)`).
- **Labels**: Readable, secondary text (`var(--color-text-secondary)`) using the standard `Inter` font.
