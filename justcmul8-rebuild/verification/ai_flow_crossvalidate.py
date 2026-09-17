"""
Cross-validates flowAnalysis.ts against the real SimPy engine.

The AI assistant no longer computes lambda/mu/rho itself -- it quotes the figures
that src/lib/ai/flowAnalysis.ts hands it. (It used to do the arithmetic, and its
prose was not reliably self-consistent: one reply asserted "rho = 1.13 because 2
cashiers taking 45s each can only handle 160 customers/hour" against 360
arrivals/hour, where 360/160 is 2.25. Free text cannot be validated after the
fact, so the calculation moved server-side.)

That only helps if the calculation is right, which is what this checks: predicted
utilisation from the TypeScript module against measured utilisation from running
the generated SimPy script.

Usage:
    pip install simpy
    cd justcmul8-rebuild/verification
    python ai_flow_crossvalidate.py
"""
from __future__ import annotations

import json
import os
import shutil
import statistics
import subprocess
import sys
import tempfile

import engine_harness as H

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)

DURATION = 40_000
SEEDS = 3
TOLERANCE_PCT = 4.0

PREDICT_JS = """
const fs = require("fs");
const { analyseFlow } = require(process.argv[2] + "/flowAnalysis.js");
const graphs = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const out = {};
for (const [name, g] of Object.entries(graphs)) out[name] = analyseFlow(g.nodes, g.edges);
fs.writeFileSync(process.argv[4], JSON.stringify(out));
"""


def predictions(graphs_path: str) -> dict:
    """Compiles the TS module and runs it over the fixtures."""
    build = tempfile.mkdtemp(prefix="flowbuild-")
    try:
        subprocess.run(
            ["npx", "tsc",
             os.path.join(REPO, "src", "lib", "ai", "flowAnalysis.ts"),
             os.path.join(REPO, "src", "lib", "ai", "graphOps.ts"),
             "--outDir", build, "--module", "commonjs", "--target", "es2020",
             "--esModuleInterop", "--skipLibCheck"],
            cwd=REPO, check=True, shell=(os.name == "nt"),
            stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT,
        )
        script = os.path.join(build, "predict.js")
        out_path = os.path.join(build, "predicted.json")
        with open(script, "w", encoding="utf-8") as fh:
            fh.write(PREDICT_JS)
        subprocess.run(
            ["node", script, build.replace("\\", "/"), graphs_path, out_path],
            cwd=REPO, check=True, shell=(os.name == "nt"),
            env=dict(os.environ, NODE_PATH=os.path.join(REPO, "node_modules")),
        )
        return json.load(open(out_path, encoding="utf-8"))
    finally:
        shutil.rmtree(build, ignore_errors=True)


def main() -> int:
    graphs_path = os.path.join(HERE, "ai_flow_graphs.json")
    graphs = json.load(open(graphs_path, encoding="utf-8"))
    predicted = predictions(graphs_path)

    tpl = H.extract_template()
    _, tick = H.ui_run_config(DURATION, "secs")

    print(f"\nHorizon {DURATION}s, {SEEDS} seeds, tolerance +/-{TOLERANCE_PCT}%\n")
    print(f"{'graph / station':40} {'predicted rho':>13} {'measured rho':>13} {'delta':>9}  result")
    print("-" * 94)

    failures = 0
    for name, g in graphs.items():
        runs = [
            H.run_script(
                H.generate_script(tpl, {"nodes": g["nodes"], "edges": g["edges"]}, DURATION, tick),
                seed=500 + i,
            )
            for i in range(SEEDS)
        ]
        pred_by_id = {s["id"]: s for s in predicted[name]["stations"]}

        for node in g["nodes"]:
            p = pred_by_id.get(node["id"], {})
            if p.get("rho") is None:
                continue  # only resource-like blocks have a utilisation to compare
            measured = statistics.fmean(r["nodeStats"][node["id"]]["utilization"] for r in runs)
            rho = p["rho"]
            if rho >= 1.0:
                # The engine clamps utilisation at 1.0, so an overloaded station
                # can only be compared up to saturation.
                ok, delta = measured > 0.97, "n/a"
            else:
                delta_pct = (measured - rho) / rho * 100
                ok, delta = abs(delta_pct) <= TOLERANCE_PCT, f"{delta_pct:+.2f}%"
            failures += 0 if ok else 1
            print(f"{name + '/' + node['label']:40} {rho:13.4f} {measured:13.4f} {delta:>9}  "
                  f"{'PASS' if ok else 'FAIL'}")

        # A model predicted to be stable must actually clear its load.
        pa = predicted[name]
        if pa.get("converged") and (pa.get("headroomFactor") or 0) >= 1:
            arrived = statistics.fmean(r["totalArrived"] for r in runs)
            completed = statistics.fmean(r["totalCompleted"] for r in runs)
            clearance = completed / max(1, arrived)
            ok = clearance > 0.97
            failures += 0 if ok else 1
            print(f"{name + '/clearance (predicted stable)':40} {'-':>13} {clearance:13.4f} {'-':>9}  "
                  f"{'PASS' if ok else 'FAIL'}")

    print("-" * 94)
    print("all predictions match the engine" if not failures else f"{failures} mismatch(es)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
