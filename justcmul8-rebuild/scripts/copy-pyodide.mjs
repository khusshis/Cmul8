// Copies the Pyodide runtime (npm package) and the pinned SimPy wheel into public/pyodide/<version>/,
// so the simulation engine loads from our own origin instead of jsDelivr and PyPI.
// Runs before `next dev` and `next build` (predev/prebuild); the output folder is git-ignored.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = join(root, "node_modules", "pyodide");
const version = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")).version;
const out = join(root, "public", "pyodide", `v${version}`);
mkdirSync(out, { recursive: true });

for (const f of ["pyodide.js", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]) {
  copyFileSync(join(pkgDir, f), join(out, f));
}
const wheel = "simpy-4.1.2-py3-none-any.whl"; // keep in sync with SIMPY_WHEEL in src/lib/simulation/pyodideWorker.ts
copyFileSync(join(root, "scripts", "vendor", wheel), join(out, wheel));

if (!existsSync(join(out, "pyodide.asm.wasm"))) throw new Error("copy-pyodide: runtime missing");
console.log(`copy-pyodide: Pyodide ${version} + ${wheel} -> public/pyodide/v${version}/`);
