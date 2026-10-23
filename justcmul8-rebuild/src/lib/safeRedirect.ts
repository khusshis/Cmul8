/**
 * Same-origin relative path or `fallback`. Rejects `//host` and `/\host` (browsers
 * treat a backslash as a slash), and anything that resolves to another origin.
 */
export function safeRedirect(raw: string | null | undefined, fallback = "/dashboard") {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  try {
    const base = "http://same.origin";
    const url = new URL(raw, base);
    return url.origin === base ? url.pathname + url.search + url.hash : fallback;
  } catch {
    return fallback;
  }
}
