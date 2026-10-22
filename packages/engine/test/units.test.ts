import { describe, expect, it } from "vitest";
import { GROUP_KEYS, LEGACY, PILLARS, type Card, type GameState } from "@ps/shared";
import {
  Rng, courtCheck, eligibleCards, goodness, grades, groupTarget, legacyScore, levelToDelta, newGame,
  parliamentVote, pickCard, pillarScores, popularity, protest, costPctGdp, recurringPctGdpPerYear,
  advanceQuarter, runElection,
} from "@ps/engine";
import { fixtureCountry } from "./fixtures/country";
import { fixtureDeck } from "./fixtures/cards";
import { action, impact } from "./fixtures/judgments";

const b = fixtureCountry.baseline;
const fresh = (seed = "u"): GameState => newGame({ country: fixtureCountry, difficulty: "normal", seed });

describe("scales", () => {
  it("uses each stat's own row, and the index row for the rest", () => {
    expect(levelToDelta("gdpGrowth", "1", "up")).toBe(0.3);
    expect(levelToDelta("inflation", "3", "up")).toBe(3.0);
    expect(levelToDelta("unemployment", "2", "up")).toBe(0.7);
    expect(levelToDelta("inequality", "3", "up")).toBe(1.0);
    expect(levelToDelta("debt", "2", "up")).toBe(3);
    expect(levelToDelta("budget", "3", "up")).toBe(0.6);
    expect(levelToDelta("health", "2", "up")).toBe(5);
    expect(levelToDelta("crime", "3", "up")).toBe(8);
    expect(levelToDelta("parliament", "1", "up")).toBe(2);
    expect(levelToDelta("group:youth", "3", "up")).toBe(8);
  });
  it("down is negative and direction is literal", () => {
    expect(levelToDelta("crime", "2", "down")).toBe(-5);
    expect(levelToDelta("inflation", "1", "down")).toBe(-0.5);
    expect(levelToDelta("group:urban", "1", "down")).toBe(-2);
  });
  it("cost tables", () => {
    expect(costPctGdp("none")).toBe(0);
    expect(costPctGdp("XL")).toBe(4);
    expect(recurringPctGdpPerYear("M")).toBe(0.5);
    expect(recurringPctGdpPerYear("none")).toBe(0);
  });
});

describe("goodness", () => {
  it("interpolates linearly and clamps at the ends", () => {
    expect(goodness("gdpGrowth", 3)).toBe(70);
    expect(goodness("gdpGrowth", 1.5)).toBeCloseTo(50, 10);
    expect(goodness("gdpGrowth", -50)).toBe(0);
    expect(goodness("gdpGrowth", 50)).toBe(100);
    expect(goodness("inflation", 2)).toBe(100);
    expect(goodness("inflation", 3.5)).toBeCloseTo(85, 10);
    expect(goodness("crime", 25)).toBe(75);
    expect(goodness("parliament", 40)).toBe(25);
  });
  it("pillar scores are the mean goodness of their stats", () => {
    const s = fresh();
    const p = pillarScores(s.stats);
    const manual = PILLARS.society.reduce((a, k) => a + goodness(k, s.stats[k]), 0) / PILLARS.society.length;
    expect(p.society).toBeCloseTo(manual, 10);
    expect(Object.keys(p).sort()).toEqual(["economy", "other", "politics", "society"]);
  });
  it("group targets and popularity", () => {
    const s = fresh();
    expect(groupTarget("farmers", s.stats)).toBeCloseTo(
      (goodness("inflation", b.inflation) + goodness("environment", b.environment) + goodness("inequality", b.inequality)) / 3, 10);
    expect(popularity(s.groups)).toBeCloseTo(50, 10);
    const g = structuredClone(s.groups);
    for (const k of GROUP_KEYS) g[k].satisfaction = 80;
    expect(popularity(g)).toBeCloseTo(80, 10);
  });
});

describe("events", () => {
  const cond = (target: "unemployment" | "group:urban", op: "<" | ">", value: number): Card => ({
    ...fixtureDeck[0]!, id: `c.${target}.${op}.${value}`, conditions: [{ target, op, value }],
  });

  it("checks conditions on stats and on group satisfaction", () => {
    const s = fresh(); // unemployment 7, urban satisfaction 50
    const deck = [cond("unemployment", ">", 6), cond("unemployment", ">", 8), cond("group:urban", "<", 60), cond("group:urban", "<", 40)];
    expect(eligibleCards(s, deck).map((c) => c.id)).toEqual([deck[0]!.id, deck[2]!.id]);
  });

  it("respects the card's cooldown", () => {
    const deck = [{ ...fixtureDeck[0]!, id: "cd", cooldownQ: 4 }, { ...fixtureDeck[1]!, id: "nocd", cooldownQ: 0 }];
    const s: GameState = { ...fresh(), quarter: 7, cardHistory: [{ cardId: "cd", quarter: 4 }, { cardId: "nocd", quarter: 4 }] };
    expect(eligibleCards(s, deck).map((c) => c.id)).toEqual(["nocd"]);
    expect(eligibleCards({ ...s, quarter: 8 }, deck).map((c) => c.id)).toEqual(["cd", "nocd"]);
  });

  it("pickCard returns null when nothing is eligible and otherwise weights by baseWeight", () => {
    const s = fresh();
    expect(pickCard(s, [], new Rng("p", 0))).toBeNull();
    const deck = [{ ...fixtureDeck[0]!, id: "heavy", baseWeight: 9 }, { ...fixtureDeck[1]!, id: "light", baseWeight: 1 }];
    const counts: Record<string, number> = { heavy: 0, light: 0 };
    const rng = new Rng("weights", 0);
    for (let i = 0; i < 2000; i++) counts[pickCard(s, deck, rng)!.id]! += 1;
    expect(counts.heavy! / 2000).toBeGreaterThan(0.85);
    expect(counts.heavy! / 2000).toBeLessThan(0.95);
  });
});

describe("gates", () => {
  it("parliamentVote is not required without legislation", () => {
    expect(parliamentVote(fresh(), action({ requires_legislation: false }), new Rng("g", 0))).toEqual({ required: false, vote: null, passed: true });
  });

  it("parliamentVote: conflict is capped and the noise is bounded", () => {
    const s = fresh(); // parliament 55, popularity 50
    const a = action({ requires_legislation: true, group_impacts: GROUP_KEYS.map((g) => impact({ group: g, direction: "down", level: "3" })) });
    const rng = new Rng("v", 0);
    for (let i = 0; i < 200; i++) {
      const r = parliamentVote(s, a, rng);
      expect(r.required).toBe(true);
      expect(r.vote!).toBeGreaterThanOrEqual(55 - 8 - 4);
      expect(r.vote!).toBeLessThanOrEqual(55 - 8 + 4);
      expect(r.passed).toBe(r.vote! > 50);
    }
  });

  it("parliamentVote: up impacts cause no conflict; popularity moves the vote", () => {
    const s = { ...fresh(), popularity: 100 };
    const a = action({ requires_legislation: true, group_impacts: [impact({ direction: "up", level: "3" })] });
    const r = parliamentVote(s, a, new Rng("v", 0));
    expect(r.vote!).toBeGreaterThanOrEqual(55 + 10 - 4);
    expect(r.vote!).toBeLessThanOrEqual(55 + 10 + 4);
  });

  it("courtCheck: only medium and high risk", () => {
    expect(courtCheck(action({ legal_risk: "none" }), 3, new Rng("c", 0))).toBeNull();
    expect(courtCheck(action({ legal_risk: "low" }), 3, new Rng("c", 0))).toBeNull();
    const med = courtCheck(action({ legal_risk: "medium" }), 3, new Rng("c", 0), "p")!;
    expect(med.chance).toBe(0.2);
    expect(med.policyId).toBe("p");
    const seen = new Set<number>();
    for (let i = 0; i < 100; i++) {
      const hi = courtCheck(action({ legal_risk: "high" }), 3, new Rng("c", i))!;
      expect(hi.chance).toBe(0.5);
      seen.add(hi.atQuarter);
    }
    expect([...seen].sort()).toEqual([4, 5, 6]);
  });

  it("protest: needs a down impact whose projected satisfaction is below the threshold", () => {
    const s = fresh();
    const g = (sat: number): GameState => ({ ...s, groups: { ...s.groups, business: { share: 0.15, satisfaction: sat } } });
    const a = action({ group_impacts: [impact({ group: "business", direction: "down", level: "3" })] }); // -8
    let happened = 0;
    for (let i = 0; i < 200; i++) {
      // 33 - 8 = 25 is not below 25: never
      expect(protest(g(33), a, 0, new Rng("n", i)).happened).toBe(false);
      // 32 - 8 = 24 < 25: protest half the time
      const p = protest(g(32), a, 0, new Rng("y", i));
      if (p.happened) { happened++; expect(p.group).toBe("business"); expect(p.stabilityHit).toBe(3); expect(p.delayQuarters).toBe(1); }
      // mitigation 0.5: 32 - 4 = 28: never
      expect(protest(g(32), a, 0.5, new Rng("m", i)).happened).toBe(false);
    }
    expect(happened).toBeGreaterThan(60);
    expect(happened).toBeLessThan(140);
  });

  it("protest: up impacts never protest", () => {
    const s = { ...fresh(), groups: { ...fresh().groups, business: { share: 0.15, satisfaction: 0 } } };
    const a = action({ group_impacts: [impact({ group: "business", direction: "up", level: "3" })] });
    expect(protest(s, a, 0, new Rng("u", 0)).happened).toBe(false);
  });
});

describe("tick", () => {
  const quiet: Card[] = []; // no cards: no decision phase

  it("mean reversion (not budget/debt), budget income, and quarter counter", () => {
    const s0 = fresh();
    const s = advanceQuarter({ ...s0, stats: { ...s0.stats, gdpGrowth: 5, debt: 80, budget: 1 } }, quiet);
    expect(s.quarter).toBe(2);
    expect(s.phase).toBe("running");
    expect(s.stats.gdpGrowth).toBeCloseTo(5 + 0.05 * (b.gdpGrowth - 5), 10);
    expect(s.stats.debt).toBe(80);
    // debt 80 -> cut = 0.1 * floor(20 / 10) = 0.2; income = (2 - 0.2) / 4
    expect(s.stats.budget).toBeCloseTo(1 + 1.8 / 4, 10);
    expect(s.econHistory).toHaveLength(2);
  });

  it("no debt interest cut at or below 60", () => {
    const s0 = fresh();
    const s = advanceQuarter({ ...s0, stats: { ...s0.stats, debt: 60, budget: 0 } }, quiet);
    expect(s.stats.budget).toBeCloseTo(0.5, 10);
  });

  it("recurring costs reduce the budget; a shortfall becomes debt", () => {
    const s0 = fresh();
    const s = advanceQuarter({
      ...s0, stats: { ...s0.stats, budget: 0, debt: 50 },
      recurring: [{ policyId: "p", pctGdpPerYear: 4, untilQuarter: 16 }],
    }, quiet);
    // income 0.5 - cost 1 = -0.5
    expect(s.stats.budget).toBe(0);
    expect(s.stats.debt).toBeCloseTo(50.5, 10);
  });

  it("applies scheduled slices covering the new quarter, with the per-quarter cap for policies only", () => {
    const s0 = fresh();
    const s = advanceQuarter({
      ...s0,
      stats: { ...s0.stats, health: b.health - 10, education: 50 },
      scheduled: [
        { policyId: "a", target: "health", deltaPerQuarter: 8, fromQuarter: 2, toQuarter: 3 },
        { policyId: "b", target: "health", deltaPerQuarter: 8, fromQuarter: 2, toQuarter: 3 },
        { policyId: "event:x", target: "education", deltaPerQuarter: -30, fromQuarter: 2, toQuarter: 2 },
        { policyId: "c", target: "education", deltaPerQuarter: 99, fromQuarter: 5, toQuarter: 6 },
      ],
    }, quiet);
    // health: +16 capped to +10 lands on the baseline, so reversion changes nothing
    expect(s.stats.health).toBeCloseTo(b.health, 10);
    // education: -30 uncapped, then reversion toward the baseline
    expect(s.stats.education).toBeCloseTo(20 + 0.05 * (b.education - 20), 10);
  });

  it("a court suspension removes the policy's remaining slices and recurring cost", () => {
    const s0 = fresh();
    const s = advanceQuarter({
      ...s0,
      scheduled: [
        { policyId: "p", target: "health", deltaPerQuarter: 1, fromQuarter: 2, toQuarter: 6 },
        { policyId: "q", target: "education", deltaPerQuarter: 1, fromQuarter: 2, toQuarter: 6 },
      ],
      recurring: [{ policyId: "p", pctGdpPerYear: 1, untilQuarter: 16 }, { policyId: "q", pctGdpPerYear: 1, untilQuarter: 16 }],
      courtChecks: [{ policyId: "p", atQuarter: 2, chance: 1 }],
    }, quiet);
    expect(s.courtChecks).toEqual([]);
    expect(s.recurring.map((r) => r.policyId)).toEqual(["q"]);
    expect(s.scheduled.filter((e) => e.policyId === "p" && e.toQuarter > 2)).toEqual([]);
    expect(s.scheduled.some((e) => e.policyId === "q" && e.toQuarter === 6)).toBe(true);
    expect(s.log.some((l) => l.includes("p"))).toBe(true);
  });

  it("a court check with chance 0 never suspends", () => {
    const s0 = fresh();
    const s = advanceQuarter({
      ...s0,
      scheduled: [{ policyId: "p", target: "health", deltaPerQuarter: 1, fromQuarter: 2, toQuarter: 6 }],
      courtChecks: [{ policyId: "p", atQuarter: 2, chance: 0 }],
    }, quiet);
    expect(s.courtChecks).toEqual([]);
    expect(s.scheduled.some((e) => e.policyId === "p" && e.toQuarter === 6)).toBe(true);
  });

  it("group satisfaction drifts a quarter of the way to its target", () => {
    const s0 = fresh();
    const s = advanceQuarter(s0, quiet);
    const t = groupTarget("urban", s.stats);
    expect(s.groups.urban.satisfaction).toBeCloseTo(50 + 0.25 * (t - 50), 10);
    expect(s.popularity).toBeCloseTo(popularity(s.groups), 10);
  });

  it("opens a decision on decision quarters only, when a card is eligible", () => {
    let s = fresh();
    s = advanceQuarter(s, fixtureDeck); // q2: decision quarter
    expect(s.phase).toBe("decision");
    expect(fixtureDeck.map((c) => c.id)).toContain(s.pendingCardId);
    const s3 = advanceQuarter({ ...fresh(), quarter: 2 }, fixtureDeck); // q3: not a decision quarter
    expect(s3.phase).toBe("running");
    expect(s3.pendingCardId).toBeNull();
  });

  it("impeachment only happens when its condition holds", () => {
    let ended = 0;
    for (let i = 0; i < 300; i++) {
      const s0 = fresh(`imp-${i}`);
      const bad = advanceQuarter({ ...s0, stats: { ...s0.stats, parliament: 0, corruption: 100 } }, quiet);
      if (bad.phase === "ended") { ended++; expect(bad.endReason).toBe("impeached"); }
      const fine = advanceQuarter(s0, quiet);
      expect(fine.phase).toBe("running");
    }
    expect(ended).toBeGreaterThan(20); // about 15% of 300
    expect(ended).toBeLessThan(80);
  });

  it("coup and uprising end the game with their reasons", () => {
    const coups = new Set<string | null>();
    for (let i = 0; i < 200; i++) {
      const s0 = fresh(`coup-${i}`);
      const s = advanceQuarter({
        ...s0, stats: { ...s0.stats, stability: 0 },
        groups: { ...s0.groups, military: { share: 0.1, satisfaction: 0 } },
      }, quiet);
      if (s.phase === "ended") coups.add(s.endReason);
    }
    expect(coups.has("coup")).toBe(true);
    for (const r of coups) expect(["coup", "uprising"]).toContain(r);
  });
});

describe("election and endings", () => {
  const atSixteen = (sat: number, econ: number): GameState => {
    const s = fresh();
    const groups = structuredClone(s.groups);
    for (const k of GROUP_KEYS) groups[k].satisfaction = sat;
    return { ...s, quarter: 16, groups, econHistory: [0, 0, 0, econ, econ, econ, econ] };
  };

  it("a loved government wins, a hated one loses; the game ends", () => {
    const won = runElection(atSixteen(90, 90), new Rng("e", 0));
    expect(won.endReason).toBe("won_election");
    expect(won.phase).toBe("ended");
    expect(won.voteShare!).toBeGreaterThan(90);
    const lost = runElection(atSixteen(10, 10), new Rng("e", 0));
    expect(lost.endReason).toBe("lost_election");
    expect(lost.voteShare!).toBeLessThan(50);
  });

  it("vote = sum(share * S) + 0.15 (E - 50) + noise within +-3, E from the last 4 quarters only", () => {
    const s = atSixteen(60, 80);
    for (let i = 0; i < 50; i++) {
      const r = runElection(s, new Rng("n", i));
      expect(r.voteShare!).toBeGreaterThanOrEqual(60 + 4.5 - 3 - 1e-9);
      expect(r.voteShare!).toBeLessThanOrEqual(60 + 4.5 + 3 + 1e-9);
    }
  });

  it("advanceQuarter at quarter 16 runs the election", () => {
    const s = advanceQuarter({ ...atSixteen(90, 90), phase: "running" }, []);
    expect(s.phase).toBe("ended");
    expect(["won_election", "lost_election"]).toContain(s.endReason);
  });

  it("grades follow the thresholds of GRADES", () => {
    const s = fresh();
    const mk = (delta: number) => ({ ...s, pillarsAtStart: { economy: 50 - delta, society: 50 - delta, politics: 50 - delta, other: 50 - delta } });
    const withPillars = (st: GameState, pillar: number): GameState => ({ ...st, stats: st.stats, pillarsAtStart: { economy: pillar, society: pillar, politics: pillar, other: pillar } });
    const now = pillarScores(s.stats);
    const g = (change: number) => grades(withPillars(s, now.economy - change)).economy.grade;
    expect(g(10)).toBe("A");
    expect(g(9.9)).toBe("B");
    expect(g(3)).toBe("B");
    expect(g(2.9)).toBe("C");
    expect(g(0)).toBe("C");
    expect(g(-3)).toBe("D"); // not greater than C = -3
    expect(g(-9.9)).toBe("D");
    expect(g(-10)).toBe("F");
    expect(g(-30)).toBe("F");
    expect(mk(0).quarter).toBe(1);
  });

  it("legacy score uses the pillar change, popularity and the early-end penalty", () => {
    const s = fresh();
    const now = pillarScores(s.stats);
    const same: GameState = { ...s, pillarsAtStart: now, popularity: 60 };
    expect(legacyScore(same)).toBeCloseTo(LEGACY.value.pillarWeight * 50 + LEGACY.value.popularityWeight * 60, 10);
    const better: GameState = { ...same, pillarsAtStart: { economy: now.economy - 10, society: now.society - 10, politics: now.politics - 10, other: now.other - 10 } };
    expect(legacyScore(better)).toBeCloseTo(0.75 * 75 + 0.25 * 60, 10);
    expect(legacyScore({ ...same, endReason: "impeached" })).toBeCloseTo(legacyScore(same) - 30, 10);
    expect(legacyScore({ ...same, endReason: "coup" })).toBeCloseTo(legacyScore(same) - 30, 10);
    const huge: GameState = { ...same, pillarsAtStart: { economy: -500, society: -500, politics: -500, other: -500 }, popularity: 100 };
    expect(legacyScore(huge)).toBeLessThanOrEqual(100);
  });
});
