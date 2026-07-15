# Resource Node Specification

## Overview
The \`resource\` node represents a constrained server, worker, or machine that processes entities. A resource can only handle a limited number of entities at the same time. While a \`service\` is a pure delay, a \`resource\` explicitly models concurrency limits and utilization.

## Parameters

### 1. Capacity and Processing
- **Capacity**: The number of parallel servers or processing slots available within this resource (e.g., 3 bank tellers).
- **Service Time Mean**: The average duration it takes to process a single entity.
- **Service Distribution**: The statistical distribution governing processing times (\`exponential\`, \`uniform\`, \`deterministic\`, \`normal\`).

### 2. Interrupts and Breakdowns (Reliability)
Resources can be modeled as imperfect systems that suffer breakdowns.
- **Mean Time Between Failures (MTBF)**: The average simulation time the resource operates before breaking down.
- **Repair Time Mean**: The average time it takes to bring the resource back online after a failure.
- **Repair Distribution**: The statistical distribution for repair times.
- **Repairman Node ID**: (Optional) If repairs require a specific maintenance worker modeled elsewhere in the graph, this specifies the node ID of that repairman resource.
- **Repair Priority**: The priority of the repair task if competing with other maintenance requests.

## Priority Resource Variant
A specialized subclass is the **Priority Resource**, which supports preemption.
- **Is Preemptive**: If true, an arriving high-priority entity can interrupt an entity currently being processed if the resource is at full capacity. The interrupted entity's progress is paused and resumed later.

## Operational Behavior
1. An entity attempts to seize a slot in the resource.
2. If \`current_busy < capacity\`, the entity is accepted immediately. 
3. If the resource is full, the entity is blocked (and remains in the upstream \`queue\`).
4. Once seized, the resource calculates a service time and delays the entity for that duration.
5. After the service time elapses, the entity releases the resource slot and is pushed to the next node.
6. The resource signals upstream queues that a slot has opened up.
7. If MTBF is configured, a background process periodically seizes the entire resource for a "repair" duration, temporarily halting processing of normal entities.

## Metrics Tracking
- **Utilization**: The percentage of capacity currently in use.
- **Busy Count**: The absolute number of slots currently processing an entity.
- **Average Service Time**: The empirical average time entities spent being processed.
- **Entities Processed (Out)**: Total number of entities successfully serviced.
