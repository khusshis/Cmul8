# Channel Node Specification

## Overview
The \`channel\` node represents a transmission medium or conveyor belt. It models the physical propagation delay of moving an entity from one point to another. Unlike a \`service\` node (which models work being done), a channel purely models travel time.

## Parameters
- **Propagation Delay**: The exact simulation time required for an entity to traverse the channel.
- **Capacity**: Maximum number of entities that can be in transit inside the channel at the same time. If unbounded, any number of entities can travel concurrently.

## Operational Behavior
1. An entity enters the channel.
2. If the channel is at capacity, the entity is blocked at the previous node.
3. A timeout equal to the \`Propagation Delay\` is initiated.
4. Upon timeout, the entity exits the channel and enters the downstream node.
5. The order of entities entering the channel is typically preserved upon exit (FIFO transit).

## Metrics Tracking
- **Entities in Transit**: Current number of entities traveling through the channel.
- **Throughput**: Rate of entities exiting the channel over time.
