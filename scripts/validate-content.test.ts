import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { Card, Evidence, MinorEvent, Source, TRAIT_KEYS } from "@ps/shared";

const root = join(import.meta.dirname, "..");
const load = (rel: string): unknown => parse(readFileSync(join(root, rel), "utf8"));

const cardFiles = readdirSync(join(root, "data/cards")).filter((f) => f.endsWith(".yaml")).sort();
const evidenceRaw = load("data/evidence/evidence.yaml") as unknown[];
const researchRaw = load("data/sources/research-sources.yaml") as unknown[];
const sourcesRaw = load("data/sources/sources.yaml") as unknown[];

const research = researchRaw.map((s) => Source.parse(s));
const allSources = sourcesRaw.map((s) => Source.parse(s));
const evidence = evidenceRaw.map((e) => Evidence.parse(e));
const parsedCards = cardFiles.map((f) => Card.parse(load(`data/cards/${f}`)));

const minorRaw = load("data/events/minor.yaml") as unknown[];
const minor = minorRaw.map((m) => MinorEvent.parse(m));

const dup = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);

describe("research sources", () => {
  it("all parse as Source with kind research, unverified, and a search note", () => {
    expect(research.length).toBeGreaterThan(0);
    for (const s of research) {
      expect(s.kind).toBe("research");
      expect(s.verifiedBy).toBeNull();
      expect(s.note ?? "").toMatch(/search/i);
    }
  });
  it("ids are unique and do not collide with sources.yaml", () => {
    expect(dup(research.map((s) => s.id))).toEqual([]);
    const main = new Set(allSources.map((s) => s.id));
    expect(research.filter((s) => main.has(s.id)).map((s) => s.id)).toEqual([]);
  });
  it("every research source is cited by some evidence item", () => {
    const used = new Set(evidence.map((e) => e.sourceId));
    expect(research.filter((s) => !used.has(s.id)).map((s) => s.id)).toEqual([]);
  });
});

describe("evidence", () => {
  it("has a library of a sensible size", () => {
    expect(evidence.length).toBeGreaterThanOrEqual(15);
    expect(evidence.length).toBeLessThanOrEqual(50);
  });
  it("ids are unique", () => {
    expect(dup(evidence.map((e) => e.id))).toEqual([]);
  });
  it("every sourceId exists in research-sources.yaml", () => {
    const ids = new Set(research.map((s) => s.id));
    expect(evidence.filter((e) => !ids.has(e.sourceId)).map((e) => e.id)).toEqual([]);
  });
  it("verifiedBy is null", () => {
    expect(evidence.filter((e) => e.verifiedBy !== null).map((e) => e.id)).toEqual([]);
  });
});

describe("cards", () => {
  it("there are 18 card files, each parsing as Card", () => {
    expect(cardFiles.length).toBe(18);
    expect(parsedCards.length).toBe(18);
  });
  it("card ids are unique and match the file name", () => {
    expect(dup(parsedCards.map((c) => c.id))).toEqual([]);
    parsedCards.forEach((c, i) => expect(cardFiles[i]).toBe(`${c.id}.yaml`));
  });
  it("category mix covers the spec", () => {
    const n = (cat: string) => parsedCards.filter((c) => c.category === cat).length;
    expect(n("disaster")).toBeGreaterThanOrEqual(2);
    expect(n("economy")).toBeGreaterThanOrEqual(2);
    expect(n("society")).toBeGreaterThanOrEqual(2);
    expect(n("health")).toBeGreaterThanOrEqual(2);
    expect(n("politics")).toBeGreaterThanOrEqual(1);
    expect(n("foreign")).toBeGreaterThanOrEqual(1);
    expect(n("opportunity")).toBeGreaterThanOrEqual(1);
  });
  it("good-news cards: onArrival is 1-3 effects and its index-scale total beats ifIgnored", () => {
    // Index scale = group satisfaction and 0-100 stats where higher is better. Stats with their own scale
    // (gdpGrowth, inflation, unemployment, budget, debt, inequality) and lower-is-better indices are left out.
    const own = new Set(["gdpGrowth", "inflation", "unemployment", "budget", "debt", "inequality", "crime", "corruption"]);
    const indexSum = (es: { target: string; delta: number }[]) =>
      es.filter((e) => !own.has(e.target)).reduce((a, e) => a + e.delta, 0);
    const good = parsedCards.filter((c) => c.onArrival !== undefined);
    expect(good.length).toBeGreaterThanOrEqual(6);
    for (const c of good) {
      const arrival = c.onArrival!;
      expect(arrival.length, c.id).toBeGreaterThanOrEqual(1);
      expect(arrival.length, c.id).toBeLessThanOrEqual(3);
      expect(indexSum(arrival), c.id).toBeGreaterThan(indexSum(c.ifIgnored));
      expect(c.ifIgnored.length, c.id).toBeLessThanOrEqual(2);
      for (const e of c.ifIgnored) expect(e.delta, `${c.id} ifIgnored ${e.target}`).toBeLessThan(0);
    }
  });
  it("choice ids are exactly a, b, c", () => {
    for (const c of parsedCards) expect(c.choices.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
  it("choices in a card have three distinct approaches", () => {
    for (const c of parsedCards) expect(new Set(c.choices.map((x) => x.approach)).size).toBe(3);
  });
  it("every choice evidenceId exists in evidence.yaml", () => {
    const ids = new Set(evidence.map((e) => e.id));
    for (const c of parsedCards)
      for (const ch of c.choices)
        expect(ch.evidenceIds.filter((id) => !ids.has(id)), `${c.id}.${ch.id}`).toEqual([]);
  });
  it("choice evidenceIds have no duplicates", () => {
    for (const c of parsedCards)
      for (const ch of c.choices) expect(dup(ch.evidenceIds), `${c.id}.${ch.id}`).toEqual([]);
  });
  it("every card sourceId exists in sources.yaml or research-sources.yaml", () => {
    const ids = new Set([...allSources, ...research].map((s) => s.id));
    for (const c of parsedCards) expect(c.sourceIds.filter((id) => !ids.has(id)), c.id).toEqual([]);
  });
  it("every card cites design.level-scale plus one research or dataset source", () => {
    const kind = new Map([...allSources, ...research].map((s) => [s.id, s.kind]));
    for (const c of parsedCards) {
      expect(c.sourceIds, c.id).toContain("design.level-scale");
      expect(c.sourceIds.some((id) => kind.get(id) === "research" || kind.get(id) === "dataset"), c.id).toBe(true);
    }
  });
  it("judgment and reviewedBy are null", () => {
    for (const c of parsedCards)
      for (const ch of c.choices) {
        expect(ch.judgment).toBeNull();
        expect(ch.reviewedBy).toBeNull();
      }
  });
  it("ifIgnored has 2-4 effects; cooldownQ is 8; non-1 baseWeight has a comment", () => {
    for (const c of parsedCards) {
      expect(c.ifIgnored.length, c.id).toBeGreaterThanOrEqual(2);
      expect(c.ifIgnored.length, c.id).toBeLessThanOrEqual(4);
      expect(c.cooldownQ, c.id).toBe(8);
      if (c.baseWeight !== 1) {
        const text = readFileSync(join(root, "data/cards", `${c.id}.yaml`), "utf8");
        expect(text, `${c.id} needs a comment explaining baseWeight`).toMatch(/#.*weight/i);
      }
    }
  });
  it("situation text is Thai, long enough, has no digits and no country names", () => {
    for (const c of parsedCards) {
      expect(c.situationTh, c.id).toMatch(/[฀-๿]/);
      expect(c.situationTh.length, c.id).toBeGreaterThan(150);
      const words = [...new Intl.Segmenter("th", { granularity: "word" }).segment(c.situationTh)].filter((x) => x.isWordLike).length;
      expect(words, `${c.id} has ${words} words`).toBeGreaterThanOrEqual(80);
      expect(words, `${c.id} has ${words} words`).toBeLessThanOrEqual(120);
      expect(c.situationTh, c.id).not.toMatch(/[0-9๐-๙]/);
      expect(c.situationTh, c.id).not.toMatch(/ไทย|สหรัฐ|จีน|ญี่ปุ่น|รัสเซีย|อินเดีย|ยูเครน|เมียนมา|อเมริกา/);
    }
  });
  it("every choice has a real cost and names affected groups", () => {
    for (const c of parsedCards)
      for (const ch of c.choices) {
        expect(ch.costHint, `${c.id}.${ch.id}`).not.toBe("none");
        expect(ch.affectedGroups.length, `${c.id}.${ch.id}`).toBeGreaterThan(0);
      }
  });
});

describe("minor events (news ticker)", () => {
  // Stats where a higher value is worse for the player; for every other target higher is better.
  const lowerIsBetter = new Set(["inflation", "unemployment", "debt", "crime", "corruption", "inequality"]);
  const unitStats = new Set(["gdpGrowth", "inflation", "unemployment", "budget", "debt", "inequality"]);
  const good = (target: string, delta: number) => (lowerIsBetter.has(target) ? -delta : delta);
  const sign = (m: MinorEvent) => {
    const s = m.effects.map((e) => Math.sign(good(e.target, e.delta)));
    return s.every((x) => x > 0) ? "positive" : s.every((x) => x < 0) ? "negative" : "mixed";
  };

  it("there are 30-60 events, all parsing as MinorEvent with unique ids", () => {
    expect(minor.length).toBeGreaterThanOrEqual(30);
    expect(minor.length).toBeLessThanOrEqual(60);
    expect(dup(minor.map((m) => m.id))).toEqual([]);
  });
  it("ids start with news.<category>.", () => {
    for (const m of minor) expect(m.id.startsWith(`news.${m.category}.`), m.id).toBe(true);
  });
  it("all 8 categories are used", () => {
    expect(new Set(minor.map((m) => m.category)).size).toBe(8);
  });
  it("each event is clearly good or clearly bad, and the signs are balanced (40-60% positive)", () => {
    expect(minor.filter((m) => sign(m) === "mixed").map((m) => m.id)).toEqual([]);
    const positive = minor.filter((m) => sign(m) === "positive").length / minor.length;
    expect(positive).toBeGreaterThanOrEqual(0.4);
    expect(positive).toBeLessThanOrEqual(0.6);
  });
  it("effects are small: index 1-3, units 0.1-0.3, over 1-2 quarters", () => {
    for (const m of minor)
      for (const e of m.effects) {
        const [lo, hi] = unitStats.has(e.target) ? [0.1, 0.3] : [1, 3];
        const a = Math.abs(e.delta);
        expect(a, `${m.id} ${e.target}`).toBeGreaterThanOrEqual(lo - 1e-9);
        expect(a, `${m.id} ${e.target}`).toBeLessThanOrEqual(hi + 1e-9);
        expect(e.over_quarters, m.id).toBeGreaterThanOrEqual(1);
        expect(e.over_quarters, m.id).toBeLessThanOrEqual(2);
      }
  });
  it("text is one Thai line under 25 words, with no digits and no country names", () => {
    const seg = new Intl.Segmenter("th", { granularity: "word" });
    for (const m of minor) {
      expect(m.textTh, m.id).toMatch(/[\u0E00-\u0E7F]/);
      expect(m.textTh, m.id).not.toMatch(/\n/);
      expect(m.textTh, m.id).not.toMatch(/[0-9\u0E50-\u0E59]/);
      expect(m.textTh, m.id).not.toMatch(/ไทย|สหรัฐ|จีน|ญี่ปุ่น|รัสเซีย|อินเดีย|ยูเครน|เมียนมา|อเมริกา|ลาว|กัมพูชา|มาเลเซีย|เวียดนาม|อินโดนีเซีย|บราซิล|เม็กซิโก|ไนจีเรีย|อียิปต์|ตุรกี|อังกฤษ|เยอรมนี|ฝรั่งเศส|ฟิลิปปินส์|เกาหลี|ปากีสถาน|บังกลาเทศ|เคนยา|แอฟริกาใต้|อาร์เจนตินา|โคลอมเบีย/);
      const words = [...seg.segment(m.textTh)].filter((x) => x.isWordLike).length;
      expect(words, `${m.id} has ${words} words`).toBeLessThan(25);
    }
  });
  it("every sourceId exists and includes design.minor-events", () => {
    const ids = new Set([...allSources, ...research].map((s) => s.id));
    for (const m of minor) {
      expect(m.sourceIds, m.id).toContain("design.minor-events");
      expect(m.sourceIds.filter((id) => !ids.has(id)), m.id).toEqual([]);
    }
  });
  it("traitWeights use valid trait keys and values in -1..1; the core links are present", () => {
    const keys = new Set<string>(TRAIT_KEYS);
    for (const m of minor)
      for (const [k, v] of Object.entries(m.traitWeights ?? {})) {
        expect(keys.has(k), `${m.id} ${k}`).toBe(true);
        expect(v!, `${m.id} ${k}`).toBeGreaterThanOrEqual(-1);
        expect(v!, `${m.id} ${k}`).toBeLessThanOrEqual(1);
      }
    const used = new Set(minor.flatMap((m) => Object.keys(m.traitWeights ?? {})));
    for (const k of ["tourism", "agriculture", "resources", "openness", "patronage", "govEffectiveness"]) expect(used.has(k), k).toBe(true);
  });
  it("a handful of events are about patronage and influence", () => {
    expect(minor.filter((m) => (m.traitWeights?.patronage ?? 0) > 0).length).toBeGreaterThanOrEqual(3);
  });
});

describe("card traitWeights", () => {
  it("every card traitWeights key is a valid trait and the planned links are present", () => {
    const keys = new Set<string>(TRAIT_KEYS);
    for (const c of parsedCards)
      for (const k of Object.keys(c.traitWeights ?? {})) expect(keys.has(k), `${c.id} ${k}`).toBe(true);
    const w = (id: string) => parsedCards.find((c) => c.id === id)?.traitWeights ?? {};
    expect(w("economy.tourism.surge").tourism).toBeGreaterThan(0);
    expect(w("society.harvest.bumper").agriculture).toBeGreaterThan(0);
    expect(w("disaster.drought.severe").agriculture).toBeGreaterThan(0);
    expect(w("opportunity.energy.discovery").resources).toBeGreaterThan(0);
    expect(w("foreign.trade.export-boom").openness).toBeGreaterThan(0);
    expect(w("foreign.tariff.raised").openness).toBeGreaterThan(0);
    expect(w("politics.cabinet.scandal").patronage).toBeGreaterThan(0);
    expect(w("health.hospitals.overwhelmed").govEffectiveness).toBeLessThan(0);
  });
});
