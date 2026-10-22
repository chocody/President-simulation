import type { Effect, Evidence } from "@ps/shared";

/**
 * Level 2-3 keeps its level only if at least one of the effect's evidence ids is in `provided`, has the same
 * indicator, and has the same direction (or "mixed"). Otherwise it becomes "1". Level 1 never needs evidence.
 */
export function effectiveLevel(
  effect: Pick<Effect, "indicator" | "direction" | "level" | "evidence_ids">,
  provided: Map<string, Evidence>,
): { level: "1" | "2" | "3"; downgraded: boolean } {
  if (effect.level === "1") return { level: "1", downgraded: false };
  const ok = effect.evidence_ids.some((id) => {
    const ev = provided.get(id);
    return ev !== undefined
      && ev.indicator === effect.indicator
      && (ev.direction === effect.direction || ev.direction === "mixed");
  });
  return ok ? { level: effect.level, downgraded: false } : { level: "1", downgraded: true };
}
