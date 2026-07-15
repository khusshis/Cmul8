# Service Node Specification

## Overview
The \`service\` node represents a time delay in the process without concurrency limits. Unlike a \`resource\`, a \`service\` node assumes infinite capacity. Any number of entities can undergo the service delay simultaneously without queuing or blocking each other.

## Parameters
- **Duration Mean**: The average simulation time it takes to complete the service.
- **Distribution**: The statistical distribution governing the delay durations (\`exponential\`, \`uniform\`, \`deterministic\`, \`normal\`).

## Operational Behavior
1. An entity arrives at the service node.
2. The node calculates a delay time based on the mean and distribution.
3. The entity is immediately delayed for that duration.
4. If other entities arrive during this time, they are also immediately delayed (no waiting in line).
5. Once an entity's delay expires, it is pushed to the next node.

## Metrics Tracking
- **Entities In**: Total entities that entered the service.
- **Entities Out**: Total entities that completed the service.
- **Average Service Time**: The empirical average time entities spent delayed.
