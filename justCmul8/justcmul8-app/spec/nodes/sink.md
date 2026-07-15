# Sink Node Specification

## Overview
The \`sink\` node is the terminal point of the simulation graph. When an entity reaches a sink, its journey is complete, and it is removed from the simulation environment. Sinks are the primary location where end-to-end Key Performance Indicators (KPIs) are finalized and recorded.

## Parameters
Sink nodes typically do not require configuration parameters, as they serve purely as data collection and termination points.

## Operational Behavior
1. An entity arrives at the sink.
2. The entity's total lifecycle time (arrival time at source vs. current time) is calculated and logged.
3. The entity is destroyed and removed from the active simulation state.

## Metrics Tracking
- **Entities Completed (Out)**: The total number of entities that have finished the simulation through this sink.
- **System Cycle Time**: The average end-to-end time for entities terminating here.
