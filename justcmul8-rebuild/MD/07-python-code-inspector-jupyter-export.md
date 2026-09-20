# Feature: Live Python/SimPy Code Inspector + Jupyter Notebook Export

## Status before this feature
**Not started (0%).** `src/lib/simulation/codeGenerator.ts`'s `generateSimPyScript(graph, durationSeconds, tickIntervalSeconds)` already exists and produces real, complete, runnable Python SimPy source (built by filling in `PYTHON_TEMPLATE`, a 750-line template with configuration, event handling, and KPI collection logic). It is called from exactly one place — `src/lib/simulation/pyodideWorker.ts:63-67` — to drive the simulation inside Pyodide. **It is never shown to the user.** Grep confirms zero UI components read or display this generated code, and zero matches for `ipynb`/`jupyter` anywhere in `src/`.

## What this feature does
1. A **"</> View Python Code"** button/panel that shows the exact, real SimPy script this simulation run against — read-only, syntax-highlighted.
2. A **"Download as Jupyter Notebook (.ipynb)"** button that packages the same script (plus a markdown cell explaining it and a results-summary cell) into a valid, openable `.ipynb` file.

This is the feature that proves mathematical/scientific authenticity — it directly rebuts "is this actually running Python SimPy, or is it a JS approximation dressed up?" (a fair question, since `clientEngine.ts`/`legacyWorker.ts` *do* exist as a JS fallback approximation for when Pyodide fails to load — see `pyodideEngine.ts:60-69`). Showing the real generated script, and letting the user run it themselves in Jupyter outside the browser, is the strongest possible proof.

---

## Implementation plan

### Step 1 — Expose the already-generated script to the UI layer

The script is currently generated fresh inside the worker at run time (`pyodideWorker.ts:63`) and never sent back out. Two options:

- **(Recommended) Generate it again on the client, on demand.** `generateSimPyScript()` (`codeGenerator.ts`) is a pure function — same `graph`/`durationSeconds`/`tickIntervalSeconds` in, same script out, no side effects, no Pyodide dependency required to call it. It can be imported and called directly from a React component or `page.tsx`, without touching the worker at all:

```ts
import { generateSimPyScript } from "@/lib/simulation/codeGenerator";

const { python } = generateSimPyScript(simGraph, totalDurationSeconds, tickInterval);
```

This means the Code Inspector doesn't even need a live/completed run — it can show the script for the *current graph as configured*, updating live as the user edits node parameters, which is arguably more useful than only showing it after a run completes.

- (Alternative) Have `pyodideWorker.ts` post the generated script back to the main thread once (`emit({ type: "generated_script", python })` right after `generateSimPyScript()` is called at line 63) and store it in state on `onComplete`. More plumbing for no real benefit over the Recommended approach — skip unless there's a reason the script must reflect exactly what the worker executed versus what would be regenerated from current state (they're identical as long as the graph hasn't changed since the last run, which is the common case).

### Step 2 — Syntax highlighting

No syntax highlighter is currently installed (`package.json` has no `prismjs`/`react-syntax-highlighter`/`shiki`). Add one:

```bash
npm install react-syntax-highlighter
npm install -D @types/react-syntax-highlighter
```

`react-syntax-highlighter` is the most common choice, ships prebuilt themes, and works fine in Next.js client components (`"use client"`).

### Step 3 — Build the Code Inspector panel

New file: `src/components/workspace/CodeInspectorPanel.tsx`

```tsx
"use client";
import { useMemo, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Code2, Copy, Check, Download, X } from "lucide-react";
import { generateSimPyScript } from "@/lib/simulation/codeGenerator";
import { buildJupyterNotebook } from "@/lib/simulation/jupyterExport";
import type { SimGraph, SimResult } from "@/lib/simulation/types";

export default function CodeInspectorPanel({
  open, onClose, graph, durationSeconds, tickIntervalSeconds, result, projectName,
}: {
  open: boolean;
  onClose: () => void;
  graph: SimGraph;
  durationSeconds: number;
  tickIntervalSeconds: number;
  result: SimResult | null;
  projectName: string;
}) {
  const [copied, setCopied] = useState(false);

  const python = useMemo(
    () => generateSimPyScript(graph, durationSeconds, tickIntervalSeconds).python,
    [graph, durationSeconds, tickIntervalSeconds]
  );

  function handleCopy() {
    navigator.clipboard.writeText(python);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleDownloadNotebook() {
    const notebook = buildJupyterNotebook(python, projectName, result);
    const blob = new Blob([JSON.stringify(notebook, null, 2)], { type: "application/x-ipynb+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, "_")}_simulation.ipynb`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full h-full max-w-[900px] max-h-[85vh] bg-[#1e1e1e] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 h-14 border-b border-white/10 bg-[#252526]">
          <div className="flex items-center gap-2 text-white">
            <Code2 size={16} className="text-[#8B7CFF]" />
            <span className="text-[13px] font-bold">Generated SimPy Script</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-[11.5px] font-bold hover:bg-white/20">
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
            </button>
            <button onClick={handleDownloadNotebook} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5742FF] text-white text-[11.5px] font-bold hover:bg-[#4835E0]">
              <Download size={13} /> Download .ipynb
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:bg-white/10">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <SyntaxHighlighter language="python" style={oneDark} customStyle={{ margin: 0, height: "100%", fontSize: 12.5 }}>
            {python}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  );
}
```

### Step 4 — Jupyter Notebook (`.ipynb`) serializer

New file: `src/lib/simulation/jupyterExport.ts`

An `.ipynb` file is just JSON in a specific schema (`nbformat` 4). No library is needed to produce a valid one — hand-build the JSON structure:

```ts
import type { SimResult } from "./types";

interface NotebookCell {
  cell_type: "markdown" | "code";
  metadata: Record<string, unknown>;
  source: string[];
  outputs?: unknown[];
  execution_count?: number | null;
}

export function buildJupyterNotebook(
  pythonScript: string,
  projectName: string,
  result: SimResult | null
): object {
  const cells: NotebookCell[] = [
    {
      cell_type: "markdown",
      metadata: {},
      source: [
        `# ${projectName} — Discrete Event Simulation\n`,
        `\n`,
        `Auto-exported from **JustCmul8**. This notebook contains the exact SimPy script generated from the\n`,
        `visual simulation graph. Run the cell below in a standard Jupyter/Python environment with \`simpy\` installed\n`,
        `(\`pip install simpy\`) to reproduce identical results outside the browser.\n`,
      ],
    },
    {
      cell_type: "code",
      metadata: {},
      execution_count: null,
      outputs: [],
      // nbformat requires source split into an array of lines, each retaining its trailing "\n"
      // except optionally the last line — Jupyter renders it back as one continuous script either way.
      source: pythonScript.split("\n").map((line, i, arr) => (i < arr.length - 1 ? line + "\n" : line)),
    },
  ];

  if (result) {
    cells.push({
      cell_type: "markdown",
      metadata: {},
      source: [
        `## Results From the JustCmul8 Run\n`,
        `\n`,
        `| Metric | Value |\n`,
        `|---|---|\n`,
        `| Total Arrived | ${result.totalArrived} |\n`,
        `| Total Completed | ${result.totalCompleted} |\n`,
        `| Health Score | ${result.healthScore ?? "N/A"}/100 |\n`,
        `| Bottleneck | ${result.bottleneckLabel || "None detected"} |\n`,
        result.costAnalysis ? `| Total System Cost | $${result.costAnalysis.totalSystemCost.toFixed(2)} |\n` : "",
      ].filter(Boolean),
    });
  }

  return {
    cells,
    metadata: {
      kernelspec: { display_name: "Python 3", language: "python", name: "python3" },
      language_info: { name: "python", version: "3.11" },
    },
    nbformat: 4,
    nbformat_minor: 5,
  };
}
```

**Validate before shipping:** open the produced `.ipynb` in Jupyter/VS Code/Google Colab once during development to confirm it actually opens cleanly (a common mistake is malformed `source` line-splitting — each array element must be a single line including its own `\n`, except the notebook spec tolerates the final line either way). This is a zero-dependency, hand-rolled serializer, so it's worth one manual verification pass rather than trusting the schema from memory.

### Step 5 — Wire the panel into the workspace

File: `src/app/dashboard/project/[id]/page.tsx`

Add a toolbar button (near the Engine Status pill, `page.tsx:414`, or near the Run/Pause/Stop controls around line 496) — e.g. `</> View Code`:

```tsx
const [codeInspectorOpen, setCodeInspectorOpen] = useState(false);

<button
  onClick={() => setCodeInspectorOpen(true)}
  className="flex items-center gap-1.5 px-3 h-[34px] rounded-full bg-white border border-gray-200 text-[#111827] text-[12.5px] font-bold shadow-sm hover:border-indigo-200"
>
  <Code2 size={14} /> View Code
</button>

<CodeInspectorPanel
  open={codeInspectorOpen}
  onClose={() => setCodeInspectorOpen(false)}
  graph={graphToSimNodes(nodes, edges)}
  durationSeconds={totalDurationSecondsComputedInHandleRun /* factor the duration calc in handleRun (page.tsx:273-279) into a small helper so both handleRun and this panel share it, rather than duplicating the unit-conversion math */}
  tickIntervalSeconds={tickInterval /* same factoring note */}
  result={simResult}
  projectName={project?.name || "Untitled Simulation"}
/>
```

**Small refactor needed:** `handleRun()` (`page.tsx:266-299`) currently computes `totalDurationSeconds`/`tickInterval` inline from `durationValue`/`durationUnit` state. Extract that into a small `computeSimTiming(durationValue, durationUnit): { totalDurationSeconds, tickInterval }` helper (a few lines, pure function) so both `handleRun()` and the new Code Inspector panel call the same logic instead of duplicating the `unitMultipliers` table.

---

## Files touched
- `src/components/workspace/CodeInspectorPanel.tsx` — new
- `src/lib/simulation/jupyterExport.ts` — new
- `src/app/dashboard/project/[id]/page.tsx` — new toolbar button, new panel mount, small `computeSimTiming` extraction
- `package.json` — add `react-syntax-highlighter` (+ `@types/react-syntax-highlighter` dev dep)

## Definition of done
- [ ] "View Code" button opens a panel showing real, correctly-indented Python that matches what `generateSimPyScript()` produces for the current graph (spot-check against `pyodideWorker.ts`'s actual execution — they should be byte-identical for the same graph/duration/tickInterval inputs).
- [ ] Copy button copies the full script to clipboard.
- [ ] "Download .ipynb" produces a file that opens without error in Jupyter Notebook, JupyterLab, VS Code's notebook viewer, or Google Colab (test at least one).
- [ ] The downloaded notebook's code cell, when run in a real Python environment with `pip install simpy`, executes without syntax errors (the script was already designed to run inside Pyodide's Python 3 environment, so it should be directly CPython-compatible — but Pyodide-specific globals like `emit_sim_tick`/`emit_sim_result` calls, which are injected via `pyodide.globals.set(...)` in `pyodideWorker.ts:70-75`, will NOT exist in a plain Python environment and will raise `NameError`. Either strip those calls in the exported version, or stub them with no-op Python functions prepended to the notebook's code cell — e.g. `def emit_sim_tick(x): pass` / `def emit_sim_result(x): pass` — so the script runs standalone without modification. Add this stubbing inside `buildJupyterNotebook()` before packaging the script, not by editing `codeGenerator.ts`'s template itself, since the Pyodide path still needs the real callbacks.)
