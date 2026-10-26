export interface DecisionRoute {
  targetId: string;
  probability: number;
}

/**
 * The paths a Decision block picks from. Mirrors get_target_for_decision() in the
 * generated SimPy script: routes to a real block keep their probabilities exactly, and
 * arrows out of the block with no route share whatever probability is left (all of it
 * when no routes are set), so a Decision wired only with arrows still splits its traffic.
 */
export function decisionChoices(
  routes: DecisionRoute[] | undefined,
  edgeTargets: string[],
  isNode: (id: string) => boolean
): DecisionRoute[] {
  const valid = (routes ?? []).filter((r) => r && isNode(r.targetId));
  const covered = new Set(valid.map((r) => r.targetId));
  const extra = [...new Set(edgeTargets)].filter((t) => !covered.has(t));
  if (!extra.length) return valid;
  const left = Math.max(0, 1 - valid.reduce((a, r) => a + (Number(r.probability) || 0), 0));
  return [...valid, ...extra.map((targetId) => ({ targetId, probability: left / extra.length }))];
}

/** Each target's real chance under the engine's cumulative pick (any shortfall falls to the first path). */
export function effectiveShares(choices: DecisionRoute[]): Map<string, number> {
  const out = new Map<string, number>();
  let cum = 0;
  for (const c of choices) {
    const next = Math.min(1, cum + (Number(c.probability) || 0));
    out.set(c.targetId, (out.get(c.targetId) ?? 0) + Math.max(0, next - cum));
    cum = Math.max(cum, next);
  }
  if (choices.length && cum < 1) out.set(choices[0].targetId, (out.get(choices[0].targetId) ?? 0) + 1 - cum);
  return out;
}

/**
 * A warning when a Decision's chances don't make sense, shown in its panel and before a run:
 * with every arrow given a chance they must total 100%, and set chances above 100% leave
 * the Auto arrows nothing. null when the routing is fine.
 */
export function routingWarning(routes: DecisionRoute[] | undefined, edgeTargets: string[], isNode: (id: string) => boolean): string | null {
  const valid = (routes ?? []).filter((r) => r && isNode(r.targetId) && edgeTargets.includes(r.targetId));
  const total = valid.reduce((a, r) => a + (Number(r.probability) || 0), 0);
  const covered = new Set(valid.map((r) => r.targetId));
  const autoArrows = [...new Set(edgeTargets)].filter((t) => !covered.has(t)).length;
  const pct = `${Math.round(total * 100)}%`;
  if (!valid.length) return null;
  if (!autoArrows && Math.abs(total - 1) > 0.005) return `Path chances add up to ${pct}, not 100%.`;
  if (autoArrows && total > 1.005) return `Set chances already add up to ${pct}, so paths left on Auto get nothing.`;
  return null;
}
