import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  CRISIS_RESPONSE, GameState, LEVEL_SCALE, SCENES, SceneTemplate, STAT_KEYS, STAT_RANGE,
  type Action, type SceneRecord, type StatKey, type Target, type TurnReport,
} from "@ps/shared";
import { advanceQuarter, goodness, levelToDelta, newGame, resolveTurn } from "@ps/engine";
import { buildTurnScenes, crisisStatus, sceneTone, SCENE_REPEAT_WINDOW_Q } from "../src/scenes";
import { fixtureCountry } from "./fixtures/country";
import { fixtureEvidence } from "./fixtures/evidence";
import { deltaSceneId, fixtureScenes } from "./fixtures/scenes";
import { action, effect, impact, judgment } from "./fixtures/judgments";
import { QUIET_CARD, SIMPLE_CARD, SIMPLE_DECK, decisionState } from "./helpers";

const ctx = { evidence: fixtureEvidence };

function measure(over: Partial<TurnReport["measures"][number]> = {}): TurnReport["measures"][number] {
  return {
    title: "TEST FIXTURE measure", parliament: { required: false, vote: null, passed: true }, courtRisk: 0,
    protest: { group: null, happened: false }, probability: 70, roll: 30, outcome: "success", multiplier: 1,
    costPctGdp: 0.2, downgradedForEvidence: 0, ...over,
  };
}

function report(immediate: Record<string, number>, measures: TurnReport["measures"] = []): TurnReport {
  return { quarter: 2, cardId: QUIET_CARD.id, answerKind: "free", eventShareApplied: 0, measures, immediate, scheduledCount: 0, notes: [] };
}

const base = (): GameState => decisionState(QUIET_CARD.id, "scene-seed");
const input = (rep: TurnReport, actions: Action[] = [], over: Record<string, unknown> = {}) =>
  ({ state: base(), report: rep, card: QUIET_CARD, actions, library: fixtureScenes, ...over });

const STEP1 = (t: Target) => levelToDelta(t, "1", "up");
const STEP2 = (t: Target) => levelToDelta(t, "2", "up");

describe("fixture library", () => {
  it("is valid against the SceneTemplate schema", () => {
    for (const t of fixtureScenes) expect(() => SceneTemplate.parse(t)).not.toThrow();
  });
});

describe("resolveTurn records policies", () => {
  it("adds one entry per enacted measure with the id used by its slices", () => {
    const j = judgment({ actions: [action({ title: "TEST FIXTURE one" }), action({ title: "TEST FIXTURE two" })] });
    const { state } = resolveTurn(decisionState(QUIET_CARD.id, "pol"), SIMPLE_DECK, { kind: "free", judgment: j }, ctx);
    expect(state.policies).toEqual([
      { id: "q2.a0", title: "TEST FIXTURE one", quarter: 2 },
      { id: "q2.a1", title: "TEST FIXTURE two", quarter: 2 },
    ]);
    expect(state.scheduled.every((e) => state.policies!.some((p) => p.id === e.policyId))).toBe(true);
  });

  it("does not record a measure that parliament blocked, and nothing for non-normal input", () => {
    const blocked = judgment({ actions: [action({ requires_legislation: true })] });
    const weak = decisionState(QUIET_CARD.id, "blk");
    weak.stats.parliament = 0;
    const r = resolveTurn(weak, SIMPLE_DECK, { kind: "free", judgment: blocked }, ctx);
    expect(r.report.measures[0]!.outcome).toBe("blocked");
    expect(r.state.policies ?? []).toEqual([]);
    const meta = resolveTurn(decisionState(QUIET_CARD.id, "m"), SIMPLE_DECK, { kind: "free", judgment: judgment({ input_class: "meta" }) }, ctx);
    expect(meta.state.policies ?? []).toEqual([]);
  });
});

describe("buildTurnScenes", () => {
  it("is deterministic: same input, same scenes and same state", () => {
    const rep = report({ health: 6, crime: -3, "group:urban": 4 }, [measure({ outcome: "failure" })]);
    const a = buildTurnScenes(input(rep, [action()]));
    const b = buildTurnScenes(input(rep, [action()]));
    expect(a).toEqual(b);
    expect(a.scenes.length).toBeGreaterThan(0);
  });

  it("uses no random numbers and changes nothing without a library", () => {
    const rep = report({ health: 6 }, [measure({ outcome: "failure" })]);
    const out = buildTurnScenes(input(rep, [action()], { library: [] }));
    expect(out.scenes).toEqual([]);
    expect(out.state).toEqual(base());
  });

  it("uses no random numbers when nothing happened", () => {
    const out = buildTurnScenes(input(report({})));
    expect(out.scenes).toEqual([]);
    expect(out.state.rngCursor).toBe(base().rngCursor);
    expect(out.state.scenes ?? []).toEqual([]);
  });

  it("appends a SceneRecord with the quarter for every scene, newest last, and does not mutate the input", () => {
    const s = base();
    const before = structuredClone(s);
    const rep = report({ health: 6, crime: -3 });
    const out = buildTurnScenes({ ...input(rep), state: s });
    expect(s).toEqual(before);
    expect(out.state.scenes).toEqual(out.scenes.map((x) => ({ ...x, quarter: 2 })));
    expect(() => GameState.parse(out.state)).not.toThrow();
  });

  it("returns at most SCENES.maxPerTurn scenes, with outcome and protest scenes first", () => {
    const imm: Record<string, number> = {};
    for (const k of STAT_KEYS) imm[k] = k === "budget" ? 1 : 9;
    const ms = [
      measure({ outcome: "failure", title: "A" }),
      measure({ outcome: "success", title: "B", protest: { group: "farmers", happened: true } }),
    ];
    const { scenes } = buildTurnScenes(input(report(imm, ms), [action(), action()]));
    expect(scenes.length).toBe(SCENES.value.maxPerTurn);
    expect(scenes[0]!.templateId).toBe("scene.test.outcome.failure");
    expect(scenes[1]!.templateId).toBe("scene.test.protest.farmers");
    expect(scenes.slice(2).every((x) => x.templateId.includes(".up.") || x.templateId.includes(".down."))).toBe(true);
  });

  it("ranks delta scenes by size relative to the level-1 step", () => {
    const { scenes } = buildTurnScenes(input(report({ health: 3, gdpGrowth: 0.9, crime: -12 })));
    expect(scenes.map((x) => x.targets[0])).toEqual(["crime", "gdpGrowth", "health"]);
  });

  it("makes no scene for changes below minLevelShare x the level-1 step, and one at the threshold", () => {
    for (const t of ["health", "gdpGrowth", "inflation", "debt", "group:youth"] as Target[]) {
      const min = SCENES.value.minLevelShare * STEP1(t);
      expect(buildTurnScenes(input(report({ [t]: min * 0.99 }))).scenes).toEqual([]);
      expect(buildTurnScenes(input(report({ [t]: -min * 0.99 }))).scenes).toEqual([]);
      const at = buildTurnScenes(input(report({ [t]: min })));
      expect(at.scenes).toHaveLength(1);
      expect(at.scenes[0]!.templateId).toBe(deltaSceneId(t, "up", "small"));
    }
  });

  it("picks the large template from the level-2 step upwards", () => {
    for (const t of ["health", "gdpGrowth", "unemployment", "group:business"] as Target[]) {
      const small = buildTurnScenes(input(report({ [t]: -STEP2(t) * 0.99 })));
      expect(small.scenes[0]!.templateId).toBe(deltaSceneId(t, "down", "small"));
      const large = buildTurnScenes(input(report({ [t]: -STEP2(t) })));
      expect(large.scenes[0]!.templateId).toBe(deltaSceneId(t, "down", "large"));
    }
  });

  it("falls back to the other size and skips a trigger with no template", () => {
    const onlyLarge = fixtureScenes.filter((t) => t.id !== deltaSceneId("health", "up", "small"));
    const a = buildTurnScenes(input(report({ health: 2 }), [], { library: onlyLarge }));
    expect(a.scenes.map((x) => x.templateId)).toEqual([deltaSceneId("health", "up", "large")]);
    const none = onlyLarge.filter((t) => t.trigger.kind !== "delta" || t.trigger.target !== "health" || t.trigger.direction !== "up");
    const b = buildTurnScenes(input(report({ health: 2, crime: 3 }), [], { library: none }));
    expect(b.scenes.map((x) => x.targets[0])).toEqual(["crime"]);
  });

  it("attributes a change to the measure with the biggest level x multiplier on that target, else the event card", () => {
    const small = action({ title: "SMALL", effects: [effect({ indicator: "health", level: "1" })] });
    const big = action({ title: "BIG", effects: [effect({ indicator: "health", level: "3" })] });
    const isDelta = (x: { templateId: string }) => /\.(up|down)\./.test(x.templateId);
    const rep = report({ health: 8, crime: -3 }, [measure({ title: "SMALL" }), measure({ title: "BIG" })]);
    const { scenes } = buildTurnScenes(input(rep, [small, big]));
    expect(scenes.find((x) => x.targets[0] === "health")!.cause).toBe("BIG");
    expect(scenes.find((x) => x.targets[0] === "crime")!.cause).toBe(QUIET_CARD.titleTh);
    // multiplier counts: a failed (x0) big measure loses to a working small one
    const rep2 = report({ health: 8 }, [measure({ title: "SMALL" }), measure({ title: "BIG", outcome: "failure", multiplier: 0 })]);
    const s2 = buildTurnScenes(input(rep2, [small, big])).scenes.find((x) => isDelta(x) && x.targets[0] === "health")!;
    expect(s2.cause).toBe("SMALL");
    // group impacts attribute group targets; an effect pushing the other way is not a cause
    const g = action({ title: "G", effects: [], group_impacts: [impact({ group: "urban", direction: "up", level: "2" })] });
    const wrong = action({ title: "WRONG", effects: [effect({ indicator: "health", direction: "down", level: "3" })] });
    const rep3 = report({ "group:urban": 5, health: 8 }, [measure({ title: "G" }), measure({ title: "WRONG" })]);
    const s3 = buildTurnScenes(input(rep3, [g, wrong])).scenes.filter(isDelta);
    expect(s3.find((x) => x.targets[0] === "group:urban")!.cause).toBe("G");
    expect(s3.find((x) => x.targets[0] === "health")!.cause).toBe(QUIET_CARD.titleTh);
  });

  it("has a null cause when there is no measure and no card", () => {
    const { scenes } = buildTurnScenes(input(report({ health: 6 }), [], { card: null }));
    expect(scenes[0]!.cause).toBeNull();
  });

  it("makes outcome scenes for every outcome except success, and protest scenes, with {measure} filled", () => {
    for (const outcome of ["blocked", "critical_failure", "great_success", "partial", "failure"] as const) {
      const out = buildTurnScenes(input(report({}, [measure({ title: "M1", outcome })]), [action()]));
      expect(out.scenes).toHaveLength(1);
      expect(out.scenes[0]!.templateId).toBe(`scene.test.outcome.${outcome.replace("_", "-")}`);
      expect(out.scenes[0]!.textTh).toBe(`TEST FIXTURE ${outcome} M1`);
      expect(out.scenes[0]!.cause).toBe("M1");
      expect(out.scenes[0]!.kind).toBe("turn");
    }
    expect(buildTurnScenes(input(report({}, [measure()]), [action()])).scenes).toEqual([]);
    const prot = buildTurnScenes(input(report({}, [measure({ title: "P", protest: { group: "youth", happened: true } })]), [action()]));
    expect(prot.scenes.map((x) => [x.templateId, x.textTh, x.tone])).toEqual([["scene.test.protest.youth", "TEST FIXTURE protest youth P", "bad"]]);
  });

  it("never leaves a {measure} placeholder in a scene text", () => {
    const withMeasure: SceneTemplate = { id: "scene.test.odd", trigger: { kind: "delta", target: "health", direction: "up", size: "small" }, textTh: "x {measure}", sourceIds: ["a"] };
    const lib = [...fixtureScenes.filter((t) => t.id !== deltaSceneId("health", "up", "small")), withMeasure];
    const out = buildTurnScenes(input(report({ health: 2 }), [], { library: lib, card: null }));
    expect(out.scenes.every((x) => !x.textTh.includes("{measure}"))).toBe(true);
  });

  it("avoids a template used in the last quarters when another exists, and reuses it when it is the only one", () => {
    const t = (n: number): SceneTemplate => ({
      id: `scene.test.health-up-${n}`, trigger: { kind: "delta", target: "health", direction: "up", size: "small" },
      textTh: `TEST FIXTURE variant ${n}`, sourceIds: ["a"],
    });
    const used: SceneRecord = { templateId: "scene.test.health-up-1", textTh: "", tone: "good", cause: null, targets: ["health"], kind: "turn", quarter: 2 - (SCENE_REPEAT_WINDOW_Q - 1) };
    for (let i = 0; i < 40; i++) {
      const s = { ...base(), seed: `avoid-${i}`, scenes: [used] };
      const out = buildTurnScenes({ ...input(report({ health: 2 }), [], { library: [t(1), t(2)] }), state: s });
      expect(out.scenes[0]!.templateId).toBe("scene.test.health-up-2");
      const only = buildTurnScenes({ ...input(report({ health: 2 }), [], { library: [t(1)] }), state: s });
      expect(only.scenes[0]!.templateId).toBe("scene.test.health-up-1");
    }
    // outside the window it is allowed again
    const old = { ...used, quarter: 2 - SCENE_REPEAT_WINDOW_Q };
    const ids = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const s = { ...base(), seed: `old-${i}`, scenes: [old] };
      ids.add(buildTurnScenes({ ...input(report({ health: 2 }), [], { library: [t(1), t(2)] }), state: s }).scenes[0]!.templateId);
    }
    expect(ids.size).toBe(2);
  });

  it("weights templates by country traits", () => {
    const mk = (id: string, traitWeights?: SceneTemplate["traitWeights"]): SceneTemplate => ({
      id, trigger: { kind: "delta", target: "gdpGrowth", direction: "up", size: "small" }, textTh: id, sourceIds: ["a"], traitWeights,
    });
    const lib = [mk("scene.test.plain"), mk("scene.test.tourist", { tourism: 1 })];
    const count = (tourism: number) => {
      let n = 0;
      for (let i = 0; i < 300; i++) {
        const s = { ...base(), seed: `trait-${i}` };
        const r = buildTurnScenes({ ...input(report({ gdpGrowth: 0.5 }), [], { library: lib, traits: { tourism } }), state: s });
        if (r.scenes[0]!.templateId === "scene.test.tourist") n++;
      }
      return n;
    };
    const high = count(100);   // weight 2 vs 1
    const low = count(0);      // weight clamped to the minimum vs 1
    expect(high).toBeGreaterThan(150);
    expect(low).toBeLessThan(60);
  });

  it("works on a state saved before policies and scenes existed", () => {
    const old: Partial<GameState> = { ...base() };
    delete old.policies;
    delete old.scenes;
    const out = buildTurnScenes({ ...input(report({ health: 6 })), state: old as GameState });
    expect(out.scenes).toHaveLength(1);
    expect(out.state.scenes).toHaveLength(1);
  });

  it("works end to end with resolveTurn", () => {
    const j = judgment({ actions: [action({ title: "TEST FIXTURE e2e", effects: [effect({ indicator: "health", level: "3", evidence_ids: ["ev.test.health-up"] })] })] });
    const turn = resolveTurn(decisionState(QUIET_CARD.id, "e2e"), SIMPLE_DECK, { kind: "free", judgment: j }, ctx);
    const out = buildTurnScenes({ state: turn.state, report: turn.report, card: QUIET_CARD, actions: j.actions, library: fixtureScenes });
    expect(out.scenes.length).toBeGreaterThan(0);
    expect(out.state.rngCursor).toBeGreaterThanOrEqual(turn.state.rngCursor);
    expect(out.scenes.length).toBeLessThanOrEqual(SCENES.value.maxPerTurn);
  });
});

describe("scene tone follows the goodness direction, never the text", () => {
  it("sceneTone equals the sign of the goodness change for every stat (property)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STAT_KEYS), fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: -1, max: 1, noNaN: true }),
        (stat: StatKey, u, w) => {
          const [lo, hi] = STAT_RANGE[stat];
          const after = lo + u * (hi - lo);
          const delta = w * STEP2(stat) * 2;
          const diff = goodness(stat, after) - goodness(stat, after - delta);
          const tone = sceneTone(stat, delta, after);
          if (Math.abs(diff) < 1e-9) expect(tone).toBe("neutral");
          else expect(tone).toBe(diff > 0 ? "good" : "bad");
        },
      ),
    );
  });

  it("scenes built from a report carry that tone (property), whatever the template text says", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STAT_KEYS), fc.double({ min: 0.05, max: 0.95, noNaN: true }), fc.boolean(), fc.double({ min: 1, max: 3, noNaN: true }),
        (stat: StatKey, u, down, mult) => {
          const [lo, hi] = STAT_RANGE[stat];
          const after = lo + u * (hi - lo);
          const delta = (down ? -1 : 1) * mult * STEP1(stat);
          const s = base();
          s.stats = { ...s.stats, [stat]: after };
          const out = buildTurnScenes({ ...input(report({ [stat]: delta })), state: s });
          expect(out.scenes).toHaveLength(1);
          expect(out.scenes[0]!.tone).toBe(sceneTone(stat, delta, after));
        },
      ),
    );
  });

  it("known cases: crime down is good, inflation up from a low level is good, unemployment up is bad, group up is good", () => {
    expect(sceneTone("crime", -3, 40)).toBe("good");
    expect(sceneTone("unemployment", 1, 6)).toBe("bad");
    expect(sceneTone("inflation", 1, 2)).toBe("good");   // 1% -> 2%, towards the best level
    expect(sceneTone("inflation", 1, 9)).toBe("bad");
    expect(sceneTone("group:farmers", 3, 50)).toBe("good");
    expect(sceneTone("group:farmers", -3, 50)).toBe("bad");
    expect(sceneTone("health", 0, 50)).toBe("neutral");
  });

  it("outcome tones: failures and blocks bad, great success good, partial neutral", () => {
    const tone = (outcome: TurnReport["measures"][number]["outcome"]) =>
      buildTurnScenes(input(report({}, [measure({ outcome })]), [action()])).scenes[0]!.tone;
    expect([tone("blocked"), tone("critical_failure"), tone("failure"), tone("great_success"), tone("partial")])
      .toEqual(["bad", "bad", "bad", "good", "neutral"]);
  });
});

// ---------- advanceQuarter ----------

function running(quarter: number, over: Partial<GameState> = {}): GameState {
  return { ...newGame({ country: fixtureCountry, difficulty: "normal", seed: "tick-seed" }), quarter, phase: "running", ...over };
}
const slice = (policyId: string, target: Target, per: number, from: number, to: number) => ({ policyId, target, deltaPerQuarter: per, fromQuarter: from, toQuarter: to });
const policy = (n: number, title: string, quarter = 2) => ({ id: `q${quarter}.a${n}`, title, quarter });

describe("advanceQuarter: follow-up and court scenes", () => {
  it("adds a followup scene in the quarter a delayed effect starts, named after the measure", () => {
    const per = STEP1("health");
    const s = running(4, { policies: [policy(0, "MEASURE ONE")], scheduled: [slice("q2.a0", "health", per, 6, 6)] });
    const at5 = advanceQuarter(s, SIMPLE_DECK, [], {}, fixtureScenes);
    expect(at5.scenes ?? []).toEqual([]);            // nothing starts in quarter 5
    const at6 = advanceQuarter(at5, SIMPLE_DECK, [], {}, fixtureScenes);
    const f = (at6.scenes ?? []).filter((x) => x.kind === "followup");
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ cause: "MEASURE ONE", quarter: 6, targets: ["health"], tone: "good", templateId: deltaSceneId("health", "up", "small") });
    const at7 = advanceQuarter(at6, SIMPLE_DECK, [], {}, fixtureScenes);
    expect((at7.scenes ?? []).length).toBe(f.length);   // the continuing slices do not repeat it
  });

  it("uses the large template when the total reaches the level-2 step, and a negative total gives a down scene", () => {
    const s = running(4, { policies: [policy(0, "M")], scheduled: [slice("q2.a0", "crime", -STEP2("crime") / 2, 5, 6)] });
    const out = advanceQuarter(s, SIMPLE_DECK, [], {}, fixtureScenes);
    expect(out.scenes![0]).toMatchObject({ kind: "followup", templateId: deltaSceneId("crime", "down", "large"), tone: "good" });
  });

  it("makes no followup when the total is below followupMinLevelShare x the level-1 step", () => {
    const per = (SCENES.value.followupMinLevelShare * STEP1("health") * 0.9) / 3;
    const s = running(4, { policies: [policy(0, "M")], scheduled: [slice("q2.a0", "health", per, 5, 7)] });
    expect(advanceQuarter(s, SIMPLE_DECK, [], {}, fixtureScenes).scenes ?? []).toEqual([]);
    const enough = running(4, { policies: [policy(0, "M")], scheduled: [slice("q2.a0", "health", per / 0.9, 5, 7)] });
    expect(advanceQuarter(enough, SIMPLE_DECK, [], {}, fixtureScenes).scenes).toHaveLength(1);
  });

  it("makes at most maxFollowupsPerQuarter, biggest first, and ignores event and news slices", () => {
    const s = running(4, {
      policies: [policy(0, "A"), policy(1, "B"), policy(2, "C")],
      scheduled: [
        slice("q2.a0", "health", 2, 5, 5), slice("q2.a1", "education", 5, 5, 5), slice("q2.a2", "crime", -3, 5, 5),
        slice("event:x", "stability", 9, 5, 5), slice("event:news:y", "stability", 9, 5, 5),
      ],
    });
    const out = advanceQuarter(s, SIMPLE_DECK, [], {}, fixtureScenes);
    const f = out.scenes!.filter((x) => x.kind === "followup");
    expect(f).toHaveLength(SCENES.value.maxFollowupsPerQuarter);
    expect(f.map((x) => x.cause)).toEqual(["B", "C"]);   // education 5/2 = 2.5 steps, crime 3/2 = 1.5, health 1
  });

  it("makes no followup for a policy missing from state.policies (older saves)", () => {
    const s = running(4, { scheduled: [slice("q2.a0", "health", 5, 5, 5)] });
    expect(advanceQuarter(s, SIMPLE_DECK, [], {}, fixtureScenes).scenes ?? []).toEqual([]);
  });

  it("adds a court scene with the measure title when a court suspends it", () => {
    const s = running(4, {
      policies: [policy(0, "COURT MEASURE")], courtChecks: [{ policyId: "q2.a0", atQuarter: 5, chance: 1 }],
      scheduled: [slice("q2.a0", "health", 5, 5, 9)],
    });
    const out = advanceQuarter(s, SIMPLE_DECK, [], {}, fixtureScenes);
    const court = out.scenes!.filter((x) => x.kind === "court");
    expect(court).toHaveLength(1);
    expect(court[0]).toMatchObject({ cause: "COURT MEASURE", quarter: 5, tone: "bad", textTh: "TEST FIXTURE court COURT MEASURE" });
    expect(out.scenes!.filter((x) => x.kind === "followup")).toEqual([]);   // a suspended measure has no follow-up
    const allowed = advanceQuarter({ ...s, courtChecks: [{ policyId: "q2.a0", atQuarter: 5, chance: 0 }] }, SIMPLE_DECK, [], {}, fixtureScenes);
    expect(allowed.scenes!.filter((x) => x.kind === "court")).toEqual([]);
  });

  it("is unchanged when there is no library: same state as before, same RNG use", () => {
    const s = running(4, { policies: [policy(0, "M")], scheduled: [slice("q2.a0", "health", 5, 5, 5)], courtChecks: [{ policyId: "q2.a0", atQuarter: 5, chance: 1 }] });
    const plain = advanceQuarter(s, SIMPLE_DECK, [], {});
    const empty = advanceQuarter(s, SIMPLE_DECK, [], {}, []);
    expect(empty).toEqual(plain);
    expect(plain.scenes).toBeUndefined();
  });

  it("is deterministic: same seed and state, same scenes", () => {
    const s = running(4, { policies: [policy(0, "M"), policy(1, "N")], scheduled: [slice("q2.a0", "health", 5, 5, 6), slice("q2.a1", "crime", -5, 5, 6)] });
    expect(advanceQuarter(s, SIMPLE_DECK, [], {}, fixtureScenes)).toEqual(advanceQuarter(s, SIMPLE_DECK, [], {}, fixtureScenes));
  });

  it("loads and advances a state saved without policies and scenes", () => {
    const old: Partial<GameState> = { ...running(4) };
    delete old.policies;
    delete old.scenes;
    expect(() => GameState.parse(old)).not.toThrow();
    expect(() => advanceQuarter(old as GameState, SIMPLE_DECK, [], {}, fixtureScenes)).not.toThrow();
  });

  it("LEVEL_SCALE and SCENES are the sources of the thresholds", () => {
    expect(STEP1("health")).toBe(LEVEL_SCALE.value.index[0]);
    expect(SCENES.value.followupMinLevelShare).toBeGreaterThan(0);
  });
});

describe("a failed response does not hold the crisis back", () => {
  const strong = (over: Parameters<typeof action>[0] = {}) =>
    judgment({ actions: [action(over)], scores: { relevance: "5", feasibility: "5", specificity: "5", tradeoffs: "3", consistency: "5" } });

  it("blocked in parliament: CRISIS_RESPONSE.failedLeak of the prevented damage still happens", () => {
    const st = decisionState(SIMPLE_CARD.id, "blk-crisis");
    st.stats.parliament = 0;
    const r = resolveTurn(st, SIMPLE_DECK, { kind: "free", judgment: strong({ requires_legislation: true }) }, ctx);
    expect(r.report.measures[0]!.outcome).toBe("blocked");
    expect(r.report.eventShareApplied).toBe(CRISIS_RESPONSE.value.failedLeak);   // relevance 5 -> base share 0
  });

  it("share = relevance share + (1 - relevance share) x (1 - best multiplier capped at 1) x failedLeak, for every seed", () => {
    fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 8 }), (seed) => {
      const r = resolveTurn(decisionState(SIMPLE_CARD.id, seed), SIMPLE_DECK, { kind: "free", judgment: strong() }, ctx);
      const works = Math.max(...r.report.measures.map((m) => Math.min(Math.max(m.multiplier, 0), 1)));
      expect(r.report.eventShareApplied).toBeCloseTo((1 - works) * CRISIS_RESPONSE.value.failedLeak, 12);   // relevance 5 -> base 0
    }), { numRuns: 60 });
  });

  it("no measures (statement only): relevance alone decides, as before", () => {
    const j = judgment({ actions: [], scores: { relevance: "5", feasibility: "3", specificity: "3", tradeoffs: "3", consistency: "3" } });
    const r = resolveTurn(decisionState(SIMPLE_CARD.id, "none"), SIMPLE_DECK, { kind: "free", judgment: j }, ctx);
    expect(r.report.eventShareApplied).toBe(0);
  });
});

describe("crisis and upcoming scenes", () => {
  it("crisisStatus follows SCENES.crisisBands", () => {
    const b = SCENES.value.crisisBands;
    expect(crisisStatus(0)).toBe("resolved");
    expect(crisisStatus(b.resolvedMax)).toBe("resolved");
    expect(crisisStatus(b.resolvedMax + 0.01)).toBe("eased");
    expect(crisisStatus(b.easedMax)).toBe("eased");
    expect(crisisStatus(b.easedMax + 0.01)).toBe("ongoing");
    expect(crisisStatus(1)).toBe("ongoing");
  });

  it("a crisis card leads with how the crisis ended, with the card title as cause and goodness tone", () => {
    for (const [share, status, tone] of [[0, "resolved", "good"], [0.5, "eased", "neutral"], [1, "ongoing", "bad"]] as const) {
      const rep = { ...report({}), cardId: SIMPLE_CARD.id, eventShareApplied: share };
      const { scenes } = buildTurnScenes({ ...input(rep), state: decisionState(SIMPLE_CARD.id, "cr"), card: SIMPLE_CARD });
      expect(scenes[0]!.templateId).toBe(`scene.test.crisis.${status}`);
      expect(scenes[0]!.tone).toBe(tone);
      expect(scenes[0]!.cause).toBe(SIMPLE_CARD.titleTh);
      expect(scenes[0]!.textTh).toContain(SIMPLE_CARD.titleTh);
    }
  });

  it("no crisis scene for a card without damage, an opportunity card or a good-news card", () => {
    const rep = { ...report({}), cardId: SIMPLE_CARD.id, eventShareApplied: 0 };
    const cards = [
      QUIET_CARD,
      { ...SIMPLE_CARD, category: "opportunity" as const },
      { ...SIMPLE_CARD, onArrival: [{ target: "gdpGrowth" as const, delta: 0.3, over_quarters: 2 }] },
    ];
    for (const card of cards) {
      const { scenes } = buildTurnScenes({ ...input(rep), state: decisionState(SIMPLE_CARD.id, "nc"), card });
      expect(scenes.some((x) => x.templateId.startsWith("scene.test.crisis")), card.id).toBe(false);
    }
  });

  it("previews this decision's later effects, at most SCENES.maxUpcoming, with their start quarter, and does not record them", () => {
    let seen = 0;
    for (let i = 0; i < 20; i++) {
      const j = judgment({ actions: [action({ effects: [effect({ indicator: "health", level: "3", lasts_quarters: 4, start_after_quarters: 1 }), effect({ indicator: "education", level: "3", lasts_quarters: 4, start_after_quarters: 1 })] })] });
      const r = resolveTurn(decisionState(QUIET_CARD.id, `up-${i}`), SIMPLE_DECK, { kind: "free", judgment: j }, ctx);
      const { state, scenes } = buildTurnScenes({ state: r.state, report: r.report, card: QUIET_CARD, actions: j.actions, library: fixtureScenes });
      const later = scenes.filter((x) => x.kind === "upcoming");
      expect(later.length).toBeLessThanOrEqual(SCENES.value.maxUpcoming);
      for (const u of later) {
        expect(u.atQuarter).toBeGreaterThan(r.report.quarter);
        expect(u.cause).toBe(r.report.measures[0]!.title);
      }
      expect((state.scenes ?? []).some((x) => x.kind === "upcoming")).toBe(false);
      seen += later.length;
    }
    expect(seen).toBeGreaterThan(0);
  });
});
