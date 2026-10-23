import { defineConfig } from "vitest/config";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = __dirname;

// Files written for `node --test` (they import "node:test") run under `npm run test:node`;
// vitest would report them as "no test suite found".
function nodeTestFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) nodeTestFiles(p, out);
    else if (name.endsWith(".test.ts") && readFileSync(p, "utf8").includes('from "node:test"')) {
      out.push(path.relative(root, p).replace(/\\/g, "/"));
    }
  }
  return out;
}

export default defineConfig({
  resolve: { alias: { "@": path.join(root, "src") } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "src/**/*.test.ts"],
    exclude: ["node_modules/**", "tests/e2e/**", ...nodeTestFiles(path.join(root, "src"))],
    testTimeout: 60_000,
  },
});
