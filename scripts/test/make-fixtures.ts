// Regenerates scripts/test/fixtures/wb/. TEST FIXTURE — shape copied from the API docs, values invented.
// Every value is base + step * countryIndex (+ a small yearly drift): patterned numbers, not real data.
// Usage: pnpm tsx scripts/test/make-fixtures.ts
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(import.meta.dirname, "fixtures", "wb");
const COUNTRIES: [iso3: string, name: string, region: string][] = [
  ["THA", "Thailand", "East Asia & Pacific"], ["VNM", "Vietnam", "East Asia & Pacific"],
  ["IDN", "Indonesia", "East Asia & Pacific"], ["IND", "India", "South Asia"],
  ["NGA", "Nigeria", "Sub-Saharan Africa"], ["KEN", "Kenya", "Sub-Saharan Africa"],
  ["BRA", "Brazil", "Latin America & Caribbean"], ["MEX", "Mexico", "Latin America & Caribbean"],
  ["POL", "Poland", "Europe & Central Asia"], ["DEU", "Germany", "Europe & Central Asia"],
];
/** code -> [base, step per country index] */
const SERIES: Record<string, [number, number]> = {
  "SP.POP.TOTL": [1_000_000, 1_000_000],
  "NY.GDP.MKTP.KD.ZG": [2, 0.1], "FP.CPI.TOTL.ZG": [3, 0.2], "SL.UEM.TOTL.ZS": [5, 0.3],
  "GC.DOD.TOTL.GD.ZS": [40, 2], "SI.POV.GINI": [35, 0.5],
  "GOV_WGI_CC_SC": [50, 2], "GOV_WGI_VA_SC": [45, 2], "GOV_WGI_PV_SC": [40, 2],
  "SP.DYN.LE00.IN": [70, 0.5], "SH.UHC.SRVS.CV.XD": [60, 1],
  "SE.SEC.ENRR": [80, 1.5], "HD.HCI.OVRL": [0.5, 0.01],
  "VC.IHR.PSRC.P5": [5, 0.5],
  "EN.ATM.PM25.MC.M3": [30, -1], "AG.LND.FRST.ZS": [30, 1], "EN.GHG.CO2.PC.CE.AR5": [5, 0.2],
  "SL.AGR.EMPL.ZS": [20, 1], "SP.RUR.TOTL.ZS": [40, 1], "SL.EMP.MPYR.ZS": [3, 0.1], "MS.MIL.TOTL.TF.ZS": [1, 0.05],
  "SP.POP.2024.MA.5Y": [8, 0.05], "SP.POP.2024.FE.5Y": [8, 0.05], "SP.POP.2529.MA.5Y": [7, 0.05], "SP.POP.2529.FE.5Y": [7, 0.05],
  "SP.POP.1564.TO.ZS": [65, 0.2],
  // trait codes (TRAITS in design-params)
  "ST.INT.RCPT.XP.ZS": [5, 2], "NV.AGR.TOTL.ZS": [12, -1], "NY.GDP.TOTL.RT.ZS": [3, 0.5], "NE.EXP.GNFS.ZS": [30, 4],
  "GOV_WGI_RL_SC": [45, 3], "GOV_WGI_GE_SC": [50, 2.5],
};
const round = (x: number): number => Math.round(x * 10_000) / 10_000;

type Case = { years?: [number, number]; nullFrom?: number; allNull?: boolean; absent?: boolean };
/** Deliberate gaps. THA: latest crime value is in 2022. KEN: no unemployment data. MEX: debt stops in 2012.
 *  IND: no HCI response (optional). DEU: armed forces all null (optional).
 *  Trait gaps: POL tourism (optional trait) null in every year; IDN no WGI government-effectiveness response;
 *  VNM natural-resource rents stop in 2012 (older than the age limit). */
const CASES: Record<string, Record<string, Case>> = {
  THA: { "VC.IHR.PSRC.P5": { nullFrom: 2023 } },
  KEN: { "SL.UEM.TOTL.ZS": { allNull: true } },
  MEX: { "GC.DOD.TOTL.GD.ZS": { years: [2010, 2019], nullFrom: 2013 } },
  IND: { "HD.HCI.OVRL": { absent: true } },
  DEU: { "MS.MIL.TOTL.TF.ZS": { allNull: true } },
  POL: { "ST.INT.RCPT.XP.ZS": { allNull: true } },
  IDN: { "GOV_WGI_GE_SC": { absent: true } },
  VNM: { "NY.GDP.TOTL.RT.ZS": { years: [2008, 2017], nullFrom: 2013 } },
};

mkdirSync(OUT, { recursive: true });
for (const [iso3] of COUNTRIES) rmSync(join(OUT, iso3), { recursive: true, force: true });   // keeps README.md
const meta = (total: number) => ({ page: 1, pages: 1, per_page: 100, total, sourceid: "2", lastupdated: "TEST FIXTURE" });

COUNTRIES.forEach(([iso3, name, region], i) => {
  const dir = join(OUT, iso3);
  mkdirSync(dir);
  const label = `${name} (TEST FIXTURE)`;
  writeFileSync(join(dir, "_country.json"), JSON.stringify([
    meta(1),
    [{ id: iso3, iso2Code: "XX", name: label, region: { id: "TST", iso2code: "XX", value: `${region} (TEST FIXTURE)` } }],
  ], null, 2) + "\n");
  for (const [code, [base, step]] of Object.entries(SERIES)) {
    const c = CASES[iso3]?.[code] ?? {};
    if (c.absent) continue;
    const [from, to] = c.years ?? [2014, 2023];
    const rows = [];
    for (let y = to; y >= from; y--) {
      const isNull = c.allNull || (c.nullFrom !== undefined && y >= c.nullFrom);
      rows.push({
        indicator: { id: code, value: "TEST FIXTURE" },
        country: { id: "XX", value: label },
        countryiso3code: iso3,
        date: String(y),
        value: isNull ? null : round(base + step * i + (y - 2023) * Math.abs(step) * 0.1),
        unit: "", obs_status: "", decimal: 1,
      });
    }
    writeFileSync(join(dir, `${code}.json`), JSON.stringify([meta(rows.length), rows], null, 2) + "\n");
  }
});
console.log(`wrote fixtures for ${COUNTRIES.length} countries to ${OUT}`);
