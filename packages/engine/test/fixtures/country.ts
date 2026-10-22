// TEST FIXTURE — invented values, never shipped
import type { CountryData, Provenance } from "@ps/shared";

const fx: Provenance = { sourceId: "test.fixture", year: null, raw: null };

export const fixtureCountry: CountryData = {
  iso3: "TST",
  nameTh: "ประเทศทดสอบ",
  nameEn: "Testland",
  region: "TEST FIXTURE — invented values, never shipped",
  population: 10_000_000,
  baseline: {
    gdpGrowth: 2, inflation: 6, unemployment: 7, budget: 2, debt: 70,
    health: 55, education: 50, crime: 45, inequality: 42,
    corruption: 55, pressFreedom: 40, stability: 45, parliament: 55,
    environment: 40, foreignRelations: 45,
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
