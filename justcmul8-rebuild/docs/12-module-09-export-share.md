# Module 09: Export & Share

## Overview
The Export & Share module is planned to allow Citizen Modelers to save, download, and distribute their simulation models and results. Since simulation data is highly valuable for presentations, academic reports, and business cases, this module bridges the gap between the isolated web app and external workflows.

## Proposed Architecture

### 1. Data Export
- **Graph Serialization**: The exact topology of the graph (`nodes` and `edges`) can be exported as a raw JSON payload.
- **Results Export**: The `SimResult` payload, specifically the tabular "Block Stats" and the event logs, can be exported as a CSV file.

### 2. Shareable Links (Read-Only Mode)
- **Supabase Integration**: When a user clicks "Share", the platform generates a unique hash linking to the project ID in the Supabase database.
- **Public Workspace**: Visiting the share link opens a specialized, read-only version of the `WorkspacePage`. 
- **Read-Only Constraints**:
  - The `NodePalette` is hidden.
  - The React Flow canvas is locked.
  - The `NodePropertiesPanel` becomes read-only.
  - The user can still click "Run" to watch the simulation execute.

## Design Integration (Professional Light Theme)
- **Export Modal**: The export interface will be housed in a clean white modal (`var(--color-surface)`) with a soft backdrop overlay (`var(--color-bg)` at a lower opacity).
- **Share Link Input**: The generated share link will be presented in a standard, clean text input (`var(--color-surface-sunken)`), featuring a clear primary action button (`bg-[var(--color-accent)]`).
