import {
  DICE, META_PENALTY, GROUP_KEYS, PACING, SCORE_EFFECTS,
  type Action, type Card, type Evidence, type GameState, type GroupKey, type Judgment,
  type MeasureReport, type ScheduledEffect, type Target, type TurnReport,
} from "@ps/shared";
import { rollOutcome, successProbability, type Outcome } from "./dice";
import { EngineError } from "./errors";
import { effectiveLevel } from "./evidence";
import { courtCheck, parliamentVote, protest } from "./gates";
import { popularity } from "./goodness";
import { Rng } from "./rng";
import { costPctGdp, levelToDelta, recurringPctGdpPerYear } from "./scales";
import { applyDelta, at, capDelta, clamp, clampState, sliceSums } from "./util";

export interface TurnAnswer {
  kind: "preset" | "free";
  judgment: Judgment;
}

export interface TurnContext {
  /** The evidence the judge was given (for presets: the choice's evidenceIds). */
  evidence: Evidence[];
}

const LAST_QUARTER = PACING.value.quarters;
const MAX_ACTIONS = 3;

function bump(m: Map<Target, number>, k: Target, v: number): void {
  m.set(k, (m.get(k) ?? 0) + v);
}

/**
 * Resolves the player's answer to the pending event card. Pure: returns a new state and a report.
 * `immediate` in the report is the change from effects, group impacts, penalties and the event, after
 * TURN_CAP; one-off costs and debt shortfalls are not part of it.
 */
export function resolveTurn(
  state: GameState,
  deck: readonly Card[],
  answer: TurnAnswer,
  ctx: TurnContext,
): { state: GameState; report: TurnReport } {
  if (state.phase !== "decision") throw new EngineError(`resolveTurn needs phase "decision", got "${state.phase}"`);
  const card = state.pendingCardId === null ? undefined : deck.find((c) => c.id === state.pendingCardId);
  if (card === undefined) throw new EngineError(`no card in the deck for pendingCardId "${state.pendingCardId}"`);

  const s = structuredClone(state);
  const rng = new Rng(s.seed, s.rngCursor);
  const q = s.quarter;
  const j = answer.judgment;
  const normal = j.input_class === "normal";
  const evidence = new Map(ctx.evidence.map((e) => [e.id, e]));
  const notes: string[] = [];

  // Deltas of this turn, per target. `policy` are player-caused (capped); `eventNow` are the card's (exempt).
  const policy = new Map<Target, number>();
  const eventNow = new Map<Target, number>();
  const newSlices: ScheduledEffect[] = [];

  /** Spreads `total` over `lasts` quarters from `from`: the slice on the current quarter applies now, the rest is scheduled. */
  const addSlice = (policyId: string, target: Target, total: number, from: number, lasts: number, isEvent: boolean): void => {
    if (total === 0 || from > LAST_QUARTER) return;
    const n = clamp(Math.trunc(lasts), 1, LAST_QUARTER);
    const per = total / n;
    const to = Math.min(LAST_QUARTER, from + n - 1);
    if (from <= q) bump(isEvent ? eventNow : policy, target, per);
    const restFrom = Math.max(from, q + 1);
    if (to >= restFrom) newSlices.push({ policyId, target, deltaPerQuarter: per, fromQuarter: restFrom, toQuarter: to });
  };

  const allGroups = (delta: number): void => {
    for (const g of GROUP_KEYS) bump(policy, `group:${g}`, delta);
  };

  // 2-3. Specificity of presets is capped; non-normal input has no actions and relevance 1.
  const scores = j.scores;
  const specificity = answer.kind === "preset"
    ? Math.min(Number(scores.specificity), SCORE_EFFECTS.presetSpecificityMax.value)
    : Number(scores.specificity);
  const relevance = normal ? Number(scores.relevance) : 1;
  const actions: Action[] = normal ? j.actions.slice(0, MAX_ACTIONS) : [];
  if (!normal) notes.push(`input_class ${j.input_class}: no actions`);
  if (j.input_class === "meta") {
    allGroups(META_PENALTY.value.allGroups);
    notes.push("meta answer: every group unhappy with a strange public statement");
  }

  // 4. The event itself.
  const share = at(SCORE_EFFECTS.relevanceIgnoredShare.value, relevance - 1);
  for (const eff of card.ifIgnored) {
    addSlice(`event:${card.id}`, eff.target, eff.delta * share, q, eff.over_quarters, true);
  }
  // Good news happens whatever the answer; only the follow-up policies depend on the player.
  for (const eff of card.onArrival ?? []) {
    addSlice(`event:${card.id}:arrival`, eff.target, eff.delta, q, eff.over_quarters, true);
  }

  // 5. Inconsistent answer.
  if (Number(scores.consistency) <= 2) {
    allGroups(SCORE_EFFECTS.inconsistencyPenalty.value);
    notes.push("inconsistent answer: every group lost trust");
  }

  // 6. Measures.
  const mitigation = at(SCORE_EFFECTS.tradeoffMitigation.value, Number(scores.tradeoffs) - 1);
  const measures: MeasureReport[] = [];
  actions.forEach((a, i) => {
    const policyId = `q${q}.a${i}`;
    const par = parliamentVote(s, a, rng);
    if (!par.passed) {
      measures.push({
        title: a.title, parliament: par, courtRisk: 0, protest: { group: null, happened: false },
        probability: 0, roll: null, outcome: "blocked", multiplier: 0, costPctGdp: 0, downgradedForEvidence: 0,
      });
      s.log.push(`q${q}: "${a.title}" blocked in parliament`);
      return;
    }

    const minStart = a.effects.length === 0 ? 0 : Math.min(...a.effects.map((e) => clamp(e.start_after_quarters, 0, LAST_QUARTER)));
    const court = courtCheck(a, q + minStart, rng, policyId);
    const prot = protest(s, a, mitigation, rng);
    const delay = prot.happened ? prot.delayQuarters : 0;
    if (court !== null) {
      court.atQuarter += delay;
      if (court.atQuarter <= LAST_QUARTER) s.courtChecks.push(court);
    }
    if (prot.happened) {
      bump(policy, "stability", -prot.stabilityHit);
      s.log.push(`q${q}: protest by ${prot.group} against "${a.title}"`);
    }

    const cost = costPctGdp(a.cost_size);
    const broke = s.stats.budget < cost;
    const P = successProbability({
      feasibility: scores.feasibility, specificity, corruption: s.stats.corruption,
      nMeasures: actions.length, broke, difficulty: s.difficulty,
    });
    const roll = rng.int(1, 100);
    const outcome: Outcome = rollOutcome(P, roll);
    const multiplier = DICE.value.multipliers[outcome];
    const sideShare = outcome === "critical_failure" ? DICE.value.sideEffectShare.critical_failure
      : outcome === "failure" ? DICE.value.sideEffectShare.failure
      : DICE.value.sideEffectShare.other;

    s.stats.budget -= cost;
    if (s.stats.budget < 0) {
      s.stats.debt += -s.stats.budget;
      s.stats.budget = 0;
    }
    const recurring = recurringPctGdpPerYear(a.recurring_cost_size);
    if (recurring > 0) s.recurring.push({ policyId, pctGdpPerYear: recurring, untilQuarter: LAST_QUARTER });

    let downgraded = 0;
    const effectTotal = (e: Action["effects"][number], factor: number): void => {
      const eff = effectiveLevel(e, evidence);
      if (eff.downgraded) downgraded++;
      const start = q + clamp(e.start_after_quarters, 0, LAST_QUARTER) + delay;
      addSlice(policyId, e.indicator, levelToDelta(e.indicator, eff.level, e.direction) * factor, start, e.lasts_quarters, false);
    };
    for (const e of a.effects) effectTotal(e, multiplier);
    for (const e of a.side_effects) effectTotal(e, sideShare);
    for (const gi of a.group_impacts) {
      const factor = gi.direction === "up" ? multiplier : 1 - mitigation;
      const target: Target = `group:${gi.group as GroupKey}`;
      addSlice(policyId, target, levelToDelta(target, gi.level, gi.direction) * factor, q + delay, 1, false);
    }

    measures.push({
      title: a.title, parliament: par, courtRisk: court?.chance ?? 0,
      protest: { group: prot.group, happened: prot.happened },
      probability: P, roll, outcome, multiplier, costPctGdp: cost, downgradedForEvidence: downgraded,
    });
    s.log.push(`q${q}: "${a.title}" ${outcome} (roll ${roll} vs ${P.toFixed(0)}%)`);
  });

  const downgradedTotal = measures.reduce((a, m) => a + m.downgradedForEvidence, 0);
  if (downgradedTotal > 0) notes.push(`${downgradedTotal} effect(s) cut to level 1 for missing evidence`);

  // 7. Apply this turn's deltas. Player-policy deltas share the per-quarter TURN_CAP with the slices that the
  // tick already applied for this quarter; event deltas are exempt.
  const prior = sliceSums(s, q).player;
  const immediate: Record<string, number> = {};
  for (const [target, sum] of policy) {
    const already = capDelta(target, prior.get(target) ?? 0);
    const applied = capDelta(target, already + sum) - already;
    applyDelta(s, target, applied);
    immediate[target] = (immediate[target] ?? 0) + applied;
  }
  for (const [target, sum] of eventNow) {
    applyDelta(s, target, sum);
    immediate[target] = (immediate[target] ?? 0) + sum;
  }
  s.scheduled.push(...newSlices);

  // 8. Finish.
  clampState(s);
  s.popularity = popularity(s.groups);
  s.phase = "running";
  s.pendingCardId = null;
  s.cardHistory.push({ cardId: card.id, quarter: q });
  s.log.push(`q${q}: answered ${card.id} (${answer.kind}), event share ${share}`);
  s.rngCursor = rng.cursor;

  const report: TurnReport = {
    quarter: q,
    cardId: card.id,
    answerKind: answer.kind,
    eventShareApplied: share,
    measures,
    immediate,
    scheduledCount: newSlices.length,
    notes,
  };
  return { state: s, report };
}
