// Checks a value typed into the block properties panel before it reaches the model.
// Returns a corrective message, or null when the value is fine.

// Lines and stores use -1 for "unlimited"; everything else with a capacity needs at least 1.
const UNLIMITED_OK = new Set(["queue", "store", "channel"]);
// Times, rates and counts that can be zero (0 = off / instantaneous) but never negative.
const NON_NEGATIVE = /(Mean|Rate|Min|Max|Std|meanTimeBetweenFailures|burstSize|patience\w*)$/i;

export function invalidParamMessage(nodeType: string, key: string, value: unknown): string | null {
  if (typeof value !== "number") return null;
  if (!Number.isFinite(value)) return "Enter a number.";
  if (key === "capacity") {
    if (nodeType === "container") return value > 0 ? null : "Tank capacity must be greater than 0.";
    if (UNLIMITED_OK.has(nodeType)) {
      return value === -1 || (Number.isInteger(value) && value >= 1) ? null : "Capacity must be at least 1 (use -1 for unlimited).";
    }
    return Number.isInteger(value) && value >= 1 ? null : "Capacity must be a whole number of at least 1.";
  }
  if (NON_NEGATIVE.test(key) && value < 0) return "This value can't be negative.";
  return null;
}

/** The first problem among the params a panel edit changed, or null. */
export function invalidParamsChange(nodeType: string, before: Record<string, unknown> = {}, after: Record<string, unknown> = {}): string | null {
  for (const [key, value] of Object.entries(after)) {
    if (before[key] === value) continue;
    const msg = invalidParamMessage(nodeType, key, value);
    if (msg) return msg;
  }
  return null;
}
