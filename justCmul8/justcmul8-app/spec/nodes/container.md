# Container Node Specification

## Overview
The \`container\` node represents continuous resources like liquids, bulk materials, or energy (e.g., fuel in a tank, water in a reservoir). Unlike discrete entities, contents are modeled as a continuous real number representing the current level or volume.

## Parameters
- **Capacity**: The maximum amount the container can hold.
- **Initial Level**: The starting amount in the container when the simulation begins.

## Operational Behavior
1. Processes can \`put\` continuous amounts into the container, raising its level.
2. If a \`put\` operation exceeds capacity, the process is blocked until space becomes available (or it overflows, depending on configuration).
3. Processes can \`get\` continuous amounts from the container, lowering its level.
4. If a \`get\` operation requests more than is available, the process is blocked until the container is sufficiently refilled.

## Metrics Tracking
- **Current Level**: The instantaneous amount inside the container.
- **Utilization**: \`Current Level / Capacity\`.
- **Blocked Puts/Gets**: The number of processes currently waiting on capacity or material.
