/**
 * textFormat.ts — makes the assistant's reply safe for a Markdown-only renderer.
 *
 * The chat panel renders Markdown, not LaTeX. The system prompt asks the model to
 * avoid math markup, and that instruction did stop it emitting backslashes (which
 * previously broke JSON parsing outright), but it still reliably emits `$...$`
 * delimiters and Unicode Greek letters. Measured output before this pass:
 *
 *     "**Arrival Rate ($λ$):** 0.5/sec ... $ρ$ = $0.5 / (2 × 0.333) = 0.75$"
 *
 * which the user sees verbatim, dollar signs and all. Asking a model more firmly
 * is not a fix; stripping it deterministically is.
 */

/** LaTeX commands, longest first so \rightarrow is not matched by \r-something. */
const COMMANDS: Array<[RegExp, string]> = [
  [/\\rightarrow\b/g, "->"],
  [/\\leftarrow\b/g, "<-"],
  [/\\approx\b/g, "~="],
  [/\\times\b/g, "x"],
  [/\\cdot\b/g, "*"],
  [/\\geq?\b/g, ">="],
  [/\\leq?\b/g, "<="],
  [/\\neq\b/g, "!="],
  [/\\infty\b/g, "infinity"],
  [/\\lambda\b/g, "lambda"],
  [/\\mu\b/g, "mu"],
  [/\\rho\b/g, "rho"],
  [/\\sigma\b/g, "sigma"],
  [/\\alpha\b/g, "alpha"],
  [/\\beta\b/g, "beta"],
  [/\\theta\b/g, "theta"],
  [/\\max\b/g, "max"],
  [/\\min\b/g, "min"],
  [/\\text\s*\{([^{}]*)\}/g, "$1"],
  [/\\mathrm\s*\{([^{}]*)\}/g, "$1"],
  [/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)"],
  [/\\sqrt\s*\{([^{}]*)\}/g, "sqrt($1)"],
];

/** Greek letters the model uses as symbols, spelled out for plain-text readers. */
const GREEK: Array<[RegExp, string]> = [
  [/λ/g, "lambda"],
  [/μ/g, "mu"],
  [/ρ/g, "rho"],
  [/σ/g, "sigma"],
  [/α/g, "alpha"],
  [/β/g, "beta"],
  [/θ/g, "theta"],
  [/∞/g, "infinity"],
];

function unwrapMath(inner: string): string {
  let out = inner;
  for (const [re, to] of COMMANDS) out = out.replace(re, to);
  for (const [re, to] of GREEK) out = out.replace(re, to);
  // _{max} -> _max, ^{2} -> ^2, then drop the braces entirely.
  out = out.replace(/([_^])\s*\{([^{}]*)\}/g, "$1$2");
  out = out.replace(/[{}]/g, "");
  // Any command we do not know about: keep the word, drop the backslash.
  out = out.replace(/\\([A-Za-z]+)/g, "$1");
  out = out.replace(/\\/g, "");
  return out.replace(/\s+/g, " ").trim();
}

/**
 * True when `$...$` content looks like maths rather than money. "$5 per item"
 * must survive untouched, while "$rho = 0.75$" must not.
 */
function looksLikeMath(inner: string): boolean {
  if (/\\|[λμρσαβθ∞]/.test(inner)) return true;
  // An equation or ratio, but not a plain currency amount like "1,200".
  if (/[=<>]|\/|\^|_|\\times|×/.test(inner) && !/^[\d,.\s]+$/.test(inner)) return true;
  return false;
}

/**
 * Converts LaTeX-ish markup in a model reply into plain Markdown.
 * Idempotent: running it twice changes nothing the second time.
 */
export function toPlainMarkdown(text: string): string {
  if (!text) return text;
  let out = text;

  // Display math first ($$...$$), then inline ($...$), single-line only so an
  // unpaired dollar cannot swallow the rest of the reply.
  out = out.replace(/\$\$([^$\n]{1,200})\$\$/g, (_m, inner) => unwrapMath(inner));
  out = out.replace(/\$([^$\n]{1,200})\$/g, (m, inner: string) =>
    looksLikeMath(inner) ? unwrapMath(inner) : m
  );

  // Commands and symbols outside any delimiters.
  for (const [re, to] of COMMANDS) out = out.replace(re, to);
  for (const [re, to] of GREEK) out = out.replace(re, to);

  // A leftover lone backslash is never meaningful in this UI.
  out = out.replace(/\\(?=[A-Za-z(){}[\]\s])/g, "");

  return out;
}
