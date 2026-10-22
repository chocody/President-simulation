import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { Judgment, type Card, type GameState } from "@ps/shared";
import { advanceQuarter, grades, legacyScore, newGame, resolveTurn } from "@ps/engine";
import { MockGameMaster, getGameMaster, mockPresetJudgment, HISTORIAN_PREFIX } from "../server/game-master";
import { loadContent } from "../server/content";
import { FIXTURE_COUNTRY } from "../dev/fixture-country";

const content = loadContent({ dataDir: resolve(import.meta.dirname, "../../../data"), devFixtures: true });
const card: Card = content.cards[0]!;

function decisionState(): GameState {
  let s = newGame({ country: FIXTURE_COUNTRY, difficulty: "normal", seed: "gm-test" });
  while (s.phase === "running") s = advanceQuarter(s, content.cards);
  return s;
}

describe("MockGameMaster", () => {
  const gm = new MockGameMaster();
  const state = newGame({ country: FIXTURE_COUNTRY, difficulty: "normal", seed: "x" });

  it("is what getGameMaster returns", () => {
    expect(getGameMaster()).toBeInstanceOf(MockGameMaster);
  });

  it("judge returns one valid level-1 action built from the text, labelled mock", async () => {
    const j = await gm.judge({ state, card, evidence: [], playerText: "สร้างโรงพยาบาลชุมชนเพิ่มในจังหวัดห่างไกลทุกแห่ง" });
    expect(Judgment.safeParse(j).success).toBe(true);
    expect(j.input_class).toBe("normal");
    expect(j.interpretation).toContain("MOCK");
    expect(j.actions).toHaveLength(1);
    const a = j.actions[0]!;
    expect(a.effects).toHaveLength(1);
    expect(a.effects[0]!.level).toBe("1");
    expect(a.effects[0]!.indicator).toBe("health");
    expect(a.effects[0]!.evidence_ids).toEqual([]);
  });

  it("judge is deterministic and has a fallback target", async () => {
    const text = "ขอให้ทุกคนมีความสุขและร่วมมือกันสร้างชาติต่อไป";
    const a = await gm.judge({ state, card, evidence: [], playerText: text });
    const b = await gm.judge({ state, card, evidence: [], playerText: text });
    expect(a).toEqual(b);
    expect(a.actions[0]!.effects[0]!.indicator).toBe("stability");
  });

  it("narrate builds a template from the report", async () => {
    const s = decisionState();
    const c = content.cards.find((x) => x.id === s.pendingCardId)!;
    const j = mockPresetJudgment(c.choices[0]!, content.evidence);
    const { state: next, report } = resolveTurn(s, content.cards, { kind: "preset", judgment: j },
      { evidence: content.evidence });
    expect(next.phase).toBe("running");
    const n = await gm.narrate({ state: next, card: c, report, answerTitle: c.choices[0]!.titleTh });
    expect(n.narration).toContain(c.titleTh);
    expect(n.narration).toContain(c.choices[0]!.titleTh);
    expect(n.narration).toContain("จำลอง");
    expect(n.headlines.length).toBeGreaterThan(0);
    expect(n.headlines.every((h) => typeof h === "string" && h.length > 0)).toBe(true);
  });

  it("historian line starts with the required phrase", async () => {
    const s = decisionState();
    const h = await gm.historian({ state: s, grades: grades(s), legacy: legacyScore(s) });
    expect(HISTORIAN_PREFIX).toBe("ประวัติศาสตร์จะจดจำคุณว่า");
    expect(h.line.startsWith("ประวัติศาสตร์จะจดจำคุณว่า")).toBe(true);
    expect(h.archetype.length).toBeGreaterThan(0);
  });
});

describe("mockPresetJudgment", () => {
  it("is valid for every choice of every card and cites only the choice's evidence", () => {
    for (const c of content.cards) {
      for (const ch of c.choices) {
        const j = mockPresetJudgment(ch, content.evidence);
        expect(Judgment.safeParse(j).success).toBe(true);
        expect(j.actions).toHaveLength(1);
        expect(j.actions[0]!.title).toBe(ch.titleTh);
        for (const e of j.actions[0]!.effects) {
          for (const id of e.evidence_ids) expect(ch.evidenceIds).toContain(id);
        }
      }
    }
  });
});
