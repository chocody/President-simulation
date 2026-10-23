import { describe, it, expect } from "vitest";
import { parse } from "yaml";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CountryData, DATA_MAPPING, DISCRETIONARY_BUDGET_PCT_GDP, GROUP_KEYS, MVP_COUNTRIES, STAT_KEYS, Source, UNSOURCED_DEFAULTS,
} from "@ps/shared";
import { THAI_NAMES, linear, mapCountry, plannedCodes, type Observations } from "../lib/mapping";

const M = DATA_MAPPING.value;
const root = join(import.meta.dirname, "..", "..");
const sourceIds = new Set((parse(readFileSync(join(root, "data/sources/sources.yaml"), "utf8")) as { id: string }[]).map((s) => s.id));

/** TEST numbers, invented and chosen so the expected values can be computed by hand. All year 2023 unless changed. */
const base = (): Observations => {
  const o: Observations = {};
  const put = (code: string, value: number, year = 2023) => { o[code] = { year, value }; };
  put("SP.POP.TOTL", 5_000_000);
  put("NY.GDP.MKTP.KD.ZG", 3.5); put("FP.CPI.TOTL.ZG", 4.2); put("SL.UEM.TOTL.ZS", 6.1);
  put("GC.DOD.TOTL.GD.ZS", 55); put("SI.POV.GINI", 38);
  put("GOV_WGI_CC_SC", 70); put("GOV_WGI_VA_SC", 60); put("GOV_WGI_PV_SC", 45);
  put("SP.DYN.LE00.IN", 72.5); put("SH.UHC.SRVS.CV.XD", 70);
  put("SE.SEC.ENRR", 90); put("HD.HCI.OVRL", 0.6);
  put("VC.IHR.PSRC.P5", 6);
  put("EN.ATM.PM25.MC.M3", 25); put("AG.LND.FRST.ZS", 30); put("EN.GHG.CO2.PC.CE.AR5", 5);
  put("SL.AGR.EMPL.ZS", 30); put("SP.RUR.TOTL.ZS", 40); put("SL.EMP.MPYR.ZS", 4); put("MS.MIL.TOTL.TF.ZS", 1);
  put("SP.POP.2024.MA.5Y", 8); put("SP.POP.2024.FE.5Y", 7.6); put("SP.POP.2529.MA.5Y", 7.2); put("SP.POP.2529.FE.5Y", 6.8);
  put("SP.POP.1564.TO.ZS", 65);
  return o;
};
const run = (observations: Observations) => mapCountry({ iso3: "THA", nameEn: "Testland", region: "Test Region", observations });
const ok = (observations: Observations) => {
  const r = run(observations);
  if (!r.ok) throw new Error(r.reasons.join("; "));
  return r;
};

describe("linear", () => {
  it("maps a to 0 and b to 100, clamped, in either direction", () => {
    expect(linear(50, [50, 85])).toBe(0);
    expect(linear(85, [50, 85])).toBe(100);
    expect(linear(67.5, [50, 85])).toBeCloseTo(50, 10);
    expect(linear(40, [50, 85])).toBe(0);
    expect(linear(90, [50, 85])).toBe(100);
    expect(linear(25, [75, 5])).toBeCloseTo((50 / 70) * 100, 10);
    expect(linear(80, [75, 5])).toBe(0);
    expect(linear(0, [75, 5])).toBe(100);
  });
});

describe("mapping formulas on hand-computed numbers", () => {
  const { data } = ok(base());
  it("direct stats", () => {
    expect(data.baseline.gdpGrowth).toBe(3.5);
    expect(data.baseline.inflation).toBe(4.2);
    expect(data.baseline.unemployment).toBe(6.1);
    expect(data.baseline.debt).toBe(55);
    expect(data.baseline.inequality).toBe(38);
    expect(data.baseline.pressFreedom).toBe(60);
    expect(data.baseline.stability).toBe(45);
  });
  it("corruption = 100 - WGI control of corruption", () => {
    expect(data.baseline.corruption).toBe(30);
  });
  it("health = mean(LE scaled 50-85, UHC) = mean(64.2857, 70)", () => {
    expect(data.baseline.health).toBeCloseTo((((72.5 - 50) / 35) * 100 + 70) / 2, 8);
    expect(data.baseline.health).toBeCloseTo(67.142857, 5);
  });
  it("education = mean(min(enrolment, 100), HCI x 100) = mean(90, 60)", () => {
    expect(data.baseline.education).toBeCloseTo(75, 10);
  });
  it("crime = homicides 6 of 30 -> 20", () => {
    expect(data.baseline.crime).toBeCloseTo(20, 10);
  });
  it("environment = mean(PM2.5 25 -> 71.43, forest 30 -> 50, CO2 5 -> 75)", () => {
    expect(data.baseline.environment).toBeCloseTo((500 / 7 + 50 + 75) / 3, 8);
    expect(data.baseline.environment).toBeCloseTo(65.47619, 4);
  });
  it("budget, parliament and foreignRelations are design values", () => {
    expect(data.baseline.budget).toBe(DISCRETIONARY_BUDGET_PCT_GDP.value.normal);
    expect(data.baseline.parliament).toBe(UNSOURCED_DEFAULTS.value.parliament);
    expect(data.baseline.foreignRelations).toBe(UNSOURCED_DEFAULTS.value.foreignRelations);
    expect(data.baselineSrc.budget).toEqual({ sourceId: "design.budget", year: null, raw: null });
    expect(data.baselineSrc.parliament).toEqual({ sourceId: "design.unsourced", year: null, raw: null });
    expect(data.baselineSrc.foreignRelations).toEqual({ sourceId: "design.unsourced", year: null, raw: null });
  });
  it("identity fields", () => {
    expect(data.iso3).toBe("THA");
    expect(data.nameEn).toBe("Testland");
    expect(data.region).toBe("Test Region");
    expect(data.population).toBe(5_000_000);
    expect(data.nameTh).toBe(THAI_NAMES.THA);
  });
  it("group shares: farmers 30, business 4, military 1, youth 14.8/65, urban = remainder", () => {
    const youth = (29.6 / 2 / 65) * 100; // 22.7692...
    const s = data.groupShares;
    expect(s.farmers).toBeCloseTo(0.3, 10);
    expect(s.business).toBeCloseTo(0.04, 10);
    expect(s.military).toBeCloseTo(0.01, 10);
    expect(s.youth).toBeCloseTo(youth / 100, 10);
    expect(s.urban).toBeCloseTo((100 - 35 - youth) / 100, 10);
  });
});

describe("clamping and fallbacks", () => {
  it("clamps scaled values to 0-100 and caps enrolment at 100", () => {
    const o = base();
    o["SE.SEC.ENRR"] = { year: 2023, value: 130 };
    o["VC.IHR.PSRC.P5"] = { year: 2023, value: 90 };
    o["SP.DYN.LE00.IN"] = { year: 2023, value: 95 };
    const { data } = ok(o);
    expect(data.baseline.education).toBeCloseTo((100 + 60) / 2, 10);
    expect(data.baseline.crime).toBe(100);
    expect(data.baseline.health).toBeCloseTo((100 + 70) / 2, 10);
  });
  it("clamps direct stats into STAT_RANGE and keeps the raw value in provenance", () => {
    const o = base();
    o["FP.CPI.TOTL.ZG"] = { year: 2023, value: 180 };
    const r = ok(o);
    expect(r.data.baseline.inflation).toBe(100);
    expect(r.data.baselineSrc.inflation.raw).toBe(180);
    expect(r.notes.join(" ")).toMatch(/inflation.*clamp/i);
  });
  it("education falls back to enrolment alone when HCI is missing, and says so", () => {
    const o = base(); delete o["HD.HCI.OVRL"];
    const r = ok(o);
    expect(r.data.baseline.education).toBe(90);
    expect(r.notes.join(" ")).toMatch(/HCI/);
  });
  it("military share is 0 when armed forces data is missing, with design.unsourced provenance and a note", () => {
    const o = base(); delete o["MS.MIL.TOTL.TF.ZS"];
    const r = ok(o);
    expect(r.data.groupShares.military).toBe(0);
    expect(r.data.groupSharesSrc.military).toEqual({ sourceId: "design.unsourced", year: null, raw: null });
    expect(r.notes.join(" ")).toMatch(/military/i);
    const total = GROUP_KEYS.reduce((a, g) => a + r.data.groupShares[g], 0);
    expect(total).toBeCloseTo(1, 12);
  });
  it("when the four group weights exceed 100 urban is 0 and shares are normalised", () => {
    const o = base();
    o["SL.AGR.EMPL.ZS"] = { year: 2023, value: 80 };
    o["SL.EMP.MPYR.ZS"] = { year: 2023, value: 10 };
    o["MS.MIL.TOTL.TF.ZS"] = { year: 2023, value: 5 };
    for (const c of M.groups.youthBands) o[c] = { year: 2023, value: 16 };
    o["SP.POP.1564.TO.ZS"] = { year: 2023, value: 60 };
    const { data } = ok(o);
    const youthW = (64 / 2 / 60) * 100;
    const total = 80 + 10 + 5 + youthW;
    expect(data.groupShares.urban).toBe(0);
    expect(data.groupShares.farmers).toBeCloseTo(80 / total, 10);
    expect(data.groupShares.youth).toBeCloseTo(youthW / total, 10);
  });
});

describe("skip rules", () => {
  const required = plannedCodes().required;
  it("every required code skips the country when missing, with its code in the reason", () => {
    for (const code of required) {
      const o = base(); delete o[code];
      const r = run(o);
      expect(r.ok, code).toBe(false);
      if (!r.ok) expect(r.reasons.join(" "), code).toContain(code);
    }
  });
  it("optional codes are exactly HCI and armed forces", () => {
    expect([...plannedCodes().optional].sort()).toEqual(["HD.HCI.OVRL", "MS.MIL.TOTL.TF.ZS"].sort());
  });
  it("lists every code in DATA_MAPPING plus population", () => {
    const all = [...plannedCodes().required, ...plannedCodes().optional];
    for (const c of [
      ...Object.values(M.direct).map((d) => d!.code), M.health.lifeExpectancy.code, M.health.uhc.code,
      M.education.enrollment.code, M.education.hci.code, M.crime.code, M.environment.pm25.code, M.environment.forest.code,
      M.environment.co2.code, M.groups.agriculture, M.groups.rural, M.groups.employers, M.groups.armedForces,
      ...M.groups.youthBands, M.groups.adultTotal, "SP.POP.TOTL",
    ]) expect(all, c).toContain(c);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("output contract", () => {
  const result = ok(base());
  const data = result.data;
  it("parses with CountryData and has all 15 stats and 5 groups", () => {
    expect(CountryData.safeParse(data).success).toBe(true);
    expect(Object.keys(data.baseline).sort()).toEqual([...STAT_KEYS].sort());
    expect(Object.keys(data.baselineSrc).sort()).toEqual([...STAT_KEYS].sort());
    expect(Object.keys(data.groupShares).sort()).toEqual([...GROUP_KEYS].sort());
  });
  it("group shares sum to 1 and are within [0, 1]", () => {
    const total = GROUP_KEYS.reduce((a, g) => a + data.groupShares[g], 0);
    expect(total).toBeCloseTo(1, 12);
    for (const g of GROUP_KEYS) {
      expect(data.groupShares[g]).toBeGreaterThanOrEqual(0);
      expect(data.groupShares[g]).toBeLessThanOrEqual(1);
    }
  });
  it("baselineSrc cites the main code with its year and raw value", () => {
    expect(data.baselineSrc.gdpGrowth).toEqual({ sourceId: "wdi.NY.GDP.MKTP.KD.ZG", year: 2023, raw: 3.5 });
    expect(data.baselineSrc.corruption).toEqual({ sourceId: "wgi.GOV_WGI_CC_SC", year: 2023, raw: 70 });
    expect(data.baselineSrc.health).toEqual({ sourceId: "wdi.SP.DYN.LE00.IN", year: 2023, raw: 72.5 });
    expect(data.baselineSrc.education).toEqual({ sourceId: "wdi.SE.SEC.ENRR", year: 2023, raw: 90 });
    expect(data.baselineSrc.crime).toEqual({ sourceId: "wdi.VC.IHR.PSRC.P5", year: 2023, raw: 6 });
    expect(data.baselineSrc.environment).toEqual({ sourceId: "wdi.EN.ATM.PM25.MC.M3", year: 2023, raw: 25 });
    expect(data.groupSharesSrc.farmers).toEqual({ sourceId: "wdi.SL.AGR.EMPL.ZS", year: 2023, raw: 30 });
    expect(data.groupSharesSrc.business).toEqual({ sourceId: "wdi.SL.EMP.MPYR.ZS", year: 2023, raw: 4 });
    expect(data.groupSharesSrc.military).toEqual({ sourceId: "wdi.MS.MIL.TOTL.TF.ZS", year: 2023, raw: 1 });
    expect(data.groupSharesSrc.youth).toEqual({ sourceId: "wdi.SP.POP.2024.MA.5Y", year: 2023, raw: 8 });
    expect(data.groupSharesSrc.urban).toEqual({ sourceId: "wdi.SP.RUR.TOTL.ZS", year: 2023, raw: 40 });
  });
  it("composite stats record their other codes", () => {
    expect(result.composites.health).toEqual(["SH.UHC.SRVS.CV.XD"]);
    expect(result.composites.education).toEqual(["HD.HCI.OVRL"]);
    expect(result.composites.environment).toEqual(["AG.LND.FRST.ZS", "EN.GHG.CO2.PC.CE.AR5"]);
    expect(result.composites.crime).toEqual([]);
  });
  it("every cited sourceId exists in data/sources/sources.yaml", () => {
    const ids = new Set<string>();
    for (const k of STAT_KEYS) ids.add(data.baselineSrc[k].sourceId);
    for (const g of GROUP_KEYS) ids.add(data.groupSharesSrc[g].sourceId);
    for (const id of ids) expect(sourceIds.has(id), id).toBe(true);
  });
});

describe("sources.yaml additions", () => {
  const all = parse(readFileSync(join(root, "data/sources/sources.yaml"), "utf8")) as unknown[];
  const sources = all.map((s) => Source.parse(s));
  const newCodes = ["HD.HCI.OVRL", "SP.RUR.TOTL.ZS", ...M.groups.youthBands, "SP.POP.1564.TO.ZS"];
  it("has an unverified CC BY 4.0 entry with the standard note for each new code", () => {
    for (const c of newCodes) {
      const s = sources.find((x) => x.indicatorCode === c);
      expect(s, c).toBeTruthy();
      expect(s!.id).toBe(`wdi.${c}`);
      expect(s!.license).toBe("CC BY 4.0");
      expect(s!.verifiedBy).toBeNull();
      expect(s!.note).toBe("code not yet confirmed by a live API call");
    }
  });
  it("every code in DATA_MAPPING has a source entry", () => {
    for (const c of [...plannedCodes().required, ...plannedCodes().optional].filter((x) => x !== "SP.POP.TOTL")) {
      expect(sources.find((x) => x.indicatorCode === c), c).toBeTruthy();
    }
  });
});

describe("Thai names", () => {
  it("every MVP country has one", () => {
    for (const iso of MVP_COUNTRIES.value) expect(THAI_NAMES[iso], iso).toBeTruthy();
  });
});
