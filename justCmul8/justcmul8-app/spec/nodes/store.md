# Store Node Specification

## Overview
The \`store\` node acts as a buffer for discrete, typed items or messages. It is similar to a \`queue\`, but rather than just delaying entities trying to use a resource, it is used for explicit producer-consumer patterns where one process \`puts\` an item into the store and another process \`gets\` an item out of it.

## Parameters
- **Capacity**: The maximum number of items the store can hold. If set to \`-1\`, the store has infinite capacity.

## Operational Behavior
1. **Producers** push items into the store. If the store is at full capacity, the producer is blocked until space becomes available.
2. **Consumers** pull items from the store. If the store is empty, the consumer is blocked until an item is deposited.
3. Optionally, stores can support filters, allowing consumers to request only specific types of items from the buffer.

## Metrics Tracking
- **Current Depth**: The number of items currently buffered in the store.
- **Waiting Consumers**: The number of downstream processes blocked waiting for items.
- **Waiting Producers**: The number of upstream processes blocked waiting for space.
