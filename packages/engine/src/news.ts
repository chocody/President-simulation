import { MINOR_EVENTS, PACING, type GameState, type MinorEvent, type ScheduledEffect, type StatKey, type Target } from "@ps/shared";
import type { Rng } from "./rng";
import { traitMultiplier, type Traits } from "./traits";
import { applyDelta, currentValue, groupOf } from "./util";

const LAST_QUARTER = PACING.value.quarters;

/** Policy id prefix of the slices a minor event schedules. They are event slices (exempt from TURN_CAP). */
export const NEWS_POLICY_PREFIX = "event:news:";

/**
 * Most that minor events may move one target in a single quarter, in total (spec E3): 3 points on 0-100 indices
 * (stats and group satisfaction), 0.5 on unit stats. Not in design-params yet; the Lead may move it there.
 */
export const NEWS_QUARTER_LIMIT = { index: 3, unit: 0.5 } as const;
const UNIT_STATS: readonly StatKey[] = ["gdpGrowth", "inflation", "unemployment", "budget", "debt", "inequality"];

export function newsLimit(target: Target): number {
  if (groupOf(target) !== null) return NEWS_QUARTER_LIMIT.index;
  return UNIT_STATS.includes(target as StatKey) ? NEWS_QUARTER_LIMIT.unit : NEWS_QUARTER_LIMIT.index;
}

/** Last quarter an effect spreads over, and its per-quarter share. Slices past the end of the term are dropped. */
function spread(q: number, overQuarters: number, delta: number): { per: number; to: number } {
  const n = Math.max(1, Math.trunc(overQuarters));
  return { per: delta / n, to: Math.min(LAST_QUARTER, q + n - 1) };
}

/** Events whose conditions hold and that did not happen within the last MINOR_EVENTS.cooldownQ quarters. */
export function eligibleMinorEvents(state: GameState, events: readonly MinorEvent[]): MinorEvent[] {
  const news = state.news ?? [];
  const cooldown = MINOR_EVENTS.value.cooldownQ;
  return events.filter((ev) => {
    const holds = ev.conditions.every((c) => {
      const v = currentValue(state, c.target);
      return c.op === "<" ? v < c.value : v > c.value;
    });
    if (!holds) return false;
    return !news.some((n) => n.id === ev.id && state.quarter - n.quarter < cooldown);
  });
}

/** Whether an event, started at quarter q, keeps every target inside newsLimit given the load already booked. */
function fits(ev: MinorEvent, q: number, load: Map<string, number>): boolean {
  const mine = new Map<string, number>();
  for (const e of ev.effects) {
    const { per, to } = spread(q, e.over_quarters, e.delta);
    for (let t = q; t <= to; t++) mine.set(`${e.target}@${t}`, (mine.get(`${e.target}@${t}`) ?? 0) + per);
  }
  for (const [key, add] of mine) {
    const target = key.slice(0, key.indexOf("@")) as Target;
    if (Math.abs((load.get(key) ?? 0) + add) > newsLimit(target) + 1e-9) return false;
  }
  return true;
}

/**
 * Draws this quarter's minor events and applies them to `s` (mutated; `s.quarter` is the current quarter, already
 * ticked). Each draw is a weighted pick by baseWeight × traitMultiplier, without repeats; an event that would push a
 * target past newsLimit in some quarter is skipped. No random number is used when nothing is eligible.
 * The first slice applies now, the rest are scheduled as `event:news:<id>` slices. Returns the events that happened.
 */
export function applyMinorEvents(s: GameState, events: readonly MinorEvent[], traits: Traits | undefined, rng: Rng): MinorEvent[] {
  const q = s.quarter;
  const pool = eligibleMinorEvents(s, events);
  if (pool.length === 0) return [];
  const [lo, hi] = MINOR_EVENTS.value.perQuarter;
  const want = rng.int(lo, hi);

  // Load already booked by earlier news, per target and quarter (the slice of quarter q was applied by the tick).
  const load = new Map<string, number>();
  for (const e of s.scheduled) {
    if (!e.policyId.startsWith(NEWS_POLICY_PREFIX)) continue;
    for (let t = Math.max(e.fromQuarter, q); t <= e.toQuarter; t++) {
      load.set(`${e.target}@${t}`, (load.get(`${e.target}@${t}`) ?? 0) + e.deltaPerQuarter);
    }
  }

  const happened: MinorEvent[] = [];
  const strength = MINOR_EVENTS.value.traitStrength;
  while (happened.length < want && pool.length > 0) {
    const weights = pool.map((ev) => ev.baseWeight * traitMultiplier(traits, ev.traitWeights, strength));
    const total = weights.reduce((a, w) => a + w, 0);
    let r = rng.next() * total;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i]!;
      if (r < 0) { idx = i; break; }
    }
    const ev = pool.splice(idx, 1)[0]!;
    if (!fits(ev, q, load)) continue;

    const slices: ScheduledEffect[] = [];
    for (const e of ev.effects) {
      const { per, to } = spread(q, e.over_quarters, e.delta);
      applyDelta(s, e.target, per);
      if (to > q) slices.push({ policyId: `${NEWS_POLICY_PREFIX}${ev.id}`, target: e.target, deltaPerQuarter: per, fromQuarter: q + 1, toQuarter: to });
      for (let t = q; t <= to; t++) load.set(`${e.target}@${t}`, (load.get(`${e.target}@${t}`) ?? 0) + per);
    }
    s.scheduled.push(...slices);
    s.news = [...(s.news ?? []), { quarter: q, id: ev.id }];
    s.log.push(`q${q}: news ${ev.id}`);
    happened.push(ev);
  }
  return happened;
}
