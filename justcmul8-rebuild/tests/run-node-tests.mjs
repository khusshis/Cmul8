// Runs every *.test.ts under src/ that is written for `node --test` (imports "node:test").
import { readFileSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith(".test.ts") && readFileSync(p, "utf8").includes('from "node:test"')) files.push(p);
  }
})(path.resolve("src"));

if (!files.length) { console.log("No node:test files found."); process.exit(0); }
const r = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(r.status ?? 1);
