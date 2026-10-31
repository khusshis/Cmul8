// Lists every package that ships in production, with its licence, for the /licenses page.
// Source: package-lock.json (exactly what Vercel installs), skipping dev-only packages.
// Run after changing dependencies:  npm run licenses
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "src/lib/legal/thirdPartyLicenses.json");
const lock = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"));

const pkgJson = (dir) => {
  const f = path.join(root, dir, "package.json");
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {};
};
// Older packages use a "licenses" array the lockfile doesn't copy.
const licenseOf = (dir, v) => v.license ?? pkgJson(dir).licenses?.map((l) => l.type ?? l).join(" OR ") ?? "UNKNOWN";
// The lockfile lists native binaries for every platform; only Linux x64 (glibc) installs on Vercel.
const shipsOnVercel = (v) =>
  (!v.os || v.os.includes("linux")) && (!v.cpu || v.cpu.includes("x64")) && (!v.libc || v.libc.includes("glibc"));

const repoOf = (dir, name) => {
  const pkg = pkgJson(dir);
  const r = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
  const url = r
    ? r.replace(/^git\+/, "").replace(/\.git$/, "").replace(/^git:\/\//, "https://").replace(/^github:/, "https://github.com/").replace(/^git@github\.com:/, "https://github.com/")
    : pkg.homepage;
  return url && /^https?:\/\//.test(url) ? url : `https://www.npmjs.com/package/${name}`;
};

// "devOptional" = needed for development, and only optionally referenced elsewhere (e.g. Next's optional
// peer @playwright/test). Keep one only if a real production package or the app itself depends on it.
const neededByProd = new Set(Object.keys(lock.packages[""].dependencies ?? {}));
for (const [dir, v] of Object.entries(lock.packages)) {
  if (!dir || v.dev || v.devOptional) continue;
  for (const n of Object.keys({ ...v.dependencies, ...v.optionalDependencies })) neededByProd.add(n);
}

const seen = new Map();
for (const [dir, v] of Object.entries(lock.packages)) {
  if (!dir || v.dev || v.link || !shipsOnVercel(v)) continue;
  const name = v.name ?? dir.slice(dir.lastIndexOf("node_modules/") + "node_modules/".length);
  if (v.devOptional && !neededByProd.has(name)) continue;
  const key = `${name}@${v.version}`;
  if (!seen.has(key)) seen.set(key, { name, version: v.version, license: licenseOf(dir, v), repository: repoOf(dir, name) });
}

const packages = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
writeFileSync(out, JSON.stringify({ packages }, null, 2) + "\n");

const byLicense = packages.reduce((m, p) => m.set(p.license, (m.get(p.license) ?? 0) + 1), new Map());
console.log(`${packages.length} packages -> ${path.relative(root, out)}`);
console.log([...byLicense].sort((a, b) => b[1] - a[1]).map(([l, n]) => `  ${l}: ${n}`).join("\n"));
