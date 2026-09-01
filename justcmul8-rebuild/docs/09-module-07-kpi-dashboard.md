# Module 07: KPI Dashboard & Results

## Overview
The KPI Dashboard & Results module (`SimResultsPanel.tsx`) is responsible for rendering the statistical outputs of the simulation. It provides a real-time, interactive, and highly visual representation of what is happening inside the discrete event system.

## Architecture

The module utilizes **Recharts**, a composable charting library built on React components, to render performant SVG charts. 

### Key Visualizations

1. **Resource Utilization (Bar Chart)**
   - Plots the percentage of time that servers (Resource blocks, Service blocks) were busy vs. idle.
   - Dynamic coloring utilizing the status tokens: Green (`var(--color-success)`), Yellow (`var(--color-warning)`), Red (`var(--color-error)`).

2. **Wait Time Analytics (Bar Chart)**
   - Plots the average wait time for entities stored in Queue or Store blocks.

3. **Utilization Distribution (Pie Chart)**
   - Provides a macroscopic view of workload distribution across all active nodes in the system.

4. **Block Stats (Tabular Data)**
   - A raw data table displaying exact metrics: "In", "Out", "Util%", and "Wait".
   - **Bottleneck Highlighting**: If the simulation engine identified a specific block as the system's bottleneck, that row is highlighted.

5. **Top-Level KPI Pills**
   - Summary statistics displayed in the panel header: Total Arrived, Total Completed, Global Efficiency.

## Design Integration (Professional Light Theme)
The dashboard perfectly matches the professional n8n-inspired aesthetic:
- **Clean Backgrounds**: Charts are housed in clean, white containers (`var(--color-surface)`).
- **Legible Typography**: Utilizes `Inter` for all labels and axis ticks (`var(--color-text-secondary)`).
- **Status Colors**: Relies strictly on the semantic status colors defined in the design system to communicate urgency.
