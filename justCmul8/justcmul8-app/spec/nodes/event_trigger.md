# Event Trigger Node Specification

## Overview
The \`event_trigger\` node acts as a sensor or listener. It monitors the simulation state (or specific conditions on other nodes) and fires explicit events when thresholds are met. It can also act as an artificial blocker, stopping entity flow until an external signal is received.

## Parameters
- **Condition**: The logic expression or threshold to monitor (e.g., \`queue.depth > 10\`).
- **Action**: What to do when the condition is met (e.g., emit an event, unblock a path, trigger a renege).

## Operational Behavior
- **As a Sensor**: It passively evaluates its condition on every tick. If true, it dispatches a system-level event that other nodes can react to.
- **As a Gate**: Entities arriving at the node are blocked until a specific \`Event\` is triggered elsewhere in the simulation. Once the event fires, the gate opens, allowing waiting entities to pass through.

## Metrics Tracking
- **Trigger Count**: How many times the condition evaluated to true.
- **Blocked Entities**: If acting as a gate, how many entities are currently waiting for the signal.
