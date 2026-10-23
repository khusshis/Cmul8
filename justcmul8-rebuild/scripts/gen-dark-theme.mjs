// Generates src/app/theme-tokens.css: role-aware dark-mode values for every colour the app uses.
//   node scripts/gen-dark-theme.mjs
// Re-run after adding a new hex colour. Tune the look by editing the curves below, not the output.
//
// Roles (one hex can be used in several): fg = text/icons, sf = backgrounds/gradient stops, ln = borders/rings.
// Classes use them as text-fg-161622, bg-sf-5742ff, border-ln-ecebf7; inline styles as var(--color-fg-161622).
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");
const OUT = path.join(SRC, "app", "theme-tokens.css");

// ─── Colour math (sRGB hex ⇄ OKLCH) ───────────────────────────────────────────
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function hexToOklch(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), H: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}
const fmt = ({ L, C, H }) => `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(1)})`;

/** Piecewise-linear lookup through [x, y] anchors (x ascending). */
function curve(anchors, x) {
  if (x <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i++) {
    const [x1, y1] = anchors[i], [x0, y0] = anchors[i - 1];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return anchors.at(-1)[1];
}

// ─── Curves (the whole dark look lives here) ──────────────────────────────────
// Surfaces: pure white = raised card; near-whites = page / wells (darker); light greys = chips & hovers (lighter).
const SURFACE = [[0, 0.3], [0.35, 0.3], [0.85, 0.32], [0.9, 0.29], [0.93, 0.265], [0.955, 0.235], [0.975, 0.19], [0.988, 0.2], [0.997, 0.225], [1, 0.235]];
// Text: dark ink becomes light ink, mid greys stay readable.
// Light greys used as faint text on white (#cbd5e1) stay faint (dim ink), not bright.
const TEXT = [[0, 0.97], [0.2, 0.95], [0.3, 0.9], [0.45, 0.82], [0.55, 0.74], [0.7, 0.62], [0.8, 0.52], [0.95, 0.44]];
const LINE = [[0, 0.88], [0.4, 0.7], [0.6, 0.5], [0.8, 0.4], [0.9, 0.34], [1, 0.3]];

const accent = (c) => c.C >= 0.06; // anything clearly coloured

const roles = {
  fg(c) {
    if (c.L > 0.95 || (accent(c) && c.L > 0.85)) return c; // white-ish text sits on dark/colour fills in both themes
    if (accent(c)) return { L: Math.min(0.86, Math.max(c.L + 0.04, 0.75 + (0.55 - c.L) * 0.5)), C: c.C * 0.82, H: c.H };
    return { L: curve(TEXT, c.L), C: Math.min(c.C, 0.03), H: c.H };
  },
  sf(c) {
    if (accent(c) && c.L >= 0.35 && c.L < 0.85) return { L: Math.min(c.L + 0.02, 0.8), C: c.C * 0.86, H: c.H }; // solid fills: keep, calmer
    if (accent(c) && c.L < 0.35) return { L: Math.max(c.L, 0.24), C: c.C * 0.8, H: c.H };
    // Pastel tints (chips, domain washes) keep their hue so they don't turn into grey slabs; near-whites stay neutral.
    return { L: curve(SURFACE, c.L), C: c.C > 0.015 ? Math.min(c.C * 2.2, 0.08) : c.C * 1.2, H: c.H };
  },
  ln(c) {
    if (accent(c) && c.L >= 0.4 && c.L < 0.85) return { L: c.L, C: c.C * 0.8, H: c.H };
    return { L: curve(LINE, c.L), C: Math.min(c.C, 0.04), H: c.H };
  },
};

// ─── Scan the source ──────────────────────────────────────────────────────────
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|css)$/.test(e.name) && p !== OUT) files.push(p);
  }
})(SRC);

const used = new Map(); // "fg-161622" -> hex
const literals = new Set();
for (const f of files) {
  const text = fs.readFileSync(f, "utf8");
  for (const m of text.matchAll(/\b(fg|sf|ln)-([0-9a-f]{6})\b/g)) used.set(`${m[1]}-${m[2]}`, m[2]);
  for (const m of text.matchAll(/#([0-9a-fA-F]{6})\b/g)) literals.add(m[1].toLowerCase());
}
// Every literal hex gets all three roles so inline styles can use var(--color-<role>-<hex>).
for (const hex of literals) for (const r of Object.keys(roles)) used.set(`${r}-${hex}`, hex);

// ─── Tailwind palettes: shades 50–300 are tints (surface role), 400–500 mid, 600+ text ─
const twTheme = fs.readFileSync(path.join(ROOT, "node_modules/tailwindcss/theme.css"), "utf8");
const palette = [];
for (const m of twTheme.matchAll(/--color-([a-z]+)-(\d+):\s*oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)/g)) {
  const [, name, shade, L, C, H] = m;
  const c = { L: +L / 100, C: +C, H: +H };
  const n = +shade;
  // 300 is mostly faint text/decoration (text-gray-300): a dim ink that still reads as a border or fill.
  const dark = n === 300 ? { L: 0.47, C: c.C * 0.7, H: c.H }
    : roles[n < 300 ? "sf" : n >= 600 ? "fg" : accent(c) ? "sf" : "fg"](c);
  palette.push(`  --color-${name}-${shade}: ${fmt(dark)};`);
}

const keys = [...used.keys()].sort();
const light = keys.map((k) => `  --color-${k}: #${used.get(k)};`);
const dark = keys.map((k) => `  --color-${k}: ${fmt(roles[k.slice(0, 2)](hexToOklch(used.get(k))))};`);

fs.writeFileSync(
  OUT,
  `/* Generated by scripts/gen-dark-theme.mjs. Do not edit; change the curves there and re-run. */
@theme static {
${light.join("\n")}
}

.dark {
${dark.join("\n")}
${palette.join("\n")}
}
`
);
console.log(`theme-tokens.css: ${keys.length} role tokens, ${palette.length} palette shades`);
