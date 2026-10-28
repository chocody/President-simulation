import { describe, it, expect } from "vitest";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DecideResponse, GameState, SCENES, SceneTemplate, type Scene, type SceneRecord, type TurnReport } from "@ps/shared";
import { ContentError, loadContent, type Content } from "../server/content";
import { MockGameMaster, type GameMaster } from "../server/game-master";
import { handleAdvance, handleDecide, handleNew, type Deps } from "../server/handlers";
import { followupScenes, sceneBadge, termPath } from "../lib/scenes";

const REAL = resolve(import.meta.dirname, "../../../data");
const content: Content = loadContent({ dataDir: REAL, devFixtures: true });
type Body = Record<string, any>;
const deps = (over: Partial<Deps> = {}): Deps => ({ content, gm: new MockGameMaster(), seed: () => "scenes-seed", random: () => 0.5, ...over });

function tmpData(scenesYaml: string | null): string {
  const d = mkdtempSync(join(tmpdir(), "ps-web-scenes-"));
  cpSync(REAL, d, { recursive: true });
  rmSync(join(d, "scenes"), { recursive: true, force: true });
  if (scenesYaml !== null) {
    mkdirSync(join(d, "scenes"), { recursive: true });
    writeFileSync(join(d, "scenes", "scenes.yaml"), scenesYaml);
  }
  return d;
}
const tpl = (over: Record<string, unknown> = {}) => ({
  id: "scene.test.a", trigger: { kind: "court" }, textTh: "TEST FIXTURE {measure}", sourceIds: ["design.scenes"], ...over,
});
const asYaml = (x: unknown[]) => JSON.stringify(x);

describe("scene library in loadContent", () => {
  it("loads data/scenes/scenes.yaml: every template is valid, ids are unique, sources exist", () => {
    expect(content.scenes.length).toBeGreaterThanOrEqual(141);
    const ids = content.scenes.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const sources = new Set(content.sources.map((s) => s.id));
    for (const s of content.scenes) {
      expect(() => SceneTemplate.parse(s)).not.toThrow();
      for (const id of s.sourceIds) expect(sources.has(id)).toBe(true);
    }
  });

  it("uses {measure} only in outcome, protest and court templates, and has a plain fallback for every key delta trigger", () => {
    for (const s of content.scenes) {
      if (s.textTh.includes("{measure}")) expect(["outcome", "protest", "court"]).toContain(s.trigger.kind);
    }
    expect(content.scenes.some((s) => s.trigger.kind === "court")).toBe(true);
    for (const outcome of ["blocked", "critical_failure", "great_success", "partial", "failure"]) {
      expect(content.scenes.some((s) => s.trigger.kind === "outcome" && s.trigger.outcome === outcome)).toBe(true);
    }
  });

  it("is an empty library when the folder is missing", () => {
    expect(loadContent({ dataDir: tmpData(null), devFixtures: false }).scenes).toEqual([]);
  });

  it("rejects duplicates, unknown source ids and schema errors, naming the file", () => {
    expect(() => loadContent({ dataDir: tmpData(asYaml([tpl(), tpl()])), devFixtures: false })).toThrow(/duplicate scene/);
    expect(() => loadContent({ dataDir: tmpData(asYaml([tpl({ sourceIds: ["no.such.source"] })])), devFixtures: false })).toThrow(/unknown source id/);
    expect(() => loadContent({ dataDir: tmpData(asYaml([tpl({ id: "Bad Id" })])), devFixtures: false })).toThrow(ContentError);
    expect(() => loadContent({ dataDir: tmpData(JSON.stringify({ not: "a list" })), devFixtures: false })).toThrow(/expected a list/);
  });
});

async function toDecision(d: Deps, seed = "scenes-seed") {
  const s = (await handleNew({ difficulty: "normal" }, { ...d, seed: () => seed })).body as Body;
  const a = (await handleAdvance({ state: s.state }, d)).body as Body;
  expect(a.state.phase).toBe("decision");
  return a;
}

describe("handleDecide scenes", () => {
  it("returns 1..maxPerTurn scenes, also stored in state.scenes, and the response still validates", async () => {
    const d = deps();
    let total = 0;
    for (let i = 0; i < 8; i++) {
      const a = await toDecision(d, `scn-${i}`);
      const r = await handleDecide({ state: a.state, answer: { kind: "preset", choiceId: "a" } }, d);
      expect(r.status).toBe(200);
      const b = r.body as Body;
      expect(() => DecideResponse.parse(b)).not.toThrow();
      expect(b.scenes.length).toBeLessThanOrEqual(SCENES.value.maxPerTurn);
      expect(b.scenes.length).toBeGreaterThan(0);
      total += b.scenes.length;
      const rec = (b.state as GameState).scenes!;
      expect(rec.slice(-b.scenes.length).map(({ quarter, ...x }: SceneRecord) => x)).toEqual(b.scenes);
      expect(rec.every((x) => x.quarter === b.report.quarter)).toBe(true);
      for (const s of b.scenes as Scene[]) expect(s.textTh).not.toContain("{measure}");
    }
    expect(total).toBeGreaterThan(0);
  });

  it("with an empty library there are no scenes and the state is the engine's own", async () => {
    const empty = deps({ content: { ...content, scenes: [] } });
    const a = await toDecision(empty);
    const withLib = await handleDecide({ state: a.state, answer: { kind: "preset", choiceId: "a" } }, deps());
    const without = await handleDecide({ state: a.state, answer: { kind: "preset", choiceId: "a" } }, empty);
    const b = without.body as Body;
    expect(b.scenes).toEqual([]);
    expect(b.state.scenes).toBeUndefined();
    expect(b.report).toEqual((withLib.body as Body).report);
  });

  it("gives the narrator the scenes (text and cause) and the narration shows them", async () => {
    let seen: Body | null = null;
    const gm: GameMaster = {
      judge: (i) => new MockGameMaster().judge(i),
      narrate: (i) => { seen = i as Body; return new MockGameMaster().narrate(i); },
      historian: (i) => new MockGameMaster().historian(i),
    };
    const d = deps({ gm });
    const a = await toDecision(d);
    const b = (await handleDecide({ state: a.state, answer: { kind: "preset", choiceId: "a" } }, d)).body as Body;
    expect(seen!.scenes).toEqual(b.scenes);
    for (const s of b.scenes as Scene[]) expect(b.narration).toContain(s.textTh);
  });
});

describe("mock narrator", () => {
  it("puts every scene text into the narration, and is unchanged without scenes", async () => {
    const gm = new MockGameMaster();
    const a = await toDecision(deps());
    const card = content.cards.find((c) => c.id === a.state.pendingCardId)!;
    const report = { quarter: 2, cardId: card.id, answerKind: "preset", eventShareApplied: 0.5, measures: [], immediate: {}, scheduledCount: 0, notes: [] } as TurnReport;
    const base = await gm.narrate({ state: a.state, card, report, answerTitle: "x" });
    const same = await gm.narrate({ state: a.state, card, report, answerTitle: "x", scenes: [] });
    expect(same).toEqual(base);
    const scenes = [{ textTh: "โรงงานเพิ่มกะกลางคืน", cause: "มาตรการ ก" }, { textTh: "ชาวนาปิดถนน", cause: null }] as Scene[];
    const withScenes = await gm.narrate({ state: a.state, card, report, answerTitle: "x", scenes });
    expect(withScenes.narration).toContain("โรงงานเพิ่มกะกลางคืน");
    expect(withScenes.narration).toContain("ชาวนาปิดถนน");
  });
});

describe("follow-up scenes while time moves on", () => {
  it("handleAdvance returns only the new follow-up and court scenes, and over whole games some appear", async () => {
    let followups = 0;
    for (let g = 0; g < 6; g++) {
      const d = deps();
      const s0 = (await handleNew({ difficulty: "normal" }, { ...d, seed: () => `ful-${g}` })).body as Body;
      let state = s0.state as GameState;
      for (let guard = 0; guard < 40 && state.phase !== "ended"; guard++) {
        if (state.phase === "decision") {
          state = ((await handleDecide({ state, answer: { kind: "preset", choiceId: "a" } }, d)).body as Body).state;
        } else {
          const before = state.scenes?.length ?? 0;
          const r = (await handleAdvance({ state, answer: undefined }, d)).body as Body;
          const added = (r.state.scenes ?? []).slice(before);
          expect(r.scenes).toEqual(added);
          for (const x of r.scenes as SceneRecord[]) expect(x.kind).not.toBe("turn");
          followups += r.scenes.length;
          state = r.state;
        }
      }
    }
    expect(followups).toBeGreaterThan(0);
  });
});

const rec = (kind: Scene["kind"], quarter: number, templateId = "t", cause: string | null = null): SceneRecord =>
  ({ templateId, textTh: `${kind}@${quarter}`, tone: "good", cause, targets: [], kind, quarter });

describe("sceneBadge", () => {
  const report = { measures: [{ title: "ตรึงราคา" }] } as any;
  it("names a measure or an event for turn scenes, and marks follow-ups", () => {
    expect(sceneBadge({ kind: "turn", cause: "ตรึงราคา" }, report)).toEqual({ kind: "measure", label: "จากมาตรการ ตรึงราคา" });
    expect(sceneBadge({ kind: "turn", cause: "น้ำท่วม" }, report)).toEqual({ kind: "event", label: "จากเหตุการณ์ น้ำท่วม" });
    expect(sceneBadge({ kind: "turn", cause: null }, report)).toBeNull();
    // later (ending): the enacted policies tell a measure from an event card
    expect(sceneBadge({ kind: "turn", cause: "ตรึงราคา" }, { policies: [{ id: "q2.a0", title: "ตรึงราคา", quarter: 2 }] })?.kind).toBe("measure");
    expect(sceneBadge({ kind: "turn", cause: "น้ำท่วม" }, { policies: [] })?.kind).toBe("event");
    expect(sceneBadge({ kind: "followup", cause: "ตรึงราคา" })).toEqual({ kind: "followup", label: "ผลต่อเนื่อง · ตรึงราคา" });
    expect(sceneBadge({ kind: "court", cause: "ตรึงราคา" })?.label).toContain("ผลต่อเนื่อง");
  });
});

describe("followupScenes and termPath", () => {
  it("followupScenes: only follow-up and court, newest first; old saves have none", () => {
    const state = { scenes: [rec("turn", 2), rec("followup", 5), rec("court", 6), rec("turn", 7)] };
    expect(followupScenes(state).map((s) => s.textTh)).toEqual(["court@6", "followup@5"]);
    expect(followupScenes({})).toEqual([]);
  });
  it("termPath: all scenes in order when there are few, at most 10 otherwise, leads of each decision kept", () => {
    expect(termPath({})).toEqual([]);
    const few = { scenes: [rec("turn", 2), rec("turn", 2), rec("followup", 5)] };
    expect(termPath(few)).toEqual(few.scenes);
    const many: SceneRecord[] = [];
    for (const q of [2, 4, 7, 9, 12, 14]) for (let i = 0; i < 4; i++) many.push({ ...rec("turn", q), textTh: `turn${q}.${i}` });
    many.push(rec("followup", 8), rec("court", 10));
    const path = termPath({ scenes: many });
    expect(path).toHaveLength(10);
    const order = path.map((s) => many.indexOf(s));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const q of [2, 4, 7, 9, 12, 14]) expect(path.some((s) => s.textTh === `turn${q}.0`)).toBe(true);
    expect(path.filter((s) => s.kind !== "turn")).toHaveLength(2);
  });
});
