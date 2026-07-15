# Broadcaster Node Specification

## Overview
The \`broadcaster\` node acts as a message multiplier. It is a specialized routing node that takes a single incoming entity and duplicates it, sending a copy down every connected output path simultaneously.

## Parameters
Broadcasters typically require no internal parameters, relying solely on their physical connections (edges) to determine behavior. (Note: Routing logic like broadcasting can also be configured directly on a \`source\` node via its \`Routing Mode\`).

## Operational Behavior
1. A single entity arrives at the broadcaster.
2. The node identifies all connected outgoing edges.
3. The node clones the entity (preserving its data labels and timestamps) for each outgoing edge.
4. The cloned entities are pushed to their respective target nodes at the exact same simulation time.

## Metrics Tracking
- **Entities In**: Total original entities received.
- **Entities Out**: Total cloned entities dispatched (should equal \`Entities In * Number of Output Edges\`).
