"""Executes a script produced by generateSimPyScript() under CPython + SimPy with the
Pyodide host callbacks stubbed, then prints the emitted result as JSON on the last line.
Usage: python run_generated.py <script.py> <seed>"""
import json
import random
import sys

src = open(sys.argv[1], encoding="utf-8").read()
random.seed(int(sys.argv[2]) if len(sys.argv) > 2 else 1)
captured = {}
ns = {
    "__name__": "__justcmul8_sim__",
    "emit_sim_result": lambda s: captured.__setitem__("result", json.loads(s)),
    "emit_sim_tick": lambda s: None,
}
exec(compile(src, "<generated-simpy>", "exec"), ns)
print("\n" + json.dumps(captured.get("result", {}).get("data")))
