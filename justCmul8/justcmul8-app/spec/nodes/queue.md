# Queue Node Specification

## Overview
The \`queue\` node represents a waiting area where entities accumulate when downstream resources (like a \`resource\` or \`service\` node) are unavailable or busy. It manages the line of entities and enforces waiting disciplines and behaviors such as reneging (abandoning the queue).

## Parameters

### 1. Capacity and Discipline
- **Capacity**: The maximum number of entities the queue can hold. If set to \`-1\`, the queue has unlimited capacity. If finite and full, new arriving entities may be dropped or blocked.
- **Discipline**: Determines the order in which entities leave the queue when space opens downstream.
  - \`FIFO\` (First-In, First-Out): Standard line behavior.
  - \`LIFO\` (Last-In, First-Out): Stack behavior.
  - \`PRIORITY\`: Entities with a higher \`Priority Level\` are moved to the front.

### 2. Patience (Reneging)
Models the behavior of entities losing patience and leaving the queue before being served.
- **Patience Distribution**: How patience timeouts are assigned.
  - \`none\`: Entities wait infinitely.
  - \`uniform\`: Patience is randomly chosen between a minimum and maximum time.
  - \`exponential\`: Patience is sampled from an exponential distribution with a specified mean.
  - \`deterministic\`: All entities will leave exactly after a fixed amount of time if not served.
- **Patience Timeout / Min / Max**: The parameters driving the patience distribution.

### 3. Sold-Out / Capacity Broadcast 
Models sudden mass-renege events (e.g., a movie theater selling out of tickets).
- **Sold Out Threshold**: When the downstream resource's remaining capacity drops below this number, an event is triggered.
- **Broadcast Renege**: If true, when the threshold is hit, *all* currently waiting entities instantly renege and leave the queue.

## Operational Behavior
1. An entity arrives at the queue.
2. If the downstream node is free, the entity immediately passes through the queue without accumulating wait time.
3. If the downstream node is busy, the entity is added to the internal waiting list according to the queue \`Discipline\`.
4. If a patience timeout is configured, a timeout event is scheduled for the entity. If the entity is not pulled from the queue before this timeout, it reneges (is discarded or sent to an alternate path).
5. When the downstream node completes a task, it signals the queue. The queue then pushes the next eligible entity forward.

## Metrics Tracking
- **Current Depth**: The instantaneous number of entities currently waiting.
- **Average Wait Time**: The mean time entities spent waiting in this specific queue.
- **Entities In**: Total entities that entered.
- **Entities Out**: Total entities that successfully exited to the next node.
- **Renege Count**: Total entities that abandoned the queue due to patience timeouts.
