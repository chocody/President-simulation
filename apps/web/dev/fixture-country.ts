// DEV FIXTURE — invented values. Not a real country, not real statistics.
// Used only when the server runs with DEV_FIXTURES=1 (see server/content.ts), so the game can be played
// end to end before data/countries/ holds real, sourced countries. Never ship these numbers as data.
import type { CountryData, MinorEvent, Provenance, Source } from "@ps/shared";

export const FIXTURE_LABEL = "DEV FIXTURE — invented values";
export const FIXTURE_BANNER_TH = "ข้อมูลทดสอบ ไม่ใช่ข้อมูลจริง";
export const FIXTURE_SOURCE_ID = "dev.fixture";

/** Registry entry for the fixture's provenance, added to the sources list only under DEV_FIXTURES=1. */
export const FIXTURE_SOURCE: Source = {
  id: FIXTURE_SOURCE_ID,
  kind: "design",
  title: FIXTURE_LABEL,
  publisher: "President Sim dev fixture",
  indicatorCode: null,
  url: "https://example.com/dev-fixture",
  license: "design",
  commercialOk: false,
  coverage: null,
  retrievedAt: null,
  verifiedBy: null,
  note: "Invented for development. Not a real country; never shipped.",
};

const fx: Provenance = { sourceId: FIXTURE_SOURCE_ID, year: null, raw: null };

export const FIXTURE_COUNTRY: CountryData = {
  iso3: "XFX", // inside the ISO 3166 user-assigned range (XAA-XZZ): cannot clash with a real country
  nameTh: "แดนสมมุติฟิกโตเรีย (ข้อมูลทดสอบ)",
  nameEn: "Fictoria (DEV FIXTURE)",
  region: FIXTURE_LABEL,
  population: 12_000_000,
  baseline: {
    gdpGrowth: 2.5, inflation: 4, unemployment: 6, budget: 1, debt: 65,
    health: 55, education: 52, crime: 45, inequality: 40,
    corruption: 50, pressFreedom: 55, stability: 55, parliament: 55,
    environment: 48, foreignRelations: 50,
  },
  baselineSrc: {
    gdpGrowth: fx, inflation: fx, unemployment: fx, budget: fx, debt: fx,
    health: fx, education: fx, crime: fx, inequality: fx,
    corruption: fx, pressFreedom: fx, stability: fx, parliament: fx,
    environment: fx, foreignRelations: fx,
  },
  groupShares: { farmers: 0.2, urban: 0.35, business: 0.15, youth: 0.2, military: 0.1 },
  groupSharesSrc: { farmers: fx, urban: fx, business: fx, youth: fx, military: fx },
  // Invented traits. `resources` is left out on purpose so the "no data" row of the traits panel is exercised.
  traits: { tourism: 70, agriculture: 35, openness: 60, ruleOfLaw: 35, govEffectiveness: 45, patronage: 65 },
  traitsSrc: { tourism: fx, agriculture: fx, openness: fx, ruleOfLaw: fx, govEffectiveness: fx, patronage: fx },
};

const fxEvent = (id: string, textTh: string, category: MinorEvent["category"], effects: MinorEvent["effects"], more: Partial<MinorEvent> = {}): MinorEvent => ({
  id: `dev.news.${id}`, category, textTh: `${FIXTURE_LABEL}: ${textTh}`, effects, conditions: [], baseWeight: 1,
  sourceIds: [FIXTURE_SOURCE_ID], ...more,
});

/**
 * Invented minor events (the news ticker) used only under DEV_FIXTURES=1 when data/events/minor.yaml is absent,
 * so the ticker can be exercised end to end. Not real news, not real effects.
 */
export const FIXTURE_MINOR_EVENTS: MinorEvent[] = [
  fxEvent("festival", "เทศกาลท้องถิ่นดึงนักท่องเที่ยวมากกว่าปกติ", "culture", [{ target: "group:urban", delta: 2, over_quarters: 1 }], { traitWeights: { tourism: 1 } }),
  fxEvent("factory", "โรงงานแห่งใหม่เปิดรับสมัครงาน", "economy", [{ target: "unemployment", delta: -0.2, over_quarters: 2 }]),
  fxEvent("harvest", "ผลผลิตในบางเขตออกมาดีกว่าที่คาด", "economy", [{ target: "group:farmers", delta: 2, over_quarters: 1 }], { traitWeights: { agriculture: 1 } }),
  fxEvent("clinic", "คลินิกชุมชนเพิ่มเวลาให้บริการ", "health", [{ target: "health", delta: 1, over_quarters: 1 }], { traitWeights: { govEffectiveness: 1 } }),
  fxEvent("contract", "สัญญาจัดซื้อรายหนึ่งตกเป็นข้อสงสัยเรื่องการเอื้อพวกพ้อง", "politics", [{ target: "corruption", delta: 2, over_quarters: 1 }], { traitWeights: { patronage: 1 } }),
  fxEvent("storm", "พายุฝนทำให้ถนนบางสายใช้การไม่ได้ชั่วคราว", "disaster", [{ target: "stability", delta: -1, over_quarters: 1 }]),
  fxEvent("orders", "ผู้ซื้อต่างชาติเพิ่มคำสั่งซื้อสินค้าส่งออก", "foreign", [{ target: "gdpGrowth", delta: 0.2, over_quarters: 2 }], { traitWeights: { openness: 1 } }),
  fxEvent("protest", "กลุ่มคนรุ่นใหม่รวมตัวเรียกร้องค่าเรียนที่ถูกลง", "society", [{ target: "group:youth", delta: -2, over_quarters: 1 }]),
];
