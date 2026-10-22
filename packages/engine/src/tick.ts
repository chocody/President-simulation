import {
  DISCRETIONARY_BUDGET_PCT_GDP, EARLY_ENDINGS, PACING, STAT_KEYS, STAT_RANGE, TICK,
  type Card, type EndReason, type GameState,
} from "@ps/shared";
import { EngineError } from "./errors";
import { pickCard } from "./events";
import { groupTarget, pillarScores, popularity } from "./goodness";
import { runElection } from "./election";
import { Rng } from "./rng";
import { applyDelta, capDelta, clamp, sliceSums } from "./util";

/** Quarters of the term; the last one is the election. */
const LAST_QUARTER = PACING.value.quarters;

/** Early endings are rolled in this order; the first one that triggers ends the game. */
function rollEarlyEnding(state: GameState, rng: Rng): EndReason | null {
  const imp = EARLY_ENDINGS.impeached.value;
  if (state.stats.parliament < imp.parliamentBelow && state.stats.corruption > imp.corruptionAbove) {
    if (rng.next() < imp.chance) return "impeached";
  }

  const coup = EARLY_ENDINGS.coup.value;
  const military = state.groups.military.satisfaction;
  if (military < coup.militaryBelow && state.stats.stability < coup.stabilityBelow) {
    // Plan formula: base + (militaryBelow − military satisfaction) × perPoint.
    const points = coup.militaryBelow - military;
    const chance = clamp(coup.base + coup.perPoint * points, 0, 1);
    if (rng.next() < chance) return "coup";
  }

  const up = EARLY_ENDINGS.uprising.value;
  if (state.popularity < up.popularityBelow && state.stats.stability < up.stabilityBelow) {
    if (rng.next() < up.chance) return "uprising";
  }
  return null;
}

/** Moves the game from the end of one quarter to the next (or runs the election after quarter 16). */
export function advanceQuarter(state: GameState, deck: readonly Card[]): GameState {
  if (state.phase !== "running") throw new EngineError(`advanceQuarter needs phase "running", got "${state.phase}"`);
  const rng = new Rng(state.seed, state.rngCursor);

  if (state.quarter >= LAST_QUARTER) return runElection(state, rng);

  const s = structuredClone(state);
  const q = s.quarter + 1;
  s.quarter = q;

  // 1. Scheduled slices covering q. Player policies are capped per target; event slices are not.
  const sums = sliceSums(s, q);
  for (const [target, sum] of sums.player) applyDelta(s, target, capDelta(target, sum));
  for (const [target, sum] of sums.event) applyDelta(s, target, sum);
  s.scheduled = s.scheduled.filter((e) => e.toQuarter >= q);

  // 2. Mean reversion toward the country's baseline (not budget or debt).
  for (const k of STAT_KEYS) {
    if (k === "budget" || k === "debt") continue;
    s.stats[k] += TICK.meanReversion.value * (s.baseline[k] - s.stats[k]);
  }

  // 3. Budget: yearly room (cut by debt interest) / 4, minus recurring costs / 4. A shortfall becomes debt.
  const d = TICK.debtInterest.value;
  const cut = s.stats.debt > d.threshold ? d.budgetCutPer10 * Math.floor((s.stats.debt - d.threshold) / 10) : 0;
  const income = (DISCRETIONARY_BUDGET_PCT_GDP.value[s.difficulty] - cut) / 4;
  const recurring = s.recurring.filter((r) => r.untilQuarter >= q).reduce((a, r) => a + r.pctGdpPerYear / 4, 0);
  let budget = s.stats.budget + income - recurring;
  if (budget < 0) {
    s.stats.debt += -budget;
    budget = 0;
  }
  s.stats.budget = budget;
  s.recurring = s.recurring.filter((r) => r.untilQuarter > q);

  // 4. Court checks due now.
  const due = s.courtChecks.filter((c) => c.atQuarter <= q);
  s.courtChecks = s.courtChecks.filter((c) => c.atQuarter > q);
  for (const c of due) {
    if (rng.next() < c.chance) {
      // Slices of this quarter were already applied; only what is left is removed.
      s.scheduled = s.scheduled
        .map((e) => (e.policyId === c.policyId && e.toQuarter > q ? { ...e, toQuarter: q } : e))
        .filter((e) => e.fromQuarter <= e.toQuarter);
      s.recurring = s.recurring.filter((r) => r.policyId !== c.policyId);
      s.log.push(`q${q}: court suspended measure ${c.policyId}`);
    } else {
      s.log.push(`q${q}: court allowed measure ${c.policyId}`);
    }
  }

  // 5. Group drift toward the goodness of what they care about; popularity; economy history.
  for (const g of Object.keys(s.groups) as (keyof GameState["groups"])[]) {
    const grp = s.groups[g];
    grp.satisfaction = clamp(grp.satisfaction + TICK.groupDrift.value * (groupTarget(g, s.stats) - grp.satisfaction), 0, 100);
  }
  for (const k of STAT_KEYS) {
    const [lo, hi] = STAT_RANGE[k];
    s.stats[k] = clamp(s.stats[k], lo, hi);
  }
  s.popularity = popularity(s.groups);
  s.econHistory.push(pillarScores(s.stats).economy);

  // 6. Early endings.
  const ending = rollEarlyEnding(s, rng);
  if (ending !== null) {
    s.phase = "ended";
    s.endReason = ending;
    s.pendingCardId = null;
    s.log.push(`q${q}: term ended early (${ending})`);
    s.rngCursor = rng.cursor;
    return s;
  }

  // 7. Decision quarter: draw an event card if one is eligible.
  if (PACING.value.decisionQuarters.includes(q)) {
    const card = pickCard(s, deck, rng);
    if (card !== null) {
      s.phase = "decision";
      s.pendingCardId = card.id;
      s.log.push(`q${q}: event ${card.id}`);
    }
  }

  s.rngCursor = rng.cursor;
  return s;
}
