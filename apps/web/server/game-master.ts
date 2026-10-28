// Game master interface used by the API, plus a deterministic MOCK implementation.
// Lane A builds the real AI game master; the Lead wires it in through getGameMaster().
import type {
  Action, Card, Choice, Evidence, GameState, GroupKey, Judgment, Scene, Target, TurnReport,
} from "@ps/shared";
import { OUTCOME_LABEL, targetLabel } from "../lib/labels";
import { createClient } from "@ps/ai-gm";
import { getContent } from "./content";
import { RealGameMaster } from "./real-game-master";

export interface NarrateInput {
  state: GameState; card: Card; report: TurnReport; answerTitle: string;
  /** Consequence scenes of this turn (engine-built); the narrator weaves them in. */
  scenes?: Pick<Scene, "textTh" | "cause">[];
}

export interface GameMaster {
  judge(input: { state: GameState; card: Card; playerText: string; evidence: Evidence[] }): Promise<Judgment>;
  narrate(input: NarrateInput): Promise<{ narration: string; headlines: string[] }>;
  historian(input: { state: GameState; grades: unknown; legacy: number }): Promise<{ archetype: string; line: string }>;
}

export const HISTORIAN_PREFIX = "ประวัติศาสตร์จะจดจำคุณว่า";
const MOCK_TAG = "[จำลอง]";

// ---------- mock judge ----------

interface Rule { re: RegExp; target: Target; direction: "up" | "down" }

/** Keyword -> stat the typed answer is assumed to push. Deliberately simple; the real judge replaces this. */
const RULES: Rule[] = [
  { re: /สุขภาพ|สาธารณสุข|โรงพยาบาล|หมอ|พยาบาล|วัคซีน|โรคระบาด/, target: "health", direction: "up" },
  { re: /การศึกษา|โรงเรียน|ครู|มหาวิทยาลัย|ทุนเรียน/, target: "education", direction: "up" },
  { re: /อาชญากรรม|ตำรวจ|ความปลอดภัย|ยาเสพติด/, target: "crime", direction: "down" },
  { re: /ทุจริต|คอร์รัปชัน|โกง|ตรวจสอบ|โปร่งใส/, target: "corruption", direction: "down" },
  { re: /เงินเฟ้อ|ราคา|ค่าครองชีพ|น้ำมัน/, target: "inflation", direction: "down" },
  { re: /ว่างงาน|จ้างงาน|หางาน|อาชีพ|ฝึกอบรม/, target: "unemployment", direction: "down" },
  { re: /ภาษี|งบประมาณ|รายได้รัฐ/, target: "budget", direction: "up" },
  { re: /เหลื่อมล้ำ|คนจน|ยากจน|เงินช่วยเหลือ|สวัสดิการ/, target: "inequality", direction: "down" },
  { re: /เกษตร|ชาวนา|ชาวสวน|ภัยแล้ง|น้ำท่วม/, target: "group:farmers", direction: "up" },
  { re: /สิ่งแวดล้อม|มลพิษ|ป่า|พลังงานสะอาด|โลกร้อน/, target: "environment", direction: "up" },
  { re: /ต่างประเทศ|ทูต|การค้า|ส่งออก|พันธมิตร|เจรจา/, target: "foreignRelations", direction: "up" },
  { re: /สื่อ|เสรีภาพ|สิทธิ/, target: "pressFreedom", direction: "up" },
  { re: /การลงทุน|ธุรกิจ|เศรษฐกิจ|เอสเอ็มอี/, target: "gdpGrowth", direction: "up" },
];
const FALLBACK: Rule = { re: /./, target: "stability", direction: "up" };

const SCORES_3 = { relevance: "3", feasibility: "3", specificity: "3", tradeoffs: "3", consistency: "3" } as const;
const NO_FLAGS = { impossible_claim: false, cruelty: false, rights_violation: false, unconstitutional: false };

function mockJudgment(action: Action, interpretation: string): Judgment {
  return {
    input_class: "normal",
    interpretation,
    actions: [action],
    overreach: false,
    scores: { ...SCORES_3 },
    event_coverage: "1",
    flags: { ...NO_FLAGS },
    follow_up_hooks: [],
  };
}

/** Mock judgment for a typed answer: one level-1 action, the stat picked by keyword. */
export function mockFreeJudgment(text: string): Judgment {
  const rule = RULES.find((r) => r.re.test(text)) ?? FALLBACK;
  const title = text.trim().replace(/\s+/g, " ").slice(0, 40);
  const action: Action = {
    title,
    cost_size: "S",
    recurring_cost_size: "none",
    duration_quarters: 4,
    requires_legislation: false,
    legal_risk: "none",
    effects: [{
      indicator: rule.target, direction: rule.direction, level: "1",
      start_after_quarters: 0, lasts_quarters: 4,
      note: `${MOCK_TAG} เดาจากคำสำคัญในข้อความ`, evidence_ids: [],
    }],
    group_impacts: [],
    side_effects: [],
  };
  return mockJudgment(action, `[MOCK] ตีความจากคำสำคัญ: ${targetLabel(rule.target)} (ไม่ใช่ผู้ตัดสินจริง)`);
}

/**
 * Mock judgment for a preset choice that has no pre-judged result. Used only under DEV_FIXTURES=1.
 * Each evidence item the choice cites becomes a level-2 effect that cites it, so the evidence rule is exercised:
 * when the study's direction does not match, the engine cuts the effect to level 1.
 */
export function mockPresetJudgment(choice: Choice, evidence: Evidence[]): Judgment {
  const cited = choice.evidenceIds
    .map((id) => evidence.find((e) => e.id === id))
    .filter((e): e is Evidence => e !== undefined)
    .slice(0, 2);
  const effects: Action["effects"] = cited.map((e) => ({
    indicator: e.indicator,
    direction: e.direction === "down" ? "down" : "up",
    level: "2",
    start_after_quarters: 0,
    lasts_quarters: 4,
    note: `${MOCK_TAG} อ้างหลักฐาน ${e.id}`,
    evidence_ids: [e.id],
  }));
  if (effects.length === 0) {
    effects.push({
      indicator: "stability", direction: "up", level: "1", start_after_quarters: 0, lasts_quarters: 4,
      note: `${MOCK_TAG} ไม่มีหลักฐานอ้างอิง จึงใช้ระดับ 1`, evidence_ids: [],
    });
  }
  const [first, second] = choice.affectedGroups;
  const impacts: Action["group_impacts"] = [];
  if (first) impacts.push({ group: first as GroupKey, direction: "up", level: "1", reason: `${MOCK_TAG} ผู้ได้ประโยชน์` });
  if (second) impacts.push({ group: second as GroupKey, direction: "down", level: "1", reason: `${MOCK_TAG} ผู้แบกต้นทุน` });
  const big = choice.costHint === "L" || choice.costHint === "XL";
  const action: Action = {
    title: choice.titleTh,
    cost_size: choice.costHint,
    recurring_cost_size: "none",
    duration_quarters: 4,
    requires_legislation: big,
    legal_risk: "none",
    effects,
    group_impacts: impacts,
    side_effects: [],
  };
  return mockJudgment(action, `[MOCK] ผลตัดสินจำลองของตัวเลือก ${choice.id} (โหมด DEV_FIXTURES)`);
}

// ---------- mock narration and historian ----------

const OUTCOME_SENTENCE: Record<string, string> = {
  blocked: "สภาไม่ผ่านมาตรการนี้ จึงยังไม่มีอะไรเกิดขึ้นจริง",
  critical_failure: "การดำเนินงานล้มเหลวอย่างหนักและส่งผลเสียตามมา",
  great_success: "การดำเนินงานได้ผลดีเกินคาด",
  success: "การดำเนินงานเป็นไปตามแผน",
  partial: "การดำเนินงานได้ผลเพียงบางส่วน",
  failure: "การดำเนินงานไม่ได้ผลตามที่ตั้งใจ",
};

function archetypeFor(legacy: number): string {
  if (legacy >= 70) return "ผู้นำที่ทิ้งบ้านเมืองให้ดีกว่าเดิม";
  if (legacy >= 55) return "ผู้นำที่ประคองบ้านเมืองผ่านวาระได้";
  if (legacy >= 40) return "ผู้นำที่ทำได้ทั้งดีและพลาด";
  return "ผู้นำที่ทิ้งงานหนักไว้ให้คนรุ่นหลัง";
}

export class MockGameMaster implements GameMaster {
  /** Synchronous core of judge(), handy for tests. */
  judgeSync(playerText: string): Judgment {
    return mockFreeJudgment(playerText);
  }

  async judge(input: { state: GameState; card: Card; playerText: string; evidence: Evidence[] }): Promise<Judgment> {
    return mockFreeJudgment(input.playerText);
  }

  async narrate(input: NarrateInput): Promise<{ narration: string; headlines: string[] }> {
    const { card, report, answerTitle, scenes = [] } = input;
    const lines = report.measures.map(
      (m) => `มาตรการ “${m.title}”: ${OUTCOME_LABEL[m.outcome]} — ${OUTCOME_SENTENCE[m.outcome] ?? ""}`,
    );
    const share = Math.round(report.eventShareApplied * 100);
    const narration = [
      `${MOCK_TAG} ไตรมาสที่ ${report.quarter}: เมื่อเกิดเหตุการณ์ “${card.titleTh}” คุณเลือก “${answerTitle}”`,
      lines.length > 0 ? lines.join(" ") : "คำตอบนี้ไม่ได้นำไปสู่มาตรการที่ดำเนินการได้",
      `ผลของเหตุการณ์ที่ยังเกิดขึ้นแม้รัฐบาลตอบสนองแล้วอยู่ที่ราว ${share}% ของที่คาดไว้`,
      ...(scenes.length > 0 ? [scenes.map((s) => s.textTh).join(" ")] : []),
    ].join("\n");
    const headlines = report.measures.length > 0
      ? report.measures.map((m) => `${MOCK_TAG} ${m.title}: ${OUTCOME_LABEL[m.outcome]}`)
      : [`${MOCK_TAG} รัฐบาลตอบสนองต่อ “${card.titleTh}”`];
    return { narration, headlines };
  }

  async historian(input: { state: GameState; grades: unknown; legacy: number }): Promise<{ archetype: string; line: string }> {
    const archetype = archetypeFor(input.legacy);
    return {
      archetype,
      line: `${HISTORIAN_PREFIX}${archetype} ${MOCK_TAG} คะแนนมรดก ${input.legacy.toFixed(0)} จาก 100`,
    };
  }
}

/**
 * Real game master when GAME_ANTHROPIC_API_KEY is set, unless GAME_MASTER=mock forces the mock.
 * Without a key the app runs on the mock (every mock output is tagged).
 */
export function getGameMaster(env: Record<string, string | undefined> = process.env): GameMaster {
  if (env.GAME_MASTER === "mock" || !env.GAME_ANTHROPIC_API_KEY) return new MockGameMaster();
  return realGameMaster(env);
}

function realGameMaster(env: Record<string, string | undefined>): GameMaster {
  const client = createClient(env);
  return new RealGameMaster(client, (iso3) => getContent().countries.find((c) => c.iso3 === iso3));
}
