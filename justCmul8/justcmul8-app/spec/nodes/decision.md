# Decision Node Specification

## Overview
The \`decision\` node acts as a router or switch. It directs incoming entities to one of several possible output paths based on probabilistic rules. It takes zero simulation time to process an entity.

## Parameters
- **Routes**: A list of possible output paths. Each route specifies:
  - \`targetId\`: The ID of the downstream node.
  - \`probability\`: A fractional value (e.g., 0.2 for 20%) indicating the chance an entity will take this path. The sum of all route probabilities should typically equal 1.0.

## Operational Behavior
1. An entity arrives at the decision node.
2. A random number is drawn.
3. Based on the cumulative probabilities defined in the routes, a target path is selected.
4. The entity is immediately pushed to the selected target node.

## Metrics Tracking
- **Entities Processed**: Total entities routed through this node.
- Flow statistics are usually inferred by observing the \`Entities In\` metric of the downstream target nodes.
