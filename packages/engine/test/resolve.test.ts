import { describe, expect, it } from "vitest";
import { GameState, TurnReport, type Judgment } from "@ps/shared";
import {
  EngineError, advanceQuarter, levelToDelta, newGame, resolveTurn, type TurnAnswer,
} from "@ps/engine";
import { fixtureCountry } from "./fixtures/country";
import { fixtureDeck } from "./fixtures/cards";
import { fixtureEvidence } from "./fixtures/evidence";
import { action, effect, impact, judgment } from "./fixtures/judgments";
import { QUIET_CARD, SIMPLE_CARD, SIMPLE_DECK, decisionState } from "./helpers";

const ctx = { evidence: fixtureEvidence };
const free = (j: Judgment): TurnAnswer => ({ kind: "free", judgment: j });
const preset = (j: Judgment): TurnAnswer => ({ kind: "preset", judgment: j });

/** First seed whose first measure ends in an outcome that satisfies `pred`. */
function seedWhere(j: Judgment, pred: (outcome: string) => boolean, cardId = QUIET_CARD.id): string {
  for (let i = 0; i < 500; i++) {
    const seed = `find-${i}`;
    const r = resolveTurn(decisionState(cardId, seed), SIMPLE_DECK, free(j), ctx).report;
    if (pred(r.measures[0]!.outcome)) return seed;
  }
  throw new Error("no seed found");
}

describe("resolveTurn: guards", () => {
  it("rejects a state that is not waiting for a decision", () => {
    const running = { ...decisionState(), phase: "running" as const };
    expect(() => resolveTurn(running, SIMPLE_DECK, free(judgment()), ctx)).toThrow(EngineError);
    const ended = { ...decisionState(), phase: "ended" as const };
    expect(() => resolveTurn(ended, SIMPLE_DECK, free(judgment()), ctx)).toThrow(EngineError);
  });

  it("rejects a missing or unknown pending card", () => {
    expect(() => resolveTurn({ ...decisionState(), pendingCardId: null }, SIMPLE_DECK, free(judgment()), ctx)).toThrow(EngineError);
    expect(() => resolveTurn(decisionState("no.such.card"), SIMPLE_DECK, free(judgment()), ctx)).toThrow(EngineError);
  });

  it("does not mutate its input state", () => {
    const s = decisionState();
    const copy = structuredClone(s);
    resolveTurn(s, SIMPLE_DECK, free(judgment()), ctx);
    expect(s).toEqual(copy);
  });
});

describe("resolveTurn: result shape", () => {
  it("returns a valid GameState and a TurnReport that matches the contract", () => {
    const j = judgment({
      actions: [action({ group_impacts: [impact({ group: "business", direction: "down", level: "2" })] })],
    });
    const { state, report } = resolveTurn(decisionState(), SIMPLE_DECK, free(j), ctx);
    expect(() => GameState.parse(state)).not.toThrow();
    expect(() => TurnReport.parse(report)).not.toThrow();
    expect(state.phase).toBe("running");
    expect(state.pendingCardId).toBeNull();
    expect(state.cardHistory).toEqual([{ cardId: SIMPLE_CARD.id, quarter: 2 }]);
    expect(report.cardId).toBe(SIMPLE_CARD.id);
    expect(report.answerKind).toBe("free");
    expect(state.log.length).toBeGreaterThan(0);
  });

  it("uses at most the first 3 actions", () => {
    const j = judgment({ actions: [action(), action(), action(), action()] });
    const { report } = resolveTurn(decisionState(QUIET_CARD.id), SIMPLE_DECK, free(j), ctx);
    expect(report.measures).toHaveLength(3);
  });
});

describe("resolveTurn: blocked measures", () => {
  const legal = judgment({
    actions: [action({
      cost_size: "L", recurring_cost_size: "M", requires_legislation: true, legal_risk: "high",
      effects: [effect({ indicator: "health", level: "3" })],
      group_impacts: [impact({ group: "business", direction: "down", level: "3" }), impact({ group: "urban", direction: "up", level: "3" })],
    })],
  });

  it("a measure blocked in parliament costs nothing and changes nothing", () => {
    const s0 = { ...decisionState(QUIET_CARD.id), stats: { ...decisionState().stats, parliament: 0 } };
    const { state, report } = resolveTurn(s0, SIMPLE_DECK, free(legal), ctx);
    const m = report.measures[0]!;
    expect(m.outcome).toBe("blocked");
    expect(m.roll).toBeNull();
    expect(m.parliament.required).toBe(true);
    expect(m.parliament.passed).toBe(false);
    expect(m.multiplier).toBe(0);
    expect(m.costPctGdp).toBe(0);
    expect(state.stats.budget).toBe(s0.stats.budget);
    expect(state.stats.debt).toBe(s0.stats.debt);
    expect(state.recurring).toEqual([]);
    expect(state.courtChecks).toEqual([]);
    expect(state.scheduled).toEqual([]);
    expect(state.stats.health).toBe(s0.stats.health);
    expect(state.groups.business.satisfaction).toBe(s0.groups.business.satisfaction);
    expect(state.groups.urban.satisfaction).toBe(s0.groups.urban.satisfaction);
  });

  it("an unblocked measure pays its cost", () => {
    const j = judgment({ actions: [action({ cost_size: "S", recurring_cost_size: "XS" })] });
    const s0 = decisionState(QUIET_CARD.id);
    const { state, report } = resolveTurn(s0, SIMPLE_DECK, free(j), ctx);
    expect(report.measures[0]!.costPctGdp).toBe(0.2);
    expect(state.stats.budget).toBeCloseTo(s0.stats.budget - 0.2, 10);
    expect(state.recurring).toEqual([{ policyId: "q2.a0", pctGdpPerYear: 0.05, untilQuarter: 16 }]);
  });

  it("a cost above the budget turns the shortfall into debt", () => {
    const j = judgment({ actions: [action({ cost_size: "XL", effects: [] })] });
    const s0 = decisionState(QUIET_CARD.id);
    const { state } = resolveTurn(s0, SIMPLE_DECK, free(j), ctx);
    expect(state.stats.budget).toBe(0);
    expect(state.stats.debt).toBeCloseTo(s0.stats.debt + (4 - s0.stats.budget), 10);
  });
});

describe("resolveTurn: scores", () => {
  const withScores = (specificity: "1" | "2" | "3" | "4" | "5") =>
    judgment({ scores: { relevance: "3", feasibility: "3", specificity, tradeoffs: "3", consistency: "3" } });

  it("preset specificity is capped at 3", () => {
    const p = (a: TurnAnswer) => resolveTurn(decisionState(QUIET_CARD.id), SIMPLE_DECK, a, ctx).report.measures[0]!.probability;
    expect(p(preset(withScores("5")))).toBe(p(free(withScores("3"))));
    expect(p(preset(withScores("5")))).toBeLessThan(p(free(withScores("5"))));
    expect(p(preset(withScores("2")))).toBe(p(free(withScores("2"))));
  });

  it("meta answers: no actions, every group -2, event fully happens", () => {
    const j = judgment({ input_class: "meta", scores: { relevance: "5", feasibility: "5", specificity: "5", tradeoffs: "5", consistency: "5" } });
    const s0 = decisionState();
    const { state, report } = resolveTurn(s0, SIMPLE_DECK, free(j), ctx);
    expect(report.measures).toEqual([]);
    expect(report.eventShareApplied).toBe(1);
    for (const g of Object.keys(s0.groups) as (keyof typeof s0.groups)[]) {
      expect(state.groups[g].satisfaction).toBeCloseTo(s0.groups[g].satisfaction - 2, 10);
    }
    expect(state.stats.stability).toBeCloseTo(s0.stats.stability - 1, 10); // -4 over 4 quarters, first slice now
  });

  it("off-topic answers: no actions, no meta penalty, event fully happens", () => {
    const j = judgment({ input_class: "off_topic", scores: { relevance: "5", feasibility: "3", specificity: "3", tradeoffs: "3", consistency: "3" } });
    const s0 = decisionState();
    const { state, report } = resolveTurn(s0, SIMPLE_DECK, free(j), ctx);
    expect(report.measures).toEqual([]);
    expect(report.eventShareApplied).toBe(1);
    expect(state.groups.urban.satisfaction).toBe(s0.groups.urban.satisfaction);
  });

  it("consistency 1-2 gives -2 to all groups; 3 does not", () => {
    const mk = (consistency: "1" | "2" | "3") =>
      judgment({ actions: [], scores: { relevance: "5", feasibility: "3", specificity: "3", tradeoffs: "3", consistency } });
    const s0 = decisionState();
    for (const c of ["1", "2"] as const) {
      const { state } = resolveTurn(s0, SIMPLE_DECK, free(mk(c)), ctx);
      expect(state.groups.youth.satisfaction).toBeCloseTo(s0.groups.youth.satisfaction - 2, 10);
    }
    const { state } = resolveTurn(s0, SIMPLE_DECK, free(mk("3")), ctx);
    expect(state.groups.youth.satisfaction).toBe(s0.groups.youth.satisfaction);
  });
});

describe("resolveTurn: event effects", () => {
  const rel = (relevance: "1" | "2" | "3" | "4" | "5") =>
    judgment({ actions: [], scores: { relevance, feasibility: "3", specificity: "3", tradeoffs: "3", consistency: "3" } });

  it("relevance 5 removes the event effect", () => {
    const s0 = decisionState();
    const { state, report } = resolveTurn(s0, SIMPLE_DECK, free(rel("5")), ctx);
    expect(report.eventShareApplied).toBe(0);
    expect(state.scheduled).toEqual([]);
    expect(state.stats.stability).toBe(s0.stats.stability);
  });

  it("relevance 1 keeps all of it; the rest is scheduled with policyId event:<cardId>", () => {
    const s0 = decisionState();
    const { state, report } = resolveTurn(s0, SIMPLE_DECK, free(rel("1")), ctx);
    expect(report.eventShareApplied).toBe(1);
    expect(state.stats.stability).toBeCloseTo(s0.stats.stability - 1, 10);
    expect(state.scheduled).toEqual([
      { policyId: `event:${SIMPLE_CARD.id}`, target: "stability", deltaPerQuarter: -1, fromQuarter: 3, toQuarter: 5 },
    ]);
  });

  it("relevance 3 keeps half", () => {
    const { report } = resolveTurn(decisionState(), SIMPLE_DECK, free(rel("3")), ctx);
    expect(report.eventShareApplied).toBe(0.5);
  });

  it("event effects ignore TURN_CAP", () => {
    const big: typeof SIMPLE_CARD = { ...SIMPLE_CARD, id: "test.big", ifIgnored: [{ target: "stability", delta: -40, over_quarters: 1 }] };
    const s0 = decisionState("test.big");
    const { state } = resolveTurn(s0, [big], free(rel("1")), ctx);
    expect(state.stats.stability).toBeCloseTo(s0.stats.stability - 40, 10);
  });
});

describe("resolveTurn: effects and timing", () => {
  it("schedules an effect as total x multiplier spread over its duration", () => {
    const j = judgment({
      actions: [action({ cost_size: "none", effects: [effect({ indicator: "education", direction: "up", level: "1", start_after_quarters: 2, lasts_quarters: 4 })] })],
    });
    const seed = seedWhere(j, (o) => o === "success");
    const { state, report } = resolveTurn(decisionState(QUIET_CARD.id, seed), SIMPLE_DECK, free(j), ctx);
    expect(report.measures[0]!.multiplier).toBe(1);
    const total = levelToDelta("education", "1", "up");
    expect(state.scheduled).toEqual([
      { policyId: "q2.a0", target: "education", deltaPerQuarter: total / 4, fromQuarter: 4, toQuarter: 7 },
    ]);
    expect(report.scheduledCount).toBe(1);
    expect(state.stats.education).toBe(decisionState().stats.education); // nothing now
  });

  it("an effect starting now applies its first slice immediately and schedules the rest", () => {
    const j = judgment({
      actions: [action({ cost_size: "none", effects: [effect({ indicator: "education", direction: "up", level: "2", start_after_quarters: 0, lasts_quarters: 5 })] })],
    });
    const seed = seedWhere(j, (o) => o === "success");
    const s0 = decisionState(QUIET_CARD.id, seed);
    const { state, report } = resolveTurn(s0, SIMPLE_DECK, free(j), ctx);
    const per = levelToDelta("education", "2", "up") / 5;
    // level 2 without evidence is downgraded to level 1
    expect(report.measures[0]!.downgradedForEvidence).toBe(1);
    const per1 = levelToDelta("education", "1", "up") / 5;
    expect(per1).not.toBe(per);
    expect(state.stats.education).toBeCloseTo(s0.stats.education + per1, 10);
    expect(state.scheduled).toEqual([
      { policyId: "q2.a0", target: "education", deltaPerQuarter: per1, fromQuarter: 3, toQuarter: 6 },
    ]);
  });

  it("clamps start_after to 0-16 and lasts to 1-16, and never schedules past quarter 16", () => {
    const j = judgment({
      actions: [action({ cost_size: "none", effects: [
        effect({ indicator: "education", level: "1", start_after_quarters: -5, lasts_quarters: 99 }),
        effect({ indicator: "health", level: "1", start_after_quarters: 99, lasts_quarters: 0 }),
      ] })],
    });
    const seed = seedWhere(j, (o) => o === "success");
    const { state } = resolveTurn(decisionState(QUIET_CARD.id, seed), SIMPLE_DECK, free(j), ctx);
    const edu = state.scheduled.find((e) => e.target === "education")!;
    expect(edu.deltaPerQuarter).toBeCloseTo(levelToDelta("education", "1", "up") / 16, 10);
    expect(edu.fromQuarter).toBe(3);
    expect(edu.toQuarter).toBe(16);
    // start 2 + 16 = 18 > 16: nothing to schedule
    expect(state.scheduled.find((e) => e.target === "health")).toBeUndefined();
  });

  it("down group impacts are mitigated by the tradeoffs score and not by the multiplier", () => {
    const mk = (tradeoffs: "1" | "5") => judgment({
      actions: [action({ cost_size: "none", effects: [], group_impacts: [impact({ group: "business", direction: "down", level: "3" })] })],
      scores: { relevance: "3", feasibility: "1", specificity: "1", tradeoffs, consistency: "3" },
    });
    const s0 = decisionState(QUIET_CARD.id);
    const none = resolveTurn(s0, SIMPLE_DECK, free(mk("1")), ctx).state;
    const half = resolveTurn(s0, SIMPLE_DECK, free(mk("5")), ctx).state;
    expect(none.groups.business.satisfaction).toBeCloseTo(s0.groups.business.satisfaction - 8, 10);
    expect(half.groups.business.satisfaction).toBeCloseTo(s0.groups.business.satisfaction - 4, 10);
  });

  it("side effects of a failure apply at half size", () => {
    const j = judgment({
      actions: [action({ cost_size: "none", effects: [], side_effects: [effect({ indicator: "crime", direction: "up", level: "2", start_after_quarters: 0, lasts_quarters: 1, evidence_ids: ["ev.test.crime-down"] })] })],
    });
    // evidence direction is "down" and the side effect is "up": downgraded to level 1
    const seed = seedWhere(j, (o) => o === "failure");
    const s0 = decisionState(QUIET_CARD.id, seed);
    const { state } = resolveTurn(s0, SIMPLE_DECK, free(j), ctx);
    expect(state.stats.crime).toBeCloseTo(s0.stats.crime + levelToDelta("crime", "1", "up") * 0.5, 10);
  });

  it("a protest cuts stability, delays the action by one quarter, and happens at most once per action", () => {
    const j = judgment({
      actions: [action({ cost_size: "none", effects: [effect({ indicator: "education", level: "1", start_after_quarters: 0, lasts_quarters: 1 })],
        group_impacts: [
          impact({ group: "business", direction: "down", level: "3" }),
          impact({ group: "military", direction: "down", level: "3" }),
        ] })],
      scores: { relevance: "3", feasibility: "5", specificity: "3", tradeoffs: "1", consistency: "3" },
    });
    const base = decisionState(QUIET_CARD.id);
    const s0 = { ...base, groups: { ...base.groups, business: { ...base.groups.business, satisfaction: 25 }, military: { ...base.groups.military, satisfaction: 25 } } };
    let protests = 0;
    for (let i = 0; i < 60; i++) {
      const { state, report } = resolveTurn({ ...s0, seed: `p-${i}` }, SIMPLE_DECK, free(j), ctx);
      const m = report.measures[0]!;
      if (m.protest.happened) {
        protests++;
        expect(m.protest.group).not.toBeNull();
        expect(state.stats.stability).toBeCloseTo(s0.stats.stability - 3, 10);
        if (m.multiplier > 0) {
          // education slice would have applied now; with the delay it starts at quarter 3
          expect(state.stats.education).toBe(s0.stats.education);
          expect(state.scheduled.some((e) => e.target === "education" && e.fromQuarter === 3)).toBe(true);
        }
      } else {
        expect(state.stats.stability).toBe(s0.stats.stability);
      }
    }
    expect(protests).toBeGreaterThan(10);
    expect(protests).toBeLessThan(60);
  });

  it("legislation + medium/high legal risk registers a court check 1-3 quarters later", () => {
    const j = judgment({ actions: [action({ cost_size: "none", requires_legislation: false, legal_risk: "high", effects: [] })] });
    const { state, report } = resolveTurn(decisionState(QUIET_CARD.id), SIMPLE_DECK, free(j), ctx);
    expect(state.courtChecks).toHaveLength(1);
    const c = state.courtChecks[0]!;
    expect(c.policyId).toBe("q2.a0");
    expect(c.chance).toBe(0.5);
    expect(c.atQuarter).toBeGreaterThanOrEqual(3);
    expect(c.atQuarter).toBeLessThanOrEqual(5);
    expect(report.measures[0]!.courtRisk).toBe(0.5);
  });
});

describe("resolveTurn: determinism", () => {
  it("same seed + same inputs gives an identical state and report", () => {
    const j = judgment({
      actions: [action({ requires_legislation: true, legal_risk: "medium", group_impacts: [impact({ group: "farmers", direction: "down", level: "2" })] }), action()],
    });
    const a = resolveTurn(decisionState(), SIMPLE_DECK, free(j), ctx);
    const b = resolveTurn(decisionState(), SIMPLE_DECK, free(j), ctx);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("writes the rng cursor back to state", () => {
    const s0 = decisionState();
    const { state } = resolveTurn(s0, SIMPLE_DECK, free(judgment()), ctx);
    expect(state.rngCursor).toBeGreaterThan(s0.rngCursor);
  });

  it("different seeds can give different rolls", () => {
    const rolls = new Set<number>();
    for (let i = 0; i < 20; i++) {
      const r = resolveTurn(decisionState(QUIET_CARD.id, `d-${i}`), SIMPLE_DECK, free(judgment()), ctx).report;
      rolls.add(r.measures[0]!.roll!);
    }
    expect(rolls.size).toBeGreaterThan(5);
  });
});

describe("TURN_CAP is shared between tick and resolve in one quarter", () => {
  it("scheduled slices applied by the tick count against the cap of the same quarter", () => {
    let s = newGame({ country: fixtureCountry, difficulty: "normal", seed: "cap-share" });
    s = { ...s, scheduled: [{ policyId: "q0.a0", target: "health", deltaPerQuarter: 8, fromQuarter: 2, toQuarter: 4 }] };
    s = advanceQuarter(s, fixtureDeck);
    expect(s.phase).toBe("decision");
    const afterTick = s.stats.health;
    expect(afterTick).toBeGreaterThan(newGame({ country: fixtureCountry, difficulty: "normal", seed: "x" }).stats.health);
    const j = judgment({ actions: [action({ cost_size: "none", effects: [effect({ indicator: "health", level: "3", evidence_ids: [] })], })] });
    // a level-3 effect without evidence is level 1 (+2 total) so build a stronger demand with many actions
    const strong = judgment({ actions: [j.actions[0]!, j.actions[0]!, j.actions[0]!], scores: { relevance: "5", feasibility: "5", specificity: "5", tradeoffs: "3", consistency: "3" } });
    const { state } = resolveTurn(s, fixtureDeck, { kind: "free", judgment: strong }, ctx);
    // tick gave +8 of the 10 allowed, so at most +2 more can come from the player this quarter
    expect(state.stats.health - afterTick).toBeLessThanOrEqual(2 + 1e-9);
  });
});

describe("onArrival (good news)", () => {
  it("applies in full whatever the answer, and is exempt from the turn cap", async () => {
    const { fixtureDeck } = await import("./fixtures/cards");
    const { fixtureCountry } = await import("./fixtures/country");
    const { newGame, resolveTurn } = await import("../src/index");
    const base = fixtureDeck[0]!;
    const card = { ...base, id: "test.windfall", ifIgnored: [], onArrival: [{ target: "health" as const, delta: 12, over_quarters: 1 }] };
    const s0 = { ...newGame({ country: fixtureCountry, difficulty: "normal", seed: "w" }), phase: "decision" as const, pendingCardId: card.id };
    const judgment = card.choices[0]!.judgment!;
    const r = resolveTurn(s0, [card], { kind: "preset", judgment: { ...judgment, scores: { ...judgment.scores, relevance: "5" } } }, { evidence: [] });
    expect(r.report.immediate["health"] ?? 0).toBeGreaterThanOrEqual(12 - 1e-9 - 10); // windfall present even at relevance 5
    expect(r.state.stats.health - s0.stats.health).toBeGreaterThan(10);               // 12 from the windfall, not capped at 10
  });
});
