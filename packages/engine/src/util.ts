import { GROUP_KEYS, STAT_KEYS, STAT_RANGE, TURN_CAP, type GameState, type GroupKey, type StatKey, type Target } from "@ps/shared";

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Indexing helper for `noUncheckedIndexedAccess`: a missing element is a bug, not a value. */
export function at<T>(arr: readonly T[], i: number): T {
  const v = arr[i];
  if (v === undefined) throw new RangeError(`index ${i} out of range (length ${arr.length})`);
  return v;
}

export function groupOf(target: Target): GroupKey | null {
  if (!target.startsWith("group:")) return null;
  return target.slice("group:".length) as GroupKey;
}

export function isStatKey(x: string): x is StatKey {
  return (STAT_KEYS as readonly string[]).includes(x);
}

export function isGroupKey(x: string): x is GroupKey {
  return (GROUP_KEYS as readonly string[]).includes(x);
}

/** TURN_CAP for a target: stats by key, voter groups by "group". */
export function turnCap(target: Target): number {
  const g = groupOf(target);
  return g === null ? TURN_CAP.value[target as StatKey] : TURN_CAP.value.group;
}

export function capDelta(target: Target, delta: number): number {
  const cap = turnCap(target);
  return clamp(delta, -cap, cap);
}

/** Adds `delta` to a stat or a group's satisfaction in place, then clamps to the allowed range. */
export function applyDelta(state: GameState, target: Target, delta: number): void {
  const g = groupOf(target);
  if (g !== null) {
    const grp = state.groups[g];
    grp.satisfaction = clamp(grp.satisfaction + delta, 0, 100);
    return;
  }
  const k = target as StatKey;
  const [lo, hi] = STAT_RANGE[k];
  state.stats[k] = clamp(state.stats[k] + delta, lo, hi);
}

export function currentValue(state: GameState, target: Target): number {
  const g = groupOf(target);
  return g === null ? state.stats[target as StatKey] : state.groups[g].satisfaction;
}

export function isEventPolicy(policyId: string): boolean {
  return policyId.startsWith("event:");
}

/** Sum of player-policy (non-event) and event slices that cover `quarter`, per target. */
export function sliceSums(state: GameState, quarter: number): { player: Map<Target, number>; event: Map<Target, number> } {
  const player = new Map<Target, number>();
  const event = new Map<Target, number>();
  for (const e of state.scheduled) {
    if (e.fromQuarter > quarter || e.toQuarter < quarter) continue;
    const m = isEventPolicy(e.policyId) ? event : player;
    m.set(e.target, (m.get(e.target) ?? 0) + e.deltaPerQuarter);
  }
  return { player, event };
}

/** Clamp all stats and satisfactions to their ranges (used after bulk edits). */
export function clampState(state: GameState): void {
  for (const k of STAT_KEYS) {
    const [lo, hi] = STAT_RANGE[k];
    state.stats[k] = clamp(state.stats[k], lo, hi);
  }
  for (const g of GROUP_KEYS) state.groups[g].satisfaction = clamp(state.groups[g].satisfaction, 0, 100);
}
