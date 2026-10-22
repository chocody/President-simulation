import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { GROUP_KEYS, STAT_KEYS, STAT_RANGE, TURN_CAP, type Judgment, type Target } from "@ps/shared";
import { advanceQuarter, newGame, resolveTurn } from "@ps/engine";
import { fixtureCountry } from "./fixtures/country";
import { fixtureDeck } from "./fixtures/cards";
import { fixtureEvidence } from "./fixtures/evidence";
import { QUIET_CARD, decisionState } from "./helpers";

const ctx = { evidence: fixtureEvidence };

const cf = <T extends string>(...v: T[]) => fc.constantFrom(...v);
const targetArb = cf<Target>(...STAT_KEYS, ...GROUP_KEYS.map((g): Target => `group:${g}`));
const levelArb = cf("1", "2", "3");
const dirArb = cf("up", "down");
const scoreArb = cf("1", "2", "3", "4", "5");
const evArb = fc.subarray(fixtureEvidence.map((e) => e.id).concat("ev.unknown"));

const effectArb = fc.record({
  indicator: targetArb, direction: dirArb, level: levelArb,
  start_after_quarters: fc.integer({ min: -5, max: 30 }),
  lasts_quarters: fc.integer({ min: -5, max: 30 }),
  note: fc.constant("TEST FIXTURE"), evidence_ids: evArb,
});

const actionArb = fc.record({
  title: fc.constant("TEST FIXTURE"),
  cost_size: cf("none", "XS", "S", "M", "L", "XL"),
  recurring_cost_size: cf("none", "XS", "S", "M", "L"),
  duration_quarters: fc.integer({ min: 0, max: 20 }),
  requires_legislation: fc.boolean(),
  legal_risk: cf("none", "low", "medium", "high"),
  effects: fc.array(effectArb, { maxLength: 4 }),
  group_impacts: fc.array(fc.record({ group: fc.constantFrom(...GROUP_KEYS), direction: dirArb, level: levelArb, reason: fc.constant("x") }), { maxLength: 4 }),
  side_effects: fc.array(effectArb, { maxLength: 3 }),
});

const judgmentArb: fc.Arbitrary<Judgment> = fc.record({
  input_class: cf("normal", "normal", "normal", "meta", "off_topic", "harmful", "gibberish"),
  interpretation: fc.constant("TEST FIXTURE"),
  actions: fc.array(actionArb, { maxLength: 5 }),
  overreach: fc.boolean(),
  scores: fc.record({ relevance: scoreArb, feasibility: scoreArb, specificity: scoreArb, tradeoffs: scoreArb, consistency: scoreArb }),
  event_coverage: cf("0", "1", "2", "3"),
  flags: fc.record({ impossible_claim: fc.boolean(), cruelty: fc.boolean(), rights_violation: fc.boolean(), unconstitutional: fc.boolean() }),
  follow_up_hooks: fc.constant([]),
});

const capOf = (t: Target) => (t.startsWith("group:") ? TURN_CAP.value.group : TURN_CAP.value[t as keyof typeof TURN_CAP.value]);

function inRange(stats: Record<string, number>, groups: Record<string, { satisfaction: number }>) {
  for (const k of STAT_KEYS) {
    const [lo, hi] = STAT_RANGE[k];
    expect(stats[k]).toBeGreaterThanOrEqual(lo);
    expect(stats[k]).toBeLessThanOrEqual(hi);
  }
  for (const g of GROUP_KEYS) {
    expect(groups[g]!.satisfaction).toBeGreaterThanOrEqual(0);
    expect(groups[g]!.satisfaction).toBeLessThanOrEqual(100);
  }
}

describe("property: one resolved turn", () => {
  it("no player-policy change in one quarter exceeds TURN_CAP; stats and satisfaction stay in range", () => {
    fc.assert(
      fc.property(judgmentArb, fc.constantFrom<"preset" | "free">("preset", "free"), fc.string({ minLength: 1, maxLength: 8 }), (j, kind, seed) => {
        // QUIET_CARD has no ifIgnored, so every delta below is a player-policy delta.
        const s0 = decisionState(QUIET_CARD.id, seed);
        const { state, report } = resolveTurn(s0, [QUIET_CARD], { kind, judgment: j }, ctx);

        for (const [t, d] of Object.entries(report.immediate)) {
          expect(Math.abs(d)).toBeLessThanOrEqual(capOf(t as Target) + 1e-9);
        }
        for (const k of STAT_KEYS) {
          if (k === "budget" || k === "debt") continue; // costs move these outside the cap
          expect(Math.abs(state.stats[k] - s0.stats[k])).toBeLessThanOrEqual(TURN_CAP.value[k] + 1e-9);
        }
        for (const g of GROUP_KEYS) {
          expect(Math.abs(state.groups[g].satisfaction - s0.groups[g].satisfaction)).toBeLessThanOrEqual(TURN_CAP.value.group + 1e-9);
        }
        inRange(state.stats, state.groups);
        expect(state.phase).toBe("running");
      }),
      { numRuns: 400 },
    );
  });

  it("is deterministic for any judgment", () => {
    fc.assert(
      fc.property(judgmentArb, (j) => {
        const a = resolveTurn(decisionState(), fixtureDeck.slice(0, 1).map((c) => ({ ...c, id: "test.simple" })), { kind: "free", judgment: j }, ctx);
        const b = resolveTurn(decisionState(), fixtureDeck.slice(0, 1).map((c) => ({ ...c, id: "test.simple" })), { kind: "free", judgment: j }, ctx);
        expect(a).toEqual(b);
      }),
      { numRuns: 100 },
    );
  });
});

describe("property: whole games with arbitrary answers", () => {
  it("stats and satisfaction stay in range, and the game ends by quarter 16", () => {
    fc.assert(
      fc.property(fc.array(judgmentArb, { minLength: 6, maxLength: 6 }), fc.string({ minLength: 1, maxLength: 8 }), cf("easy", "normal", "hard"), (js, seed, difficulty) => {
        let s = newGame({ country: fixtureCountry, difficulty, seed });
        let i = 0;
        for (let guard = 0; guard < 40 && s.phase !== "ended"; guard++) {
          if (s.phase === "decision") {
            s = resolveTurn(s, fixtureDeck, { kind: "free", judgment: js[i++ % js.length]! }, ctx).state;
            inRange(s.stats, s.groups);
          }
          s = advanceQuarter(s, fixtureDeck);
          inRange(s.stats, s.groups);
          expect(s.popularity).toBeGreaterThanOrEqual(0);
          expect(s.popularity).toBeLessThanOrEqual(100);
        }
        expect(s.phase).toBe("ended");
        expect(s.endReason).not.toBeNull();
      }),
      { numRuns: 60 },
    );
  });
});
