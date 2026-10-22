import { describe, it, expect } from "vitest";
import { join } from "node:path";
import type { Judgment } from "@ps/shared";
import { checkCase, loadSmokeCases, type SmokeCase } from "../src/smoke";
import { loadCards, loadEvidence } from "../src/content";
import { PLAYER_TEXT_MAX, PLAYER_TEXT_MIN } from "../src/config";
import { toJudgment } from "../src/schemas";
import { wireJudgment } from "./helpers";

const file = join(import.meta.dirname, "../../../evals/smoke/cases.json");
const cases = loadSmokeCases(file);
const cards = loadCards();
const evidence = loadEvidence();

describe("smoke cases", () => {
  it("has 20 cases with the required mix", () => {
    expect(cases).toHaveLength(20);
    const n = (k: string) => cases.filter((c) => c.category === k).length;
    expect(n("good")).toBe(8);
    expect(n("vague")).toBe(4);
    expect(n("impossible")).toBe(3);
    expect(n("injection")).toBe(3);
    expect(n("cruel")).toBe(2);
  });

  it("ids are unique, texts pass the length guard, cards exist", () => {
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    for (const c of cases) {
      expect(c.playerText.length).toBeGreaterThanOrEqual(PLAYER_TEXT_MIN);
      expect(c.playerText.length).toBeLessThanOrEqual(PLAYER_TEXT_MAX);
      expect(cards.some((k) => k.id === c.cardId)).toBe(true);
    }
  });

  it("good answers come from 8 different ideologies; injections use both languages", () => {
    const good = cases.filter((c) => c.category === "good");
    expect(new Set(good.map((c) => c.ideology)).size).toBe(8);
    const inj = cases.filter((c) => c.category === "injection").map((c) => c.playerText);
    expect(inj.some((t) => /[฀-๿]/.test(t))).toBe(true);
    expect(inj.some((t) => /ignore|system|instruction/i.test(t))).toBe(true);
  });

  it("every injection expects input_class meta", () => {
    for (const c of cases.filter((k) => k.category === "injection")) {
      expect(c.expect.input_class).toEqual(["meta"]);
    }
  });

  it("every case forbids level 3 without evidence", () => {
    for (const c of cases) expect(c.expect.noLevel3WithoutEvidence).toBe(true);
  });
});

describe("checkCase", () => {
  const base: SmokeCase = {
    id: "t", category: "good", cardId: "economy.oil.spike", playerText: "x".repeat(30),
    expect: {
      input_class: ["normal"], scores: { specificity: [3, 5] }, flags: { impossible_claim: false },
      noLevel3WithoutEvidence: true,
    },
  };
  const ev = evidence.find((e) => e.indicator === "gdpGrowth" && e.direction === "up")!;
  const j = (over: Record<string, unknown> = {}): Judgment => toJudgment(wireJudgment(over));

  it("passes a matching judgment", () => {
    expect(checkCase(base, j(), evidence)).toEqual([]);
  });

  it("fails on wrong input_class, score out of range and missing flag", () => {
    const fails = checkCase(
      { ...base, expect: { ...base.expect, flags: { cruelty: true } } },
      j({ input_class: "meta", scores: { relevance: "3", feasibility: "3", specificity: "1", tradeoffs: "3", consistency: "3" } }),
      evidence,
    );
    expect(fails.join("\n")).toMatch(/input_class/);
    expect(fails.join("\n")).toMatch(/specificity/);
    expect(fails.join("\n")).toMatch(/cruelty/);
  });

  it("fails a level 3 effect without evidence ids", () => {
    const w = wireJudgment();
    w.actions[0].effects[0] = { ...w.actions[0].effects[0], indicator: "gdpGrowth", level: "3", evidence_ids: [] };
    expect(checkCase(base, toJudgment(w), evidence).join("\n")).toMatch(/level 3/);
  });

  it("fails a level 3 effect citing an id that is not provided or does not match", () => {
    const w = wireJudgment();
    w.actions[0].effects[0] = { ...w.actions[0].effects[0], indicator: "gdpGrowth", level: "3", evidence_ids: ["ev.invented.999"] };
    expect(checkCase(base, toJudgment(w), evidence).join("\n")).toMatch(/level 3/);
  });

  it("passes a level 3 effect with matching provided evidence", () => {
    const w = wireJudgment();
    w.actions[0].effects[0] = { ...w.actions[0].effects[0], indicator: ev.indicator, direction: ev.direction, level: "3", evidence_ids: [ev.id] };
    expect(checkCase(base, toJudgment(w), evidence)).toEqual([]);
  });
});
