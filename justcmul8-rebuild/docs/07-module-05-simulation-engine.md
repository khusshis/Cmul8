# Module 5: Simulation Engine

## What This Module Does

This module is the "brain" of the JustCmul8 application. Its entire job is to take a visual diagram that a user drew on the screen and run it through a "discrete-event simulation." 

"Discrete-event simulation" sounds complicated, but it's really just a clever way of fast-forwarding time to see how a process behaves. Instead of ticking a clock forward every single second (which takes forever), the simulation skips straight to the next interesting "event"—like a new customer arriving, a machine breaking down, or a barista finishing a coffee. By jumping from event to event, it can simulate days or weeks of real-world time in just a fraction of a second. This module figures out what those events are, executes them in the right order, and tallies up all the statistics (like how long people waited or which step was the busiest).

## The Two Engines: Why Both Exist

Behind the scenes, this module actually contains two completely separate simulation engines that do the exact same thing. 

1. **The Python/SimPy Engine**: This is the main engine. It uses a technology called Pyodide to run Python code directly inside the user's web browser. It relies on an industry-standard, rock-solid Python library called "SimPy" to do the heavy mathematical lifting. 
2. **The JavaScript (JS) Fallback Engine**: Pyodide is powerful, but it requires the browser to download a very large Python environment. If the user is on a slow internet connection, or if they are on a strict corporate network that blocks the download, the main engine won't be able to start. Instead of breaking the app, we built a custom JavaScript fallback engine. It doesn't need to download anything extra, so it guarantees the app will always work. It manually recreates the logic of SimPy so the user gets the exact same results no matter which engine is running under the hood.

## File-by-File Walkthrough

Here is a plain-English explanation of the files inside the `src/lib/simulation/` directory:

### 1. `types.ts` (The Blueprint)
This file defines the exact shape of the data the simulation expects. It tells the rest of the application what properties an "Arrival Point" or a "Waiting Line" is allowed to have (like limits, speeds, or names). It acts as the ultimate rulebook for the data structure.

### 2. `distributions.ts` (The Dice Roller)
Real life isn't perfectly predictable. This file contains the mathematical formulas for randomness (like "exponential" or "normal" distributions) so that the simulation can generate realistic, unpredictable timings for events.

### 3. `simTypeRegistry.ts` (The Catalogue)
This file is the master list of everything the user is allowed to build with. It catalogues all 15 building blocks (node types) and the 6 different "skins" or themes the app uses (for example, whether the app is currently showing terminology for "People & Service Lines" or "Traffic & Vehicles").

### 4. `codeGenerator.ts` (The Translator)
This file translates the visual diagram into a runnable Python script. 
**How it works:**
- It reads the user's diagram and embeds their specific settings (like limits or speeds) into a large, pre-written Python template.
- It maps the user's visual blocks to actual SimPy constructs. For example, it turns an Arrival Point into a loop that spawns entities. It turns a Transmission Link into a capacity-bounded `simpy.Store` combined with an `env.timeout` to enforce both message limits and travel delays.
- It creates processes for every block, connects them according to the arrows in the diagram, and outputs the final Python script.

### 5. `pyodideWorker.ts` (The Isolated Workshop)
Running a heavy Python simulation can freeze the web browser. This file runs the Python engine in a "Web Worker"—a separate background process. The web browser can stay smooth and responsive while the worker handles the math in the background.

### 6. `pyodideEngine.ts` (The Python Manager & Traffic Cop)
This is the piece of the app that manages the background worker, but it's also the main switchboard. It takes the Python script created by the Translator, sends it to the isolated workshop, and listens for the final results. Crucially, this file also contains the fallback logic: if it detects that the Python engine failed to load, it automatically reroutes the simulation to the Backup Workshop (`legacyWorker.ts`).

### 7. `legacyWorker.ts` (The Backup Workshop)
This is the JavaScript fallback engine. If Python fails to load, this file keeps a manual timeline of upcoming events (like a to-do list organized by time). It looks at the first event, fast-forwards the simulation clock to that time, executes the event, calculates what the next event should be, and puts that on the timeline. It repeats this until the time runs out.

### 8. `clientEngine.ts` (The JavaScript Wrapper)
This is a lightweight wrapper around the Backup Workshop (`legacyWorker.ts`). When `pyodideEngine.ts` decides to abandon Python and use the fallback, it instantiates this file. It simply passes the user's diagram into the JS engine and passes the results back out.

### 9. `pythonEngineStub.ts` (The Future Server-Side Stub)
This file isn't actually used by the application yet. It is an unused, documented stub for a potential future feature: moving the Python simulation engine completely off the user's computer and running it on a remote cloud server. If a developer wanted to build a cloud backend later, they would swap this file in to stream results back over the network.

## The Building Blocks (Node Types)

The simulation provides 15 different building blocks for the user to construct their diagrams. Here is what they represent in the real world:

1. **Arrival Point** (`source`): Where new customers, items, or requests first enter the system.
2. **Waiting Line** (`queue`): A physical or virtual line where things wait their turn because the next step is busy.
3. **Staff / Machine** (`resource`): A worker, a cashier, or a machine that can only serve a limited number of things at a time.
4. **Processing Step** (`service`): A step that takes a fixed or random amount of time (like an oven baking a cake).
5. **Split Path** (`decision`): A fork in the road that sends items down different paths by chance (e.g., 80% go left, 20% go right).
6. **Exit Point** (`sink`): The end of the line. Where things leave the system and final results (like total served) are counted.
7. **Tank / Reservoir** (`container`): Holds a continuous amount of something, like gallons of water or pounds of flour.
8. **Storage Buffer** (`store`): Holds a limited number of individual items until they are needed later.
9. **Condition Watcher** (`event_trigger`): Acts like a sensor. It waits for a specific condition to become true, then fires off a signal.
10. **Priority Staff / Machine** (`priority_resource`): Just like a normal Staff/Machine, but urgent or VIP items get to cut the line.
11. **Transmission Link** (`channel`): A pipe or a cable that carries a signal or message, but it takes time for the message to travel from one end to the other.
12. **Broadcast Hub** (`broadcaster`): Copies a single incoming message and sends the exact same copy out to every connected path at the same time.
13. **Wait For Any** (`any_of`): A gate that opens as soon as ONE of several expected things happens.
14. **Wait For All** (`all_of`): A gate that refuses to open until ALL of several expected things have happened.
15. **Interrupt Signal** (`interrupter`): A deliberate signal that forces another step to stop partway through (like an emergency stop button).

## The G1 and G18 Fixes Explained

During the rebuild, we found and fixed two completely separate bugs regarding these building blocks:

**Gap 1 (The Missing Python Blocks):** 
The Python Translator (`codeGenerator.ts`) simply forgot to include the code for `container`, `channel`, and `broadcaster` blocks. If a user placed them, the Python engine would just ignore them. We fixed this by adding the missing translation rules to `codeGenerator.ts`. For example, `broadcaster` now carefully duplicates (`copy.deepcopy`) messages so statistics aren't corrupted, and `channel` uses a capacity-bounded `simpy.Store` to model limits.

**Gap 18 (The Leaky JS Pipe):** 
Unlike the Python engine, the JavaScript Fallback Engine (`legacyWorker.ts`) *did* include the code for "Transmission Link" (`channel`) blocks. However, it had a bug: these links are supposed to have a maximum capacity (like a pipe that can only hold a set amount of water), but the JS code completely failed to enforce this limit. It let an infinite number of messages through at once. We fixed `legacyWorker.ts` so that it now correctly checks the buffer limit and drops excess messages, perfectly matching the fixed Python engine.

## A Worked Example

Let's walk through what happens when a user builds a simple, 3-block simulation of a coffee shop:
`Arrival Point` → `Waiting Line` → `Staff / Machine`

**Step 1: The Setup**
The user configures the blocks with "Fixed (always the same)" timings to remove randomness for this test:
- **Arrival Point:** 1 customer arrives every exactly **5 minutes**.
- **Staff / Machine:** Takes exactly **4 minutes** to serve one customer.

**Step 2: Generation**
When the user clicks "Run", `codeGenerator.ts` generates Python code that loops these precise instructions. Specifically, the generated rate-based arrival loop yields a timeout *before* spawning an entity. So it waits 5 minutes, spawns a customer, waits 5 minutes, spawns a customer, and so on. The `simpy.Resource` (Staff) is set with a capacity of 1 and yields a 4-minute timeout for service.

**Step 3: Execution**
The Python Manager runs this code. Here is exactly what the engine logs over a 15-minute simulation run (`env.run(until=15)`):
- **Minute 5:** Customer 1 arrives. The Staff is free. Customer 1 begins service.
- **Minute 9:** Staff finishes Customer 1 (4 minutes elapsed). Customer 1 goes to the Exit Point. Staff is now free.
- **Minute 10:** Customer 2 arrives. Staff is free, so Customer 2 begins service immediately.
- **Minute 14:** Staff finishes Customer 2. Customer 2 goes to the Exit Point. Staff is free.
- **Minute 15:** The simulation hits its maximum duration (`until=15`). Because SimPy halts the event loop *before* processing new events scheduled exactly at the boundary time, Customer 3 is never spawned.

**Step 4: The Results**
At Minute 15, the simulation stops. The engine takes a final snapshot of the stats and passes them back. Here are the actual numbers from a verified run of this exact graph through the engine:
- **Total Arrived:** 2 customers.
- **Total Completed:** 2 customers.
- **Average Wait Time:** 0 minutes (both customers arrived when the staff was free).
- **Average Service Time:** 4.0 minutes (exactly as configured).
- **Utilization:** 53.3% (0.533). The staff was busy from minute 5 to 9 and minute 10 to 14, for a total of 8 minutes busy out of the 15-minute simulation. 8 ÷ 15 = 53.3%.

These numbers are the literal output of the engine, verified by running the generated Python through SimPy (see `run_smoke_test.py` in the project root for the exact test harness used).
