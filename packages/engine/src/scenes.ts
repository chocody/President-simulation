import {
  DICE, SCENES,
  type Action, type Card, type GameState, type MeasureReport, type Scene, type SceneRecord, type SceneTemplate,
  type SceneTrigger, type StatKey, type Target, type TurnReport,
} from "@ps/shared";
import { goodness } from "./goodness";
import { Rng } from "./rng";
import { levelToDelta } from "./scales";
import { traitMultiplier, type Traits } from "./traits";
import { currentValue, groupOf } from "./util";

/**
 * A template is not repeated within this many quarters when another one fits (spec E4: "the last 4 quarters").
 * Not in design-params yet (SCENES has no such field); the Lead may move it there.
 */
export const SCENE_REPEAT_WINDOW_Q = 4;

/** Goodness changes smaller than this count as "no change" (floating-point noise, not a design value). */
const TONE_EPSILON = 1e-9;

const PLACEHOLDER = "{measure}";

type Outcome = MeasureReport["outcome"];
type SceneKind = Scene["kind"];
type SceneTone = Scene["tone"];

/** Tone of an outcome scene, by what the outcome means for the country (never read from the text). */
const OUTCOME_TONE: Record<Exclude<Outcome, "success">, SceneTone> = {
  blocked: "bad", critical_failure: "bad", failure: "bad", partial: "neutral", great_success: "good",
};

/**
 * Tone of a change in `target` by `delta`, ending at `valueAfter`: the sign of the goodness change (stats) or of
 * the satisfaction change (voter groups). Crime down is good, inflation moving toward 2% is good.
 */
export function sceneTone(target: Target, delta: number, valueAfter: number): SceneTone {
  const better = groupOf(target) !== null
    ? delta
    : goodness(target as StatKey, valueAfter) - goodness(target as StatKey, valueAfter - delta);
  return Math.abs(better) < TONE_EPSILON ? "neutral" : better > 0 ? "good" : "bad";
}

const step = (target: Target, level: "1" | "2"): number => levelToDelta(target, level, "up");

function sizeOf(target: Target, absDelta: number): "small" | "large" {
  return absDelta >= step(target, "2") ? "large" : "small";
}

function sameTrigger(a: SceneTrigger, b: SceneTrigger): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "delta": {
      const o = b as Extract<SceneTrigger, { kind: "delta" }>;
      return a.target === o.target && a.direction === o.direction && a.size === o.size;
    }
    case "outcome": return a.outcome === (b as Extract<SceneTrigger, { kind: "outcome" }>).outcome;
    case "protest": return a.group === (b as Extract<SceneTrigger, { kind: "protest" }>).group;
    case "court": return true;
  }
}

/** What to show: a trigger, the facts around it, and how it ranks. */
interface Candidate {
  trigger: SceneTrigger;
  tone: SceneTone;
  cause: string | null;
  targets: Target[];
  kind: SceneKind;
}

/** Picks a template for a candidate. Draws one random number only when there is a real choice. */
function pickTemplate(
  library: readonly SceneTemplate[], trigger: SceneTrigger, cause: string | null,
  avoid: ReadonlySet<string>, traits: Traits | undefined, rng: Rng,
): SceneTemplate | null {
  const fits = (t: SceneTemplate, tr: SceneTrigger) => sameTrigger(t.trigger, tr) && (cause !== null || !t.textTh.includes(PLACEHOLDER));
  let pool = library.filter((t) => fits(t, trigger));
  if (pool.length === 0 && trigger.kind === "delta") {
    const other: SceneTrigger = { ...trigger, size: trigger.size === "small" ? "large" : "small" };
    pool = library.filter((t) => fits(t, other));
  }
  if (pool.length === 0) return null;
  const fresh = pool.filter((t) => !avoid.has(t.id));
  const choices = fresh.length > 0 ? fresh : pool;
  if (choices.length === 1) return choices[0]!;
  const weights = choices.map((t) => traitMultiplier(traits, t.traitWeights, SCENES.value.traitStrength));
  const total = weights.reduce((a, w) => a + w, 0);
  let r = rng.next() * total;
  for (let i = 0; i < choices.length; i++) {
    r -= weights[i]!;
    if (r < 0) return choices[i]!;
  }
  return choices[choices.length - 1]!;
}

/** Template ids shown in the last SCENE_REPEAT_WINDOW_Q quarters before `quarter`. */
function recentIds(scenes: readonly SceneRecord[] | undefined, quarter: number): Set<string> {
  return new Set((scenes ?? []).filter((r) => quarter - r.quarter < SCENE_REPEAT_WINDOW_Q).map((r) => r.templateId));
}

/** Turns candidates into scenes in order, up to `limit`, skipping those with no template. Mutates `used`. */
function realise(
  cands: readonly Candidate[], limit: number, library: readonly SceneTemplate[], used: Set<string>,
  traits: Traits | undefined, rng: Rng,
): Scene[] {
  const out: Scene[] = [];
  for (const c of cands) {
    if (out.length >= limit) break;
    const t = pickTemplate(library, c.trigger, c.cause, used, traits, rng);
    if (t === null) continue;
    used.add(t.id);
    out.push({
      templateId: t.id,
      textTh: t.textTh.split(PLACEHOLDER).join(c.cause ?? ""),
      tone: c.tone, cause: c.cause, targets: c.targets, kind: c.kind,
    });
  }
  return out;
}

function sideShare(outcome: Outcome): number {
  const s = DICE.value.sideEffectShare;
  return outcome === "critical_failure" ? s.critical_failure : outcome === "failure" ? s.failure : s.other;
}

/**
 * The measure behind a change in `target`: the one whose effect on it (level x outcome multiplier, side effects at
 * their share) is largest and pushes the same way. Evidence downgrades are not known here, so levels are as judged.
 */
function attribute(target: Target, delta: number, actions: readonly Action[], measures: readonly MeasureReport[]): string | null {
  let best = 0;
  let title: string | null = null;
  const n = Math.min(actions.length, measures.length);
  for (let i = 0; i < n; i++) {
    const m = measures[i]!;
    const a = actions[i]!;
    if (m.outcome === "blocked") continue;
    const consider = (level: "1" | "2" | "3", direction: "up" | "down", factor: number): void => {
      const signed = levelToDelta(target, level, direction) * factor;
      if (Math.sign(signed) !== Math.sign(delta)) return;
      if (Math.abs(signed) > best) { best = Math.abs(signed); title = m.title; }
    };
    for (const e of a.effects) if (e.indicator === target) consider(e.level, e.direction, m.multiplier);
    for (const e of a.side_effects) if (e.indicator === target) consider(e.level, e.direction, sideShare(m.outcome));
    for (const g of a.group_impacts) if (`group:${g.group}` === target) consider(g.level, g.direction, g.direction === "up" ? m.multiplier : 1);
  }
  return title;
}

function measureTargets(a: Action | undefined): Target[] {
  if (!a) return [];
  return [...new Set<Target>([...a.effects.map((e) => e.indicator), ...a.group_impacts.map((g) => `group:${g.group}` as const)])];
}

export interface BuildTurnScenesInput {
  /** The state returned by resolveTurn (stats already changed; quarter is the decision quarter). */
  state: GameState;
  report: TurnReport;
  card: Card | null;
  /** The judged actions the engine used, in order (`report.measures[i]` belongs to `actions[i]`). */
  actions: readonly Action[];
  library: readonly SceneTemplate[];
  traits?: Traits;
}

/**
 * Builds the consequence scenes of one decision: outcome and protest scenes first, then the biggest changes
 * (relative to the level-1 step), at most SCENES.maxPerTurn in all. Pure; the random numbers come from the state's
 * counter RNG and none are drawn when there is no library or nothing to show. The scenes are also appended to
 * `state.scenes`, so the returned state has the new rngCursor.
 */
export function buildTurnScenes(input: BuildTurnScenesInput): { state: GameState; scenes: Scene[] } {
  const { state, report, card, actions, library, traits } = input;
  if (library.length === 0) return { state, scenes: [] };

  const cands: Candidate[] = [];
  report.measures.forEach((m, i) => {
    const targets = measureTargets(actions[i]);
    if (m.outcome !== "success") {
      cands.push({ trigger: { kind: "outcome", outcome: m.outcome }, tone: OUTCOME_TONE[m.outcome], cause: m.title, targets, kind: "turn" });
    }
    if (m.protest.happened && m.protest.group !== null) {
      cands.push({ trigger: { kind: "protest", group: m.protest.group }, tone: "bad", cause: m.title, targets: ["stability"], kind: "turn" });
    }
  });

  const deltas = Object.entries(report.immediate)
    .map(([target, delta]) => ({ target: target as Target, delta, rank: Math.abs(delta) / step(target as Target, "1") }))
    .filter((d) => Math.abs(d.delta) >= SCENES.value.minLevelShare * step(d.target, "1"))
    .sort((a, b) => b.rank - a.rank || (a.target < b.target ? -1 : 1));
  for (const d of deltas) {
    const cause = attribute(d.target, d.delta, actions, report.measures) ?? card?.titleTh ?? null;
    cands.push({
      trigger: { kind: "delta", target: d.target, direction: d.delta > 0 ? "up" : "down", size: sizeOf(d.target, Math.abs(d.delta)) },
      tone: sceneTone(d.target, d.delta, currentValue(state, d.target)),
      cause, targets: [d.target], kind: "turn",
    });
  }

  if (cands.length === 0) return { state, scenes: [] };
  const s = structuredClone(state);
  const rng = new Rng(s.seed, s.rngCursor);
  const scenes = realise(cands, SCENES.value.maxPerTurn, library, recentIds(s.scenes, report.quarter), traits, rng);
  s.rngCursor = rng.cursor;
  s.scenes = [...(s.scenes ?? []), ...scenes.map((x): SceneRecord => ({ ...x, quarter: report.quarter }))];
  return { state: s, scenes };
}

/**
 * Scenes for the quarter that `s` has just been ticked into (mutates `s`): a court scene for each measure suspended
 * now (`suspended` = policy ids), and follow-up scenes for delayed effects that start now, biggest first, at most
 * SCENES.maxFollowupsPerQuarter. A follow-up needs the total of its slices (per quarter x length) to reach
 * SCENES.followupMinLevelShare of the level-1 step. Draws no random numbers without a library.
 */
export function addQuarterScenes(
  s: GameState, suspended: readonly string[], library: readonly SceneTemplate[], traits: Traits | undefined, rng: Rng,
): Scene[] {
  if (library.length === 0) return [];
  const q = s.quarter;
  const titleOf = new Map((s.policies ?? []).filter((p) => p.quarter < q).map((p) => [p.id, p.title]));

  const courts: Candidate[] = suspended.flatMap((id) => {
    const cause = titleOf.get(id);
    return cause === undefined ? [] : [{ trigger: { kind: "court" } as const, tone: "bad" as const, cause, targets: [], kind: "court" as const }];
  });

  const totals = new Map<string, { policyId: string; target: Target; total: number }>();
  for (const e of s.scheduled) {
    if (e.fromQuarter !== q || suspended.includes(e.policyId) || !titleOf.has(e.policyId)) continue;
    const key = `${e.policyId}|${e.target}`;
    const cur = totals.get(key) ?? { policyId: e.policyId, target: e.target, total: 0 };
    cur.total += e.deltaPerQuarter * (e.toQuarter - e.fromQuarter + 1);
    totals.set(key, cur);
  }
  const follow: (Candidate & { rank: number; key: string })[] = [];
  for (const [key, f] of totals) {
    const rank = Math.abs(f.total) / step(f.target, "1");
    if (rank < SCENES.value.followupMinLevelShare) continue;
    follow.push({
      key, rank,
      trigger: { kind: "delta", target: f.target, direction: f.total > 0 ? "up" : "down", size: sizeOf(f.target, Math.abs(f.total)) },
      tone: sceneTone(f.target, f.total, currentValue(s, f.target) + f.total),
      cause: titleOf.get(f.policyId) ?? null, targets: [f.target], kind: "followup",
    });
  }
  follow.sort((a, b) => b.rank - a.rank || (a.key < b.key ? -1 : 1));

  if (courts.length === 0 && follow.length === 0) return [];
  const used = recentIds(s.scenes, q);
  const scenes = [
    ...realise(courts, courts.length, library, used, traits, rng),
    ...realise(follow, SCENES.value.maxFollowupsPerQuarter, library, used, traits, rng),
  ];
  if (scenes.length > 0) s.scenes = [...(s.scenes ?? []), ...scenes.map((x): SceneRecord => ({ ...x, quarter: q }))];
  return scenes;
}
