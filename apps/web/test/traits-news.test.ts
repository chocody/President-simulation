import { describe, it, expect } from "vitest";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { TRAIT_KEYS, type CountryData, type GameState, type Source } from "@ps/shared";
import { formatFrictionNote, parseFrictionNote } from "@ps/engine";
import { ContentError, loadContent, type Content } from "../server/content";
import { MockGameMaster } from "../server/game-master";
import { handleAdvance, handleDecide, handleNew, type Deps } from "../server/handlers";
import { FIXTURE_COUNTRY, FIXTURE_MINOR_EVENTS, FIXTURE_SOURCE, FIXTURE_SOURCE_ID } from "../dev/fixture-country";
import { describeTraitSource, PATRONAGE_PROXY_NOTE } from "../lib/trait-source";
import { frictionLines } from "../lib/friction";
import { newsChip, newsFromState } from "../lib/news";
import type { GameInfo, PublicMinorEvent } from "../lib/api-types";

const REAL = resolve(import.meta.dirname, "../../../data");
const content: Content = { ...loadContent({ dataDir: REAL, devFixtures: true }), minorEvents: FIXTURE_MINOR_EVENTS };   // fixture news, so tests do not depend on the real deck
const noFixtures: Content = loadContent({ dataDir: REAL, devFixtures: false });

type Body = Record<string, any>;
const deps = (over: Partial<Deps> = {}): Deps => ({ content, gm: new MockGameMaster(), seed: () => "traits-news-seed", random: () => 0.5, ...over });

/** A temp copy of data/ with no countries and a chosen minor.yaml (TEST FIXTURE content only). */
function tmpData(minorYaml: string | null): string {
  const d = mkdtempSync(join(tmpdir(), "ps-web-news-"));
  cpSync(REAL, d, { recursive: true });
  rmSync(join(d, "countries"), { recursive: true, force: true });
  rmSync(join(d, "events"), { recursive: true, force: true });
  if (minorYaml !== null) {
    mkdirSync(join(d, "events"), { recursive: true });
    writeFileSync(join(d, "events", "minor.yaml"), minorYaml);
  }
  return d;
}

const testEvent = (over: Record<string, unknown> = {}) => ({
  id: "news.test.a", category: "economy", textTh: "TEST FIXTURE ข่าวทดสอบ",
  effects: [{ target: "stability", delta: 1, over_quarters: 1 }], conditions: [], baseWeight: 1,
  sourceIds: ["design.minor-events"], ...over,
});
const asYaml = (events: unknown[]) => JSON.stringify(events);   // JSON is valid YAML

describe("minor events in loadContent", () => {
  it("loads data/events/minor.yaml when present and validates each item", () => {
    const d = tmpData(asYaml([testEvent(), testEvent({ id: "news.test.b" })]));
    const c = loadContent({ dataDir: d, devFixtures: false });
    expect(c.minorEvents.map((e) => e.id)).toEqual(["news.test.a", "news.test.b"]);
  });
  it("is empty when the file is absent and fixtures are off; dev fixtures bring invented ones", () => {
    expect(loadContent({ dataDir: tmpData(null), devFixtures: false }).minorEvents).toEqual([]);
    const dev = loadContent({ dataDir: tmpData(null), devFixtures: true });
    expect(dev.minorEvents).toEqual(FIXTURE_MINOR_EVENTS);
    expect(dev.minorEvents.every((e) => e.textTh.includes("DEV FIXTURE"))).toBe(true);
  });
  it("a real minor.yaml wins over the dev fixtures", () => {
    const c = loadContent({ dataDir: tmpData(asYaml([testEvent()])), devFixtures: true });
    expect(c.minorEvents.map((e) => e.id)).toEqual(["news.test.a"]);
  });
  it("rejects duplicates, unknown source ids and schema errors", () => {
    expect(() => loadContent({ dataDir: tmpData(asYaml([testEvent(), testEvent()])), devFixtures: false })).toThrow(/duplicate minor event/);
    expect(() => loadContent({ dataDir: tmpData(asYaml([testEvent({ sourceIds: ["no.such.source"] })])), devFixtures: false })).toThrow(/no\.such\.source/);
    expect(() => loadContent({ dataDir: tmpData(asYaml([testEvent({ effects: [] })])), devFixtures: false })).toThrow(ContentError);
    expect(() => loadContent({ dataDir: tmpData("{}"), devFixtures: false })).toThrow(ContentError);
  });
  it("a country whose traitsSrc cites an unknown source is rejected", () => {
    const d = tmpData(null);
    mkdirSync(join(d, "countries"), { recursive: true });
    const bad: CountryData = { ...FIXTURE_COUNTRY, iso3: "TST", traitsSrc: { tourism: { sourceId: "nope.nothing", year: 2020, raw: 1 } },
      baselineSrc: Object.fromEntries(Object.keys(FIXTURE_COUNTRY.baselineSrc).map((k) => [k, { sourceId: "wdi.NY.GDP.MKTP.KD.ZG", year: 2020, raw: 1 }])) as CountryData["baselineSrc"],
      groupSharesSrc: Object.fromEntries(Object.keys(FIXTURE_COUNTRY.groupSharesSrc).map((k) => [k, { sourceId: "wdi.NY.GDP.MKTP.KD.ZG", year: 2020, raw: 1 }])) as CountryData["groupSharesSrc"] };
    writeFileSync(join(d, "countries", "TST.json"), JSON.stringify(bad));
    expect(() => loadContent({ dataDir: d, devFixtures: false })).toThrow(/nope\.nothing/);
  });
  it("loads the committed minor.yaml when it exists (written by another lane)", () => {
    expect(Array.isArray(noFixtures.minorEvents)).toBe(true);
  });
});

describe("dev fixture country traits", () => {
  it("has labelled invented traits with provenance, and one trait left out on purpose", () => {
    expect(Object.keys(FIXTURE_COUNTRY.traits ?? {})).not.toContain("resources");
    expect(Object.keys(FIXTURE_COUNTRY.traits ?? {}).sort()).toEqual(Object.keys(FIXTURE_COUNTRY.traitsSrc ?? {}).sort());
    for (const p of Object.values(FIXTURE_COUNTRY.traitsSrc ?? {})) expect(p.sourceId).toBe(FIXTURE_SOURCE_ID);
  });
});

describe("handleNew / handleAdvance with news and traits", () => {
  it("new game info carries the minor event catalog and the sources for trait provenance", async () => {
    const r = await handleNew({ difficulty: "normal" }, deps());
    const info = (r.body as Body).info as GameInfo;
    expect(info.minorEvents!.length).toBe(content.minorEvents.length);
    expect(info.minorEvents![0]).not.toHaveProperty("conditions");
    expect(info.minorEvents![0]).not.toHaveProperty("baseWeight");
    expect(info.sources.some((s) => s.id === FIXTURE_SOURCE_ID)).toBe(true);
  });

  it("advance returns exactly the news that was added to state.news, with text", async () => {
    const s0 = (await handleNew({ difficulty: "normal" }, deps())).body as Body;
    const r = await handleAdvance({ state: s0.state }, deps());
    const b = r.body as Body;
    const added = (b.state.news ?? []) as GameState["news"] & {};
    expect(added.length).toBeGreaterThan(0);
    expect(b.news.map((n: Body) => ({ quarter: n.quarter, id: n.id }))).toEqual(added);
    for (const n of b.news) {
      expect(n.textTh.length).toBeGreaterThan(5);
      expect(n.effects.length).toBeGreaterThan(0);
    }
    // a second advance (after the decision) returns only the new items
    const dec = await handleDecide({ state: b.state, answer: { kind: "preset", choiceId: "a" } }, deps());
    const r2 = await handleAdvance({ state: (dec.body as Body).state }, deps());
    const b2 = r2.body as Body;
    expect(b2.news.length).toBe((b2.state.news ?? []).length - added.length);
    expect(b2.news.every((n: Body) => n.quarter > b.state.quarter)).toBe(true);
  });

  it("no minor events: no news and an empty list", async () => {
    const d = deps({ content: { ...content, minorEvents: [] } });
    const s0 = (await handleNew({ difficulty: "normal" }, d)).body as Body;
    const b = (await handleAdvance({ state: s0.state }, d)).body as Body;
    expect(b.news).toEqual([]);
    expect(b.state.news).toBeUndefined();
  });

  it("the country's traits steer the news (patronage news is likelier with high patronage)", async () => {
    const mk = (patronage: number): Content => ({
      ...content,
      countries: [{ ...FIXTURE_COUNTRY, traits: { ...FIXTURE_COUNTRY.traits, patronage } }],
    });
    const share = async (c: Content) => {
      let hits = 0, total = 0;
      for (let i = 0; i < 150; i++) {
        const d = deps({ content: c, seed: () => `steer-${i}` });
        const s0 = (await handleNew({ difficulty: "normal" }, d)).body as Body;
        const b = (await handleAdvance({ state: s0.state }, d)).body as Body;
        for (const n of b.news) { total++; if (n.id === "dev.news.contract") hits++; }
      }
      return hits / total;
    };
    const hi = await share(mk(100));
    const lo = await share(mk(0));
    expect(hi).toBeGreaterThan(lo * 2);
  });

  it("a saved game of a country that is no longer in the content still advances (neutral traits)", async () => {
    const s0 = (await handleNew({ difficulty: "normal" }, deps())).body as Body;
    const other: Content = { ...content, countries: [{ ...FIXTURE_COUNTRY, iso3: "ZZZ" }] };
    const r = await handleAdvance({ state: s0.state }, deps({ content: other }));
    expect(r.status).toBe(200);
  });
});

describe("handleDecide: institutional friction", () => {
  const TEXT = "ตรวจสอบการใช้เงินของหน่วยงานรัฐอย่างโปร่งใสและเปิดเผยต่อสาธารณะ";   // mock judge: corruption down, a reform

  async function atDecision(c: Content): Promise<GameState> {
    const d = deps({ content: c });
    const s0 = (await handleNew({ difficulty: "normal" }, d)).body as Body;
    return ((await handleAdvance({ state: s0.state }, d)).body as Body).state;
  }

  it("a reform in a high-patronage country reports the friction note and a lower chance", async () => {
    const hi: Content = { ...content, countries: [{ ...FIXTURE_COUNTRY, traits: { ...FIXTURE_COUNTRY.traits, patronage: 80 } }] };
    const neutral: Content = { ...content, countries: [{ ...FIXTURE_COUNTRY, traits: { ...FIXTURE_COUNTRY.traits, patronage: 50 } }] };
    const state = await atDecision(hi);
    const a = (await handleDecide({ state, answer: { kind: "free", text: TEXT } }, deps({ content: hi }))).body as Body;
    const b = (await handleDecide({ state, answer: { kind: "free", text: TEXT } }, deps({ content: neutral }))).body as Body;
    const notes = (a.report.notes as string[]).map(parseFrictionNote).filter((x) => x !== null);
    expect(notes).toEqual([{ measure: 0, patronage: 80, vote: 0, probability: -4.5 }]);
    expect((b.report.notes as string[]).some((n) => parseFrictionNote(n))).toBe(false);
    expect(a.report.measures[0].probability).toBeCloseTo(b.report.measures[0].probability - 4.5, 8);
  });

  it("a country without traits (older country files) gets no friction", async () => {
    const { traits: _t, traitsSrc: _s, ...real } = noFixtures.countries[0]!;
    const c: Content = { ...noFixtures, countries: [real] };
    const d = deps({ content: c });
    const s0 = (await handleNew({ difficulty: "normal" }, d)).body as Body;
    const state = ((await handleAdvance({ state: s0.state }, d)).body as Body).state;
    const r = (await handleDecide({ state, answer: { kind: "free", text: TEXT } }, d)).body as Body;
    expect((r.report.notes as string[]).some((n) => parseFrictionNote(n))).toBe(false);
  });
});

describe("frictionLines", () => {
  const report = (notes: string[]) => ({
    quarter: 2, cardId: "c", answerKind: "free" as const, eventShareApplied: 1, scheduledCount: 0, immediate: {}, notes,
    measures: [{ title: "ตรวจสอบงบ", parliament: { required: false, vote: null, passed: true }, courtRisk: 0, protest: { group: null, happened: false },
      probability: 50, roll: 10, outcome: "success" as const, multiplier: 1, costPctGdp: 0, downgradedForEvidence: 0 }],
  });
  it("is empty without friction notes", () => {
    expect(frictionLines(report(["meta answer: x"]))).toEqual([]);
  });
  it("explains a harder reform in Thai with both numbers and the proxy caveat", () => {
    const [l] = frictionLines(report([formatFrictionNote({ measure: 0, patronage: 80, vote: -3, probability: -4.5 })]));
    expect(l!.harder).toBe(true);
    expect(l!.text).toContain("ระบบอุปถัมภ์ทำให้ปฏิรูปยากขึ้น");
    expect(l!.text).toContain("3.0");
    expect(l!.text).toContain("4.5");
    expect(l!.text).toContain("ตรวจสอบงบ");
    expect(l!.text).toContain("ค่าประมาณ");
  });
  it("explains an easier reform, and omits the vote part when no vote was needed", () => {
    const [l] = frictionLines(report([formatFrictionNote({ measure: 0, patronage: 20, vote: 0, probability: 4.5 })]));
    expect(l!.harder).toBe(false);
    expect(l!.text).toContain("ง่ายขึ้น");
    expect(l!.text).not.toContain("คะแนนโหวต");
  });
});

describe("describeTraitSource", () => {
  const wdi: Source = {
    id: "wdi.ST.INT.RCPT.XP.ZS", kind: "dataset", title: "International tourism, receipts (% of total exports)", publisher: "World Bank WDI",
    indicatorCode: "ST.INT.RCPT.XP.ZS", url: "https://data.worldbank.org/indicator/ST.INT.RCPT.XP.ZS", license: "CC BY 4.0",
    commercialOk: true, coverage: null, retrievedAt: null, verifiedBy: null, note: null,
  };
  const wgi: Source = { ...wdi, id: "wgi.GOV_WGI_RL_SC", title: "WGI Rule of Law", indicatorCode: "GOV_WGI_RL_SC", url: "https://data.worldbank.org/indicator/GOV_WGI_RL_SC" };
  // TEST FIXTURE numbers for the unit test only
  const country: CountryData = {
    ...FIXTURE_COUNTRY,
    traits: { tourism: 40, patronage: 60 },
    traitsSrc: { tourism: { sourceId: wdi.id, year: 2022, raw: 12.3 }, patronage: { sourceId: wgi.id, year: 2023, raw: 40 } },
  };

  it("states the raw figure, the family and the year for a dataset trait", () => {
    const d = describeTraitSource("tourism", country, [wdi, wgi]);
    expect(d.kind).toBe("dataset");
    if (d.kind === "dataset") {
      expect(d.sentence).toBe("รายได้ท่องเที่ยว 12.3% ของการส่งออก (WDI, เฉลี่ย 5 ปีถึงปี 2022)");
      expect(d.proxy).toBe(false);
      expect(d.indicatorCode).toBe("ST.INT.RCPT.XP.ZS");
      expect(d.url).toContain("ST.INT.RCPT.XP.ZS");
    }
  });
  it("says patronage is a proxy from WGI Rule of Law", () => {
    const d = describeTraitSource("patronage", country, [wdi, wgi]);
    expect(d.kind).toBe("dataset");
    if (d.kind === "dataset") {
      expect(d.proxy).toBe(true);
      expect(d.sentence).toContain("WGI");
      expect(d.proxyNote).toBe(PATRONAGE_PROXY_NOTE);
      expect(PATRONAGE_PROXY_NOTE).toContain("หลักนิติธรรม");
      expect(PATRONAGE_PROXY_NOTE).toContain("WGI");
    }
  });
  it("flags the dev fixture and explains a trait that is missing", () => {
    expect(describeTraitSource("tourism", FIXTURE_COUNTRY, [FIXTURE_SOURCE]).kind).toBe("fixture");
    const m = describeTraitSource("resources", FIXTURE_COUNTRY, [FIXTURE_SOURCE]);
    expect(m.kind).toBe("missing");
    const t = describeTraitSource("tourism", { ...country, traits: {}, traitsSrc: {} }, []);
    expect(t.kind === "missing" && t.reason).toContain("ไม่มีข้อมูล");
  });
  it("covers every trait key without throwing", () => {
    const all = Object.fromEntries(TRAIT_KEYS.map((k) => [k, 50]));
    const src = Object.fromEntries(TRAIT_KEYS.map((k) => [k, { sourceId: wdi.id, year: 2020, raw: 5 }]));
    for (const k of TRAIT_KEYS) {
      const d = describeTraitSource(k, { ...country, traits: all, traitsSrc: src }, [wdi]);
      expect(d.kind).toBe("dataset");
    }
  });
});

describe("news helpers", () => {
  const catalog: PublicMinorEvent[] = [
    { id: "e1", category: "economy", textTh: "TEST FIXTURE หนึ่ง", effects: [{ target: "health", delta: 2 }] },
    { id: "e2", category: "society", textTh: "TEST FIXTURE สอง", effects: [{ target: "crime", delta: 1.5 }, { target: "group:urban", delta: -2 }] },
  ];
  const info = { country: FIXTURE_COUNTRY, sources: [], devFixtures: true, minorEvents: catalog } as GameInfo;

  it("newsFromState joins state.news with the catalog and skips unknown ids", () => {
    const state = { news: [{ quarter: 3, id: "e1" }, { quarter: 4, id: "gone" }, { quarter: 4, id: "e2" }] } as GameState;
    expect(newsFromState(state, info).map((n) => [n.quarter, n.id])).toEqual([[3, "e1"], [4, "e2"]]);
    expect(newsFromState({} as GameState, info)).toEqual([]);
    expect(newsFromState(state, { ...info, minorEvents: undefined })).toEqual([]);
  });
  it("chip colour is about good or bad for the country, sign is the raw change", () => {
    const stats = FIXTURE_COUNTRY.baseline as GameState["stats"];
    const up = newsChip("health", 2, stats);
    expect(up).toMatchObject({ tone: "good", sign: "+", text: "+2.0 สาธารณสุข" });
    const crime = newsChip("crime", 1.5, stats);
    expect(crime).toMatchObject({ tone: "bad", sign: "+" });
    const group = newsChip("group:urban", -2, stats);
    expect(group).toMatchObject({ tone: "bad", sign: "−" });
    expect(newsChip("inflation", -0.2, stats)).toMatchObject({ sign: "−", text: "−0.2% เงินเฟ้อ" });
  });
});
