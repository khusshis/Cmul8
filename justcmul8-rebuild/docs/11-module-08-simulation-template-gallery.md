# Module 08: Simulation Template Gallery

## Overview
The Simulation Template Gallery (`TemplateGallery.tsx`) serves as an onboarding tool and a rapid prototyping accelerator. It provides a curated list of pre-built, domain-specific simulation graphs that users can instantiate with a single click.

## Architecture

### Data Structure
The module is powered by the `SIM_TYPE_REGISTRY` (defined in `simTypeRegistry.ts`). Each simulation domain (Human Queue, Vehicle, Liquid, Manufacturing, Logistics, Network) defines a `templateGraph`.

### Interaction Flow
1. When a user creates a new project or opens an empty workspace, the Template Gallery can be invoked.
2. The user sees a modal or side-panel featuring clean, professionally styled cards for each available template.
3. Upon selecting a template, the workspace immediately overwrites its current Zustand state with the `nodes` and `edges` from the selected template.

## Example Templates

- **Bank Branch (Human Queue)**: Features an exponential source of customers, a FIFO queue, and a parallel resource block representing 3 bank tellers.
- **Toll Booth (Vehicle)**: Models cars arriving at a toll plaza, utilizing priority queues for VIP/FastPass lanes.
- **Assembly Line (Manufacturing)**: Demonstrates sequential service blocks with a final inspection decision router (Pass vs. Scrap).

## Design Elements (Professional Light Theme)
The Template Gallery cards utilize the core Card primitive. Each card displays an icon corresponding to the simulation domain and a brief description of the system it models. Hover states utilize soft shadows and the primary accent color (`var(--color-accent)`) to encourage discovery.
