// The engine keeps every time in seconds and every rate per second. People think in
// "30 customers an hour" and "a 4-minute consult", so inputs and labels convert at the edge.

export type TimeUnit = "sec" | "min" | "hr" | "day";

export const TIME_UNITS: { id: TimeUnit; seconds: number; plural: string; per: string; short: string }[] = [
  { id: "sec", seconds: 1, plural: "seconds", per: "per second", short: "sec" },
  { id: "min", seconds: 60, plural: "minutes", per: "per minute", short: "min" },
  { id: "hr", seconds: 3600, plural: "hours", per: "per hour", short: "hr" },
  { id: "day", seconds: 86400, plural: "days", per: "per day", short: "day" },
];

export const unitSeconds = (u: TimeUnit) => TIME_UNITS.find((x) => x.id === u)!.seconds;

/** Drops float noise from conversions: 0.0333… × 60 shows as 2, not 1.9999999999. */
export const tidy = (v: number) => (Number.isFinite(v) ? Number(v.toPrecision(6)) : 0);

/** The unit a person would say this duration in: 45 → sec, 60 → min, 7200 → hr. */
export function bestTimeUnit(seconds: number): TimeUnit {
  const s = Math.abs(seconds);
  if (!Number.isFinite(s) || s < 60) return "sec";
  if (s < 7200) return "min";
  if (s < 172800) return "hr";
  return "day";
}

/** The unit a person would count this rate in: 2/s → per second, 0.05/s → per minute (3), 0.001/s → per hour. */
export function bestRateUnit(perSecond: number): TimeUnit {
  const r = Math.abs(perSecond);
  if (!Number.isFinite(r) || r === 0) return "min";
  if (r >= 1) return "sec";
  if (r * 60 >= 1) return "min";
  return r * 3600 >= 1 ? "hr" : "day";
}

const TIME_PARAMS = new Set(["serviceTimeMean", "durationMean", "patienceTimeout", "propagationDelay", "repairTimeMean", "meanTimeBetweenFailures"]);
const RATE_PARAMS = new Set(["arrivalRate", "fillRate", "drainRate"]);

/** Whether a block param is stored in seconds ("time"), per second ("rate"), or is a plain number. */
export const paramKind = (key: string): "time" | "rate" | null =>
  TIME_PARAMS.has(key) ? "time" : RATE_PARAMS.has(key) ? "rate" : null;

/** "45 sec", "5 min", "1.5 hr" */
export function fmtDuration(seconds: number): string {
  const u = TIME_UNITS.find((x) => x.id === bestTimeUnit(seconds))!;
  return `${tidy(+(seconds / u.seconds).toFixed(2))} ${u.short}`;
}

/** A per-second rate in the unit that reads best: { value: 2, per: "per minute", short: "min" }. */
export function perTimeParts(perSecond: number) {
  const u = TIME_UNITS.find((x) => x.id === bestRateUnit(perSecond))!;
  return { value: tidy(+(perSecond * u.seconds).toFixed(2)), per: u.per, short: u.short };
}

/** "2 per minute", "30 per hour" */
export function fmtPerTime(perSecond: number): string {
  const p = perTimeParts(perSecond);
  return `${p.value} ${p.per}`;
}
