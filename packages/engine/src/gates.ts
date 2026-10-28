import { GATES, type Action, type GameState, type GroupKey } from "@ps/shared";
import type { Rng } from "./rng";
import { levelToDelta } from "./scales";

type CourtCheck = GameState["courtChecks"][number];

export interface ParliamentResult {
  required: boolean;
  vote: number | null;
  passed: boolean;
}

/** Only for measures that need legislation. vote > passAbove passes. `voteAdjust` is institutional friction (default 0). */
export function parliamentVote(state: GameState, action: Action, rng: Rng, voteAdjust = 0): ParliamentResult {
  if (!action.requires_legislation) return { required: false, vote: null, passed: true };
  const g = GATES.parliament.value;
  const levels = action.group_impacts
    .filter((gi) => gi.direction === "down")
    .reduce((a, gi) => a + Number(gi.level), 0);
  const conflict = Math.min(g.conflictMax, g.conflictPerLevel * levels);
  const noise = (rng.next() * 2 - 1) * g.noise;
  const vote = state.stats.parliament + g.popularityWeight * (state.popularity - 50) - conflict + noise + voteAdjust;
  return { required: true, vote, passed: vote > g.passAbove };
}

/** Medium/high legal risk: a court check 1-3 quarters after `quarter`. Others: null. */
export function courtCheck(action: Action, quarter: number, rng: Rng, policyId = ""): CourtCheck | null {
  const c = GATES.court.value;
  if (action.legal_risk !== "medium" && action.legal_risk !== "high") return null;
  const chance = action.legal_risk === "medium" ? c.medium : c.high;
  return { policyId, atQuarter: quarter + rng.int(c.delayMin, c.delayMax), chance };
}

export interface ProtestResult {
  group: GroupKey | null;
  happened: boolean;
  /** Stability points lost at once (0 when no protest). */
  stabilityHit: number;
  /** Quarters the action is delayed (0 when no protest). */
  delayQuarters: number;
}

/**
 * For each "down" group impact: projected satisfaction = current − |delta|·(1 − mitigation).
 * Below the threshold, a protest happens with the configured chance. At most one protest per action.
 */
export function protest(state: GameState, action: Action, mitigation: number, rng: Rng): ProtestResult {
  const p = GATES.public.value;
  for (const gi of action.group_impacts) {
    if (gi.direction !== "down") continue;
    const projected =
      state.groups[gi.group].satisfaction
      - Math.abs(levelToDelta(`group:${gi.group}`, gi.level, "down")) * (1 - mitigation);
    if (projected < p.threshold && rng.next() < p.chance) {
      return { group: gi.group, happened: true, stabilityHit: p.stabilityHit, delayQuarters: p.delayQuarters };
    }
  }
  return { group: null, happened: false, stabilityHit: 0, delayQuarters: 0 };
}
