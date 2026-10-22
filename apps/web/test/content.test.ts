import { describe, it, expect } from "vitest";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { CountryData } from "@ps/shared";
import { ContentError, loadContent } from "../server/content";
import { FIXTURE_COUNTRY, FIXTURE_LABEL } from "../dev/fixture-country";

const REAL = resolve(import.meta.dirname, "../../../data");

function tmpData(): string {
  const d = mkdtempSync(join(tmpdir(), "ps-web-data-"));
  cpSync(REAL, d, { recursive: true });
  return d;
}

/** A structurally valid country for loader tests only (temp dir, never committed). */
function testCountry(over: Record<string, unknown> = {}): Record<string, unknown> {
  const src = { sourceId: "wdi.NY.GDP.MKTP.KD.ZG", year: 2020, raw: 1 };
  const keys = ["gdpGrowth", "inflation", "unemployment", "budget", "debt", "health", "education", "crime",
    "inequality", "corruption", "pressFreedom", "stability", "parliament", "environment", "foreignRelations"];
  const groups = ["farmers", "urban", "business", "youth", "military"];
  return {
    iso3: "TST", nameTh: "ทดสอบ", nameEn: "LOADER TEST ONLY", region: "TEST", population: 1000,
    baseline: Object.fromEntries(keys.map((k) => [k, 50])),
    baselineSrc: Object.fromEntries(keys.map((k) => [k, src])),
    groupShares: { farmers: 0.2, urban: 0.3, business: 0.1, youth: 0.2, military: 0.2 },
    groupSharesSrc: Object.fromEntries(groups.map((k) => [k, src])),
    ...over,
  };
}

describe("loadContent with the real data directory", () => {
  it("loads and validates cards, evidence and sources", () => {
    const c = loadContent({ dataDir: REAL, devFixtures: false });
    expect(c.cards.length).toBe(12);
    expect(c.evidence.length).toBeGreaterThanOrEqual(15);
    expect(c.sources.length).toBeGreaterThan(30);
    expect(c.cards.every((card) => card.choices.length === 3)).toBe(true);
  });

  it("has no countries and no fixture without DEV_FIXTURES", () => {
    const c = loadContent({ dataDir: REAL, devFixtures: false });
    expect(c.countries).toEqual([]);
    expect(c.devFixtures).toBe(false);
    expect(c.sources.find((s) => s.id === FIXTURE_COUNTRY.baselineSrc.gdpGrowth.sourceId)).toBeUndefined();
  });

  it("uses only the clearly labelled fictional country with DEV_FIXTURES", () => {
    const c = loadContent({ dataDir: REAL, devFixtures: true });
    expect(c.devFixtures).toBe(true);
    expect(c.countries.map((x) => x.iso3)).toEqual([FIXTURE_COUNTRY.iso3]);
    const fx = c.countries[0]!;
    expect(fx.region).toBe(FIXTURE_LABEL);
    expect(FIXTURE_LABEL).toBe("DEV FIXTURE — invented values");
    expect(fx.nameEn).toContain("DEV FIXTURE");
    expect(CountryData.safeParse(fx).success).toBe(true);
    const total = Object.values(fx.groupShares).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 6);
    expect(c.sources.some((s) => s.id === fx.baselineSrc.gdpGrowth.sourceId)).toBe(true);
  });

  it("leaves choice.judgment null when nothing is pre-judged", () => {
    const c = loadContent({ dataDir: REAL, devFixtures: false });
    expect(c.cards.every((card) => card.choices.every((ch) => ch.judgment === null))).toBe(true);
  });
});

describe("countries from data/countries", () => {
  it("loads a valid country json", () => {
    const d = tmpData();
    mkdirSync(join(d, "countries"));
    writeFileSync(join(d, "countries", "TST.json"), JSON.stringify(testCountry()));
    const c = loadContent({ dataDir: d, devFixtures: false });
    expect(c.countries.map((x) => x.iso3)).toEqual(["TST"]);
  });

  it("rejects group shares that do not sum to 1", () => {
    const d = tmpData();
    mkdirSync(join(d, "countries"));
    writeFileSync(join(d, "countries", "TST.json"), JSON.stringify(testCountry({
      groupShares: { farmers: 0.5, urban: 0.5, business: 0.5, youth: 0.5, military: 0.5 },
    })));
    expect(() => loadContent({ dataDir: d, devFixtures: false })).toThrow(ContentError);
  });

  it("rejects a country that cites an unknown source id", () => {
    const d = tmpData();
    mkdirSync(join(d, "countries"));
    const c = testCountry();
    (c.baselineSrc as Record<string, unknown>).gdpGrowth = { sourceId: "nope.nothing", year: 2020, raw: 1 };
    writeFileSync(join(d, "countries", "TST.json"), JSON.stringify(c));
    expect(() => loadContent({ dataDir: d, devFixtures: false })).toThrow(/nope\.nothing/);
  });

  it("rejects a file that does not match the CountryData schema", () => {
    const d = tmpData();
    mkdirSync(join(d, "countries"));
    writeFileSync(join(d, "countries", "bad.json"), JSON.stringify({ iso3: "XX" }));
    expect(() => loadContent({ dataDir: d, devFixtures: false })).toThrow(ContentError);
  });
});

describe("cross references", () => {
  it("rejects a choice that cites unknown evidence", () => {
    const d = tmpData();
    const f = join(d, "cards", "economy.oil.spike.yaml");
    writeFileSync(f, readFileSync(f, "utf8").replace("ev.fuel-subsidy.001", "ev.does-not-exist"));
    expect(() => loadContent({ dataDir: d, devFixtures: false })).toThrow(/ev\.does-not-exist/);
  });
});

describe("pre-judged choices", () => {
  const judgment = {
    input_class: "normal", interpretation: "TEST", overreach: false,
    actions: [{
      title: "TEST", cost_size: "S", recurring_cost_size: "none", duration_quarters: 4,
      requires_legislation: false, legal_risk: "none", effects: [], group_impacts: [], side_effects: [],
    }],
    scores: { relevance: "3", feasibility: "3", specificity: "3", tradeoffs: "3", consistency: "3" },
    event_coverage: "1",
    flags: { impossible_claim: false, cruelty: false, rights_violation: false, unconstitutional: false },
    follow_up_hooks: [],
  };
  const entry = (over: Record<string, unknown> = {}) => ({
    cardId: "economy.oil.spike", choiceId: "b", judgment, runs: 3, model: "test", promptVersion: "v1",
    createdAt: "2026-01-01", ...over,
  });

  it("merges judgment into the matching choice", () => {
    const d = tmpData();
    mkdirSync(join(d, "prejudged"));
    writeFileSync(join(d, "prejudged", "economy.oil.spike.json"), JSON.stringify([entry()]));
    const c = loadContent({ dataDir: d, devFixtures: false });
    const card = c.cards.find((x) => x.id === "economy.oil.spike")!;
    expect(card.choices.find((x) => x.id === "b")!.judgment?.interpretation).toBe("TEST");
    expect(card.choices.find((x) => x.id === "a")!.judgment).toBeNull();
  });

  it("rejects an entry for an unknown card or choice", () => {
    const d = tmpData();
    mkdirSync(join(d, "prejudged"));
    writeFileSync(join(d, "prejudged", "x.json"), JSON.stringify([entry({ cardId: "no.such.card" })]));
    expect(() => loadContent({ dataDir: d, devFixtures: false })).toThrow(ContentError);
    writeFileSync(join(d, "prejudged", "x.json"), JSON.stringify([entry({ choiceId: "z" })]));
    expect(() => loadContent({ dataDir: d, devFixtures: false })).toThrow(ContentError);
  });

  it("rejects an invalid judgment", () => {
    const d = tmpData();
    mkdirSync(join(d, "prejudged"));
    writeFileSync(join(d, "prejudged", "x.json"), JSON.stringify([entry({ judgment: { nope: 1 } })]));
    expect(() => loadContent({ dataDir: d, devFixtures: false })).toThrow(ContentError);
  });
});
