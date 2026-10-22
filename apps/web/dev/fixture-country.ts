// DEV FIXTURE — invented values. Not a real country, not real statistics.
// Used only when the server runs with DEV_FIXTURES=1 (see server/content.ts), so the game can be played
// end to end before data/countries/ holds real, sourced countries. Never ship these numbers as data.
import type { CountryData, Provenance, Source } from "@ps/shared";

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
};
