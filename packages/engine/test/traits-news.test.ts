import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  FRICTION, GameState, MINOR_EVENTS, PACING, TRAIT_KEYS, TurnReport,
  type Card, type MinorEvent, type Target,
} from "@ps/shared";
import {
  NEWS_POLICY_PREFIX, NEWS_QUARTER_LIMIT, Rng, advanceQuarter, applyMinorEvents, eligibleMinorEvents, formatFrictionNote,
  frictionFor, isReform, newGame, newsLimit, parseFrictionNote, parliamentVote, pickCard, resolveTurn, successProbability,
  traitMultiplier, type Traits,
} from "@ps/engine";
import { fixtureCountry } from "./fixtures/country";
import { fixtureDeck } from "./fixtures/cards";
import { fixtureEvidence } from "./fixtures/evidence";
import { fixtureMinorEvents } from "./fixtures/minor";
import { action, effect, judgment } from "./fixtures/judgments";
import { QUIET_CARD, SIMPLE_DECK, decisionState } from "./helpers";

const ctx = { evidence: fixtureEvidence };
const newState = (seed: string) => newGame({ country: fixtureCountry, difficulty: "normal", seed });

describe("traitMultiplier", () => {
  it("is 1 with no weights, no traits, or traits at 50", () => {
    expect(traitMultiplier(undefined, undefined)).toBe(1);
    expect(traitMultiplier({ tourism: 90 }, undefined)).toBe(1);
    expect(traitMultiplier(undefined, { tourism: 1, patronage: -1 })).toBe(1);
    expect(traitMultiplier({ tourism: 50 }, { tourism: 1 })).toBe(1);
  });
  it("is 1 + k × (trait − 50) / 50 for one key, and multiplies over keys", () => {
    expect(traitMultiplier({ tourism: 80 }, { tourism: 0.5 })).toBeCloseTo(1.3, 12);
    expect(traitMultiplier({ tourism: 20 }, { tourism: 1 })).toBeCloseTo(0.4, 12);
    expect(traitMultiplier({ tourism: 80, openness: 100 }, { tourism: 0.5, openness: 0.5 })).toBeCloseTo(1.3 * 1.5, 12);
  });
  it("a missing trait counts as 50", () => {
    expect(traitMultiplier({ openness: 100 }, { tourism: 1, openness: 0.5 })).toBeCloseTo(1.5, 12);
  });
  it("is clamped to [0.1, 3]", () => {
    expect(traitMultiplier({ tourism: 0 }, { tourism: 1 })).toBe(0.1);
    expect(traitMultiplier({ tourism: 100, openness: 100, resources: 100 }, { tourism: 1, openness: 1, resources: 1 })).toBe(3);
  });
  it("strength scales k", () => {
    expect(traitMultiplier({ tourism: 100 }, { tourism: 1 }, 0.5)).toBeCloseTo(1.5, 12);
  });
  it("property: always inside [0.1, 3], and 1 when every trait is 50", () => {
    const traitsArb = fc.dictionary(fc.constantFrom(...TRAIT_KEYS), fc.double({ min: 0, max: 100, noNaN: true }));
    const weightsArb = fc.dictionary(fc.constantFrom(...TRAIT_KEYS), fc.double({ min: -1, max: 1, noNaN: true }));
    fc.assert(fc.property(traitsArb, weightsArb, (t, w) => {
      const m = traitMultiplier(t as Traits, w);
      expect(m).toBeGreaterThanOrEqual(0.1);
      expect(m).toBeLessThanOrEqual(3);
    }));
    fc.assert(fc.property(weightsArb, (w) => {
      expect(traitMultiplier(Object.fromEntries(TRAIT_KEYS.map((k) => [k, 50])), w)).toBe(1);
    }));
  });
});

describe("pickCard with traits", () => {
  const mkCard = (id: string, traitWeights?: Card["traitWeights"]): Card => ({
    ...fixtureDeck[0]!, id, conditions: [], baseWeight: 1, cooldownQ: 0, traitWeights,
  });
  const tourist = mkCard("t", { tourism: 1 });
  const plain = mkCard("p");
  const count = (traits: Traits | undefined) => {
    let n = 0;
    for (let i = 0; i < 2000; i++) {
      if (pickCard(newState(`pick-${i}`), [tourist, plain], new Rng(`pick-${i}`, 0), traits)?.id === "t") n++;
    }
    return n / 2000;
  };
  it("a tourism card is drawn more where tourism is big, less where it is small, 50/50 at neutral", () => {
    expect(count(undefined)).toBeGreaterThan(0.45);
    expect(count(undefined)).toBeLessThan(0.55);
    expect(count({ tourism: 90 })).toBeGreaterThan(0.6);   // weight 1.8 vs 1 -> 0.64
    expect(count({ tourism: 10 })).toBeLessThan(0.32);     // weight 0.2 vs 1 -> 0.17
  });
  it("without traits the draw is identical to the plain weighted draw (same rng use)", () => {
    for (let i = 0; i < 50; i++) {
      const a = pickCard(newState("x"), fixtureDeck, new Rng(`s${i}`, 0));
      const b = pickCard(newState("x"), fixtureDeck, new Rng(`s${i}`, 0), {});
      expect(b?.id).toBe(a?.id);
    }
  });
});

const reform = (over: Partial<ReturnType<typeof action>> = {}) =>
  action({ title: "TEST FIXTURE reform", requires_legislation: true, effects: [effect({ indicator: "corruption", direction: "down", level: "2" })], ...over });

describe("friction", () => {
  it("isReform: corruption down, pressFreedom up, parliament up; nothing else", () => {
    const one = (indicator: Target, direction: "up" | "down") => action({ effects: [effect({ indicator, direction })] });
    expect(isReform(one("corruption", "down"))).toBe(true);
    expect(isReform(one("corruption", "up"))).toBe(false);
    expect(isReform(one("pressFreedom", "up"))).toBe(true);
    expect(isReform(one("pressFreedom", "down"))).toBe(false);
    expect(isReform(one("parliament", "up"))).toBe(true);
    expect(isReform(one("parliament", "down"))).toBe(false);
    expect(isReform(one("health", "up"))).toBe(false);
    expect(isReform(action({ effects: [], side_effects: [effect({ indicator: "corruption", direction: "down" })] }))).toBe(false);
    expect(isReform(action({ effects: [effect(), effect({ indicator: "corruption", direction: "down" })] }))).toBe(true);
  });

  it("numbers follow FRICTION: vote −0.1 × (patronage − 50), chance −0.15 × (patronage − 50)", () => {
    const f = frictionFor(reform(), { patronage: 80 });
    expect(f.voteAdjust).toBeCloseTo(-FRICTION.value.parliamentPerPoint * 30, 12);
    expect(f.probabilityAdjust).toBeCloseTo(-FRICTION.value.probabilityPerPoint * 30, 12);
    expect(f.voteAdjust).toBeCloseTo(-3, 12);
    expect(f.probabilityAdjust).toBeCloseTo(-4.5, 12);
    const easier = frictionFor(reform(), { patronage: 20 });
    expect(easier.voteAdjust).toBeCloseTo(3, 12);
    expect(easier.probabilityAdjust).toBeCloseTo(4.5, 12);
  });
  it("is zero for non-reforms and for neutral or missing patronage", () => {
    expect(frictionFor(action(), { patronage: 90 })).toMatchObject({ reform: false, voteAdjust: 0, probabilityAdjust: 0 });
    expect(frictionFor(reform(), {})).toMatchObject({ reform: true, voteAdjust: 0, probabilityAdjust: 0 });
    expect(frictionFor(reform(), undefined).voteAdjust).toBe(0);
    expect(Object.is(frictionFor(reform(), { patronage: 50 }).voteAdjust, 0)).toBe(true);
  });

  it("parliamentVote and successProbability take the adjustment", () => {
    const s = decisionState();
    const a = reform();
    const v0 = parliamentVote(s, a, new Rng("v", 0)).vote!;
    const v1 = parliamentVote(s, a, new Rng("v", 0), -3).vote!;
    expect(v1).toBeCloseTo(v0 - 3, 12);
    const base = { feasibility: 3, specificity: 3, corruption: 50, nMeasures: 1, broke: false, difficulty: "normal" as const };
    expect(successProbability({ ...base, adjust: -4.5 })).toBeCloseTo(successProbability(base) - 4.5, 12);
  });

  it("note format round-trips", () => {
    const n = { measure: 1, patronage: 80, vote: -3, probability: -4.5 };
    expect(parseFrictionNote(formatFrictionNote(n))).toEqual(n);
    expect(parseFrictionNote("meta answer: every group unhappy")).toBeNull();
  });

  const j = judgment({ actions: [reform()] });
  it("resolveTurn reports both numbers in notes and shifts the success chance", () => {
    const hi = resolveTurn(decisionState(QUIET_CARD.id, "fr"), SIMPLE_DECK, { kind: "free", judgment: j }, { ...ctx, traits: { patronage: 80 } });
    const none = resolveTurn(decisionState(QUIET_CARD.id, "fr"), SIMPLE_DECK, { kind: "free", judgment: j }, ctx);
    expect(() => TurnReport.parse(hi.report)).not.toThrow();
    const notes = hi.report.notes.map(parseFrictionNote).filter((x) => x !== null);
    expect(notes).toEqual([{ measure: 0, patronage: 80, vote: -3, probability: -4.5 }]);
    expect(none.report.notes.filter((n) => parseFrictionNote(n))).toEqual([]);
    expect(hi.report.measures[0]!.probability).toBeCloseTo(none.report.measures[0]!.probability - 4.5, 10);
    // parliament vote is lower by exactly 3 (same seed, same rng use)
    expect(hi.report.measures[0]!.parliament.vote!).toBeCloseTo(none.report.measures[0]!.parliament.vote! - 3, 10);
  });
  it("a low-patronage country gets a bonus; neutral traits change nothing", () => {
    const lo = resolveTurn(decisionState(QUIET_CARD.id, "fr"), SIMPLE_DECK, { kind: "free", judgment: j }, { ...ctx, traits: { patronage: 20 } });
    const none = resolveTurn(decisionState(QUIET_CARD.id, "fr"), SIMPLE_DECK, { kind: "free", judgment: j }, ctx);
    expect(lo.report.measures[0]!.probability).toBeCloseTo(none.report.measures[0]!.probability + 4.5, 10);
    const neutral = resolveTurn(decisionState(QUIET_CARD.id, "fr"), SIMPLE_DECK, { kind: "free", judgment: j }, { ...ctx, traits: { patronage: 50, tourism: 90 } });
    expect(neutral).toEqual(none);
  });
  it("non-reform measures are unaffected by patronage", () => {
    const plain = judgment({ actions: [action()] });
    const a = resolveTurn(decisionState(QUIET_CARD.id, "fr"), SIMPLE_DECK, { kind: "free", judgment: plain }, { ...ctx, traits: { patronage: 95 } });
    const b = resolveTurn(decisionState(QUIET_CARD.id, "fr"), SIMPLE_DECK, { kind: "free", judgment: plain }, ctx);
    expect(a).toEqual(b);
  });
  it("a reform that needs no legislation reports only the success-chance number", () => {
    const j2 = judgment({ actions: [reform({ requires_legislation: false })] });
    const r = resolveTurn(decisionState(QUIET_CARD.id, "fr"), SIMPLE_DECK, { kind: "free", judgment: j2 }, { ...ctx, traits: { patronage: 80 } });
    expect(r.report.notes.map(parseFrictionNote).filter(Boolean)).toEqual([{ measure: 0, patronage: 80, vote: 0, probability: -4.5 }]);
  });
});

describe("minor events (news)", () => {
  const quarter = (seed: string, events: MinorEvent[] = fixtureMinorEvents, traits?: Traits) => {
    const s = { ...newState(seed), quarter: 3 };
    return advanceQuarter(s, [], events, { traits });
  };

  it("default (no minor events) changes nothing: no news, same rng use", () => {
    const s = newState("same");
    const a = advanceQuarter(s, fixtureDeck);
    const b = advanceQuarter(s, fixtureDeck, [], {});
    expect(b).toEqual(a);
    expect(a.news).toBeUndefined();
  });

  it("draws 1–3 distinct events a quarter, logs them, and the state still parses", () => {
    const counts = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const s = quarter(`n${i}`);
      expect(() => GameState.parse(s)).not.toThrow();
      const news = s.news ?? [];
      counts.add(news.length);
      expect(news.length).toBeGreaterThanOrEqual(MINOR_EVENTS.value.perQuarter[0]);
      expect(news.length).toBeLessThanOrEqual(MINOR_EVENTS.value.perQuarter[1]);
      expect(new Set(news.map((n) => n.id)).size).toBe(news.length);
      expect(news.every((n) => n.quarter === 4 && s.log.includes(`q4: news ${n.id}`))).toBe(true);
    }
    expect([...counts].sort()).toEqual([1, 2, 3]);
  });

  it("applies the first slice at once and schedules the rest as event:news slices", () => {
    const only: MinorEvent[] = [{ ...fixtureMinorEvents[1]!, effects: [{ target: "crime", delta: -2, over_quarters: 2 }] }];
    const before = { ...newState("one"), quarter: 3 };
    const none = advanceQuarter(before, [], [], {});
    const withNews = advanceQuarter(before, [], only, {});
    expect(withNews.stats.crime).toBeCloseTo(none.stats.crime - 1, 10);
    const slices = withNews.scheduled.filter((e) => e.policyId === `${NEWS_POLICY_PREFIX}${only[0]!.id}`);
    expect(slices).toEqual([{ policyId: `${NEWS_POLICY_PREFIX}${only[0]!.id}`, target: "crime", deltaPerQuarter: -1, fromQuarter: 5, toQuarter: 5 }]);
    expect(withNews.news).toEqual([{ quarter: 4, id: only[0]!.id }]);
    // the next quarter applies the remaining slice
    const later = advanceQuarter(withNews, [], [], {});
    const laterNone = advanceQuarter(none, [], [], {});
    expect(later.stats.crime).toBeLessThan(laterNone.stats.crime - 0.9);
  });

  it("conditions gate events, and cooldownQ stops repeats", () => {
    const cond = fixtureMinorEvents.find((e) => e.id.endsWith(".i"))!;
    const s = { ...newState("cond"), quarter: 3 };
    expect(eligibleMinorEvents(s, fixtureMinorEvents).some((e) => e.id === cond.id)).toBe(false);   // education 50, needs > 60
    const hi = { ...s, stats: { ...s.stats, education: 70 } };
    expect(eligibleMinorEvents(hi, fixtureMinorEvents).some((e) => e.id === cond.id)).toBe(true);
    const cd = MINOR_EVENTS.value.cooldownQ;
    const used = { ...hi, news: [{ quarter: 3, id: cond.id }], quarter: 3 + cd - 1 };
    expect(eligibleMinorEvents(used, fixtureMinorEvents).some((e) => e.id === cond.id)).toBe(false);
    const free = { ...hi, news: [{ quarter: 3, id: cond.id }], quarter: 3 + cd };
    expect(eligibleMinorEvents(free, fixtureMinorEvents).some((e) => e.id === cond.id)).toBe(true);
  });

  it("no random number is used when nothing is eligible", () => {
    const rng = new Rng("z", 0);
    const s = { ...newState("z"), quarter: 3 };
    expect(applyMinorEvents(s, [fixtureMinorEvents.find((e) => e.id.endsWith(".i"))!], undefined, rng)).toEqual([]);
    expect(rng.cursor).toBe(0);
  });

  it("trait weights shift what is drawn: patronage news is likelier where patronage is high", () => {
    const share = (traits: Traits) => {
      let hits = 0, total = 0;
      for (let i = 0; i < 400; i++) {
        const news = quarter(`tw${i}`, fixtureMinorEvents, traits).news ?? [];
        total += news.length;
        hits += news.filter((n) => n.id === "news.test.h").length;
      }
      return hits / total;
    };
    const hi = share({ patronage: 95 });
    const neutral = share({});
    const lo = share({ patronage: 5 });
    expect(hi).toBeGreaterThan(neutral * 1.3);
    expect(lo).toBeLessThan(neutral * 0.5);
  });

  it("cards' traitWeights apply through advanceQuarter's ctx too", () => {
    const tourist: Card = { ...fixtureDeck[0]!, id: "t", conditions: [], cooldownQ: 0, traitWeights: { tourism: 1 } };
    const plain: Card = { ...fixtureDeck[0]!, id: "p", conditions: [], cooldownQ: 0 };
    let hi = 0, lo = 0;
    for (let i = 0; i < 300; i++) {
      const s = { ...newState(`c${i}`), quarter: PACING.value.decisionQuarters[0]! - 1 };
      if (advanceQuarter(s, [tourist, plain], [], { traits: { tourism: 95 } }).pendingCardId === "t") hi++;
      if (advanceQuarter(s, [tourist, plain], [], { traits: { tourism: 5 } }).pendingCardId === "t") lo++;
    }
    expect(hi).toBeGreaterThan(lo * 2);
  });

  it("newsLimit: 3 for indices and groups, 0.5 for unit stats", () => {
    expect(newsLimit("stability")).toBe(NEWS_QUARTER_LIMIT.index);
    expect(newsLimit("group:youth")).toBe(NEWS_QUARTER_LIMIT.index);
    expect(newsLimit("inflation")).toBe(NEWS_QUARTER_LIMIT.unit);
    expect(newsLimit("debt")).toBe(NEWS_QUARTER_LIMIT.unit);
  });

  it("an event that would push a target over the limit in one quarter is skipped", () => {
    const big = (id: string): MinorEvent => ({ ...fixtureMinorEvents[0]!, id, effects: [{ target: "stability", delta: 2, over_quarters: 1 }] });
    // two +2 events on stability would be +4 > 3: never both in one quarter
    for (let i = 0; i < 100; i++) {
      const s = quarter(`lim${i}`, [big("x"), big("y"), big("z")]);
      expect((s.news ?? []).length).toBe(1);
    }
  });

  it("property: in any quarter, the news moves no stat by more than 3 index points / 0.5 unit points in total", () => {
    // Deck with many overlapping, multi-quarter events on the same few targets to stress the cap.
    const stress: MinorEvent[] = [
      ...fixtureMinorEvents,
      ...[1, 2, 3].map((n) => ({ ...fixtureMinorEvents[0]!, id: `news.test.s${n}`, effects: [{ target: "stability" as const, delta: n, over_quarters: n }] })),
      ...[1, 2].map((n) => ({ ...fixtureMinorEvents[0]!, id: `news.test.u${n}`, effects: [{ target: "inflation" as const, delta: -0.3 * n, over_quarters: n }] })),
    ];
    const byId = new Map(stress.map((e) => [e.id, e]));
    fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 8 }), (seed) => {
      let s = newState(seed);
      for (let guard = 0; guard < 20 && s.phase !== "ended"; guard++) {
        if (s.phase === "decision") s = { ...s, phase: "running", pendingCardId: null };
        s = advanceQuarter(s, [], stress, { traits: { patronage: 80, tourism: 70 } });
      }
      // recompute each quarter's news movement from the events that happened
      const load = new Map<string, number>();
      for (const n of s.news ?? []) {
        for (const e of byId.get(n.id)!.effects) {
          const to = Math.min(PACING.value.quarters, n.quarter + e.over_quarters - 1);
          for (let t = n.quarter; t <= to; t++) load.set(`${e.target}@${t}`, (load.get(`${e.target}@${t}`) ?? 0) + e.delta / e.over_quarters);
        }
      }
      for (const [key, v] of load) {
        const target = key.slice(0, key.indexOf("@")) as Target;
        expect(Math.abs(v), key).toBeLessThanOrEqual(newsLimit(target) + 1e-9);
      }
    }), { numRuns: 60 });
  });

  it("is deterministic: same state and inputs, same news", () => {
    expect(quarter("det")).toEqual(quarter("det"));
  });

  it("does not mutate its input state", () => {
    const s = { ...newState("mut"), quarter: 3 };
    const copy = structuredClone(s);
    advanceQuarter(s, [], fixtureMinorEvents, { traits: { patronage: 70 } });
    expect(s).toEqual(copy);
  });
});
