# Priority Resource Node Specification

## Overview
The \`priority_resource\` node is a specialized version of the standard \`resource\` node. It explicitly handles preemption and ordered processing based on the priority level of incoming entities.

## Parameters
- **Capacity**: The number of parallel slots available.
- **Service Time Mean** & **Distribution**: Parameters defining how long processing takes.
- **Is Preemptive**: A critical boolean flag. 
  - If \`true\`, an arriving high-priority entity can "interrupt" an entity of lower priority currently being processed. The lower-priority entity is evicted, its remaining processing time is saved, and the high-priority entity takes the slot. Once the high-priority entity finishes, the lower-priority entity resumes processing.
  - If \`false\`, high-priority entities skip to the front of the queue but must wait for the currently processing entities to finish.

## Operational Behavior
1. An entity arrives and is queued based on its \`Priority Level\` (e.g., Urgent = 1, Priority = 2, Standard = 3).
2. If the resource is at capacity and \`Is Preemptive\` is true, the system checks if the arriving entity has a higher priority than any currently processing entity.
3. If so, the lowest priority processing entity is paused and pushed back into the queue, and the arriving entity begins service immediately.
4. If not preemptive (or if all processing entities are of equal or higher priority), the arriving entity waits at the front of its priority tier in the queue.

## Metrics Tracking
- **Utilization**: The percentage of capacity currently in use.
- **Preemption Count**: The number of times lower-priority entities were interrupted.
- **Average Service Time**: The empirical average time entities spent being processed (excluding interrupted wait times).
