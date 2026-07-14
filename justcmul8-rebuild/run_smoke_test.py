"""
Smoke test: run the exact generated Python through SimPy and print the raw result JSON.
This script stubs emit_sim_tick and emit_sim_result, then executes the generated code.
"""
import sys, os

# Read the generated script
with open(os.path.join(os.path.dirname(__file__), "test_sim.py"), "r") as f:
    code = f.read()

# Stub the Pyodide bridge functions that would normally exist in the worker
code = "def emit_sim_tick(x): pass\ndef emit_sim_result(x): print(x)\n" + code

exec(code)
