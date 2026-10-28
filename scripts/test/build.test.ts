import { describe, it, expect } from "vitest";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { CountryData, GROUP_KEYS, MVP_COUNTRIES, STAT_KEYS } from "@ps/shared";
import { buildCountries, main, parseArgs, planRequests, MIN_PASSING } from "../build-countries";
import { fixtureSource } from "../lib/worldbank";
import { plannedCodes } from "../lib/mapping";

// End-to-end tests on the labelled TEST FIXTURE responses in scripts/test/fixtures/wb (values invented).
const root = join(import.meta.dirname, "..", "..");
const fixturesDir = join(import.meta.dirname, "fixtures", "wb");
const sourceIds = new Set((parse(readFileSync(join(root, "data/sources/sources.yaml"), "utf8")) as { id: string }[]).map((s) => s.id));
const tmp = () => mkdtempSync(join(tmpdir(), "ps-countries-"));
const capture = () => {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, io: { log: (s: string) => out.push(s), error: (s: string) => err.push(s) } };
};

describe("fixtures are labelled", () => {
  it("README states these are invented test values", () => {
    const readme = readFileSync(join(fixturesDir, "README.md"), "utf8");
    expect(readme).toContain("TEST FIXTURE — shape copied from the API docs, values invented");
  });
  it("every fixture country name is labelled", () => {
    for (const iso of MVP_COUNTRIES.value) {
      const raw = readFileSync(join(fixturesDir, iso, "_country.json"), "utf8");
      expect(raw, iso).toContain("TEST FIXTURE");
    }
  });
});

describe("planRequests (dry run)", () => {
  it("lists one country request and one request per code for each country", () => {
    const urls = planRequests(["THA", "VNM"]);
    const codes = [...plannedCodes().required, ...plannedCodes().optional];
    expect(urls.length).toBe(2 * (1 + codes.length));
    expect(urls).toContain("https://api.worldbank.org/v2/country/THA?format=json");
    expect(urls).toContain("https://api.worldbank.org/v2/country/VNM/indicator/SP.POP.TOTL?format=json&mrv=10&per_page=100");
    expect(urls.every((u) => u.startsWith("https://api.worldbank.org/v2/country/"))).toBe(true);
  });
});

const outDir = tmp();
const report = await buildCountries({ iso3s: [...MVP_COUNTRIES.value], source: fixtureSource(fixturesDir), outDir, mode: "fixtures" });
const passed = report.countries.filter((c) => c.status === "ok");
const skipped = report.countries.filter((c) => c.status === "skipped");

describe("buildCountries on fixtures", () => {

  it("passes at least the minimum and skips the two deliberately broken fixtures with clear reasons", () => {
    expect(passed.length).toBeGreaterThanOrEqual(MIN_PASSING);
    // MEX's stale debt now falls back to the labelled design value (debt is optional), so only KEN is skipped.
    expect(skipped.map((c) => c.iso3).sort()).toEqual(["KEN"]);
    expect(skipped.find((c) => c.iso3 === "KEN")!.reasons.join(" ")).toContain("SL.UEM.TOTL.ZS");
    const mex = JSON.parse(readFileSync(join(outDir, "MEX.json"), "utf8"));
    expect(mex.baselineSrc.debt.sourceId).toBe("design.unsourced");
  });
  it("writes one JSON per passing country, a build report, and nothing for skipped ones", () => {
    const files = readdirSync(outDir).sort();
    expect(files).toEqual([...passed.map((c) => `${c.iso3}.json`), "_build-report.json"].sort());
    const written = JSON.parse(readFileSync(join(outDir, "_build-report.json"), "utf8"));
    expect(written.mode).toBe("fixtures");
    expect(written.countries.length).toBe(MVP_COUNTRIES.value.length);
  });
  it("each output parses with CountryData, sums to 1, and cites only registered sources", () => {
    for (const c of passed) {
      const data = CountryData.parse(JSON.parse(readFileSync(join(outDir, `${c.iso3}.json`), "utf8")));
      expect(Object.keys(data.baseline).sort()).toEqual([...STAT_KEYS].sort());
      expect(GROUP_KEYS.reduce((a, g) => a + data.groupShares[g], 0)).toBeCloseTo(1, 12);
      for (const k of STAT_KEYS) expect(sourceIds.has(data.baselineSrc[k].sourceId), `${c.iso3} ${k}`).toBe(true);
      for (const g of GROUP_KEYS) expect(sourceIds.has(data.groupSharesSrc[g].sourceId), `${c.iso3} ${g}`).toBe(true);
    }
  });
  it("reports codes used with years for passing countries, and the optional fallbacks", () => {
    const tha = passed.find((c) => c.iso3 === "THA")!;
    expect(tha.codes["NY.GDP.MKTP.KD.ZG"]).toEqual({ year: 2023, value: expect.any(Number) });
    expect(tha.refYear).toBe(2023);
    const ind = passed.find((c) => c.iso3 === "IND")!;
    expect(ind.notes.join(" ")).toMatch(/HCI/);
    expect(JSON.parse(readFileSync(join(outDir, "IND.json"), "utf8")).baseline.education).toBeLessThanOrEqual(100);
    const deu = passed.find((c) => c.iso3 === "DEU")!;
    expect(deu.notes.join(" ")).toMatch(/military/i);
    expect(JSON.parse(readFileSync(join(outDir, "DEU.json"), "utf8")).groupShares.military).toBe(0);
  });
  it("uses the latest non-null value (fixture THA has a null in the newest year for one code)", () => {
    const tha = passed.find((c) => c.iso3 === "THA")!;
    expect(tha.codes["VC.IHR.PSRC.P5"]!.year).toBe(2022);
  });
});

describe("traits in buildCountries (fixtures)", () => {
  const read = (iso: string) => CountryData.parse(JSON.parse(readFileSync(join(outDir, `${iso}.json`), "utf8")));
  const rep = (iso: string) => passed.find((c) => c.iso3 === iso)!;
  it("every passing country has traits and traitsSrc that cite registered sources", () => {
    for (const c of passed) {
      const d = read(c.iso3);
      expect(Object.keys(d.traits ?? {}).length, c.iso3).toBeGreaterThanOrEqual(4);
      expect(Object.keys(d.traitsSrc ?? {}).sort(), c.iso3).toEqual(Object.keys(d.traits ?? {}).sort());
      for (const [k, p] of Object.entries(d.traitsSrc!)) {
        expect(sourceIds.has(p.sourceId), `${c.iso3} ${k}`).toBe(true);
        expect(p.year, `${c.iso3} ${k}`).not.toBeNull();
        expect(p.raw, `${c.iso3} ${k}`).not.toBeNull();
      }
      for (const v of Object.values(d.traits!)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
    }
  });
  it("THA values follow the mapping (5-year mean of fixture tourism 4.2..5 = 4.6% of exports -> 4.6/30, rule of law mean 44.4 -> patronage 55.6)", () => {
    const d = read("THA");
    expect(d.traitsSrc!.tourism!.sourceId).toBe("wdi.ST.INT.RCPT.XP.ZS");
    expect(d.traitsSrc!.tourism!.year).toBe(2023);
    expect(d.traitsSrc!.tourism!.raw).toBeCloseTo(4.6, 8);   // mean of 2019–2023 (TRAIT_AVERAGING)
    expect(d.traits!.tourism).toBeCloseTo((4.6 / 30) * 100, 8);
    expect(d.traits!.ruleOfLaw).toBeCloseTo(44.4, 8);   // fixture 5-year mean
    expect(d.traits!.patronage).toBeCloseTo(55.6, 8);
    expect(d.traitsSrc!.patronage!.sourceId).toBe("wgi.GOV_WGI_RL_SC");
    expect(rep("THA").codes["NV.AGR.TOTL.ZS"]).toEqual({ year: 2023, value: 12 });
  });
  it("a missing optional trait (POL tourism) is left out, with a build-report note", () => {
    const d = read("POL");
    expect("tourism" in d.traits!).toBe(false);
    expect("tourism" in d.traitsSrc!).toBe(false);
    expect(rep("POL").notes.join("\n")).toMatch(/trait tourism: ST\.INT\.RCPT\.XP\.ZS unavailable.*left out/);
  });
  it("a missing trait response (IDN government effectiveness) skips nothing", () => {
    expect(rep("IDN").status).toBe("ok");
    const d = read("IDN");
    expect("govEffectiveness" in d.traits!).toBe(false);
    expect(d.traits!.ruleOfLaw).toBeDefined();
    expect(rep("IDN").notes.join("\n")).toMatch(/trait govEffectiveness: GOV_WGI_GE_SC unavailable \(no response\)/);
  });
  it("trait values older than the age limit are rejected like stats (VNM resource rents from 2012)", () => {
    expect(rep("VNM").status).toBe("ok");
    expect("resources" in read("VNM").traits!).toBe(false);
    expect(rep("VNM").rejected["NY.GDP.TOTL.RT.ZS"]).toMatch(/2012/);
    expect(rep("VNM").notes.join("\n")).toMatch(/trait resources: NY\.GDP\.TOTL\.RT\.ZS unavailable \(latest value is from 2012/);
  });
  it("the shared rule-of-law code is requested once per country", () => {
    const urls = planRequests(["THA"]).filter((u) => u.includes("GOV_WGI_RL_SC"));
    expect(urls.length).toBe(1);
  });
});

describe("parseArgs and main", () => {
  it("parses flags", () => {
    expect(parseArgs(["--dry"]).dry).toBe(true);
    const a = parseArgs(["--fixtures", "f", "--save-raw", "r", "--out", "o", "--countries", "THA,VNM"]);
    expect(a).toMatchObject({ fixtures: "f", saveRaw: "r", out: "o", countries: ["THA", "VNM"], dry: false });
  });
  it("--dry prints the planned requests, writes nothing and exits 0", async () => {
    const c = capture();
    const code = await main(["--dry"], c.io);
    expect(code).toBe(0);
    expect(c.out.filter((l) => l.includes("api.worldbank.org")).length).toBe(planRequests([...MVP_COUNTRIES.value]).length);
  });
  it("--fixtures run exits 0 with enough passing countries", async () => {
    const outDir = tmp();
    const c = capture();
    expect(await main(["--fixtures", fixturesDir, "--out", outDir], c.io)).toBe(0);
    expect(existsSync(join(outDir, "THA.json"))).toBe(true);
  });
  it("exits non-zero when fewer than 6 countries pass", async () => {
    const outDir = tmp();
    const c = capture();
    expect(await main(["--fixtures", fixturesDir, "--out", outDir, "--countries", "THA,VNM,IDN,KEN"], c.io)).toBe(1);
  });
  it("refuses --fixtures without --out, and refuses to write fixture output into data/countries", async () => {
    const c1 = capture();
    expect(await main(["--fixtures", fixturesDir], c1.io)).toBe(2);
    const c2 = capture();
    expect(await main(["--fixtures", fixturesDir, "--out", join(root, "data/countries")], c2.io)).toBe(2);
    expect(c2.err.join(" ")).toMatch(/data\/countries/);
  });
});

describe("repository hygiene", () => {
  it("every committed country file parses as CountryData (report files start with _)", () => {
    const dir = join(root, "data/countries");
    const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_")) : [];
    for (const f of files) expect(() => CountryData.parse(JSON.parse(readFileSync(join(dir, f), "utf8"))), f).not.toThrow();
  });
});
