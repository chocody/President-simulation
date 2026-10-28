import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  countryUrl, indicatorUrl, parseCountryResponse, parseIndicatorResponse,
  latestNonNull, newestYear, selectObservation, averageRecent, fixtureSource, savingSource, networkSource,
  type DataSource,
} from "../lib/worldbank";

// All responses in this file are TEST data with invented values.
const row = (date: string, value: number | null) => ({
  indicator: { id: "TEST.CODE", value: "test" }, country: { id: "XX", value: "Testland" },
  countryiso3code: "THA", date, value, unit: "", obs_status: "", decimal: 1,
});
const resp = (rows: unknown[] | null) => [{ page: 1, pages: 1, per_page: 100, total: rows?.length ?? 0 }, rows];

describe("request URLs", () => {
  it("indicator URL follows the spec", () => {
    expect(indicatorUrl("THA", "SP.POP.TOTL")).toBe(
      "https://api.worldbank.org/v2/country/THA/indicator/SP.POP.TOTL?format=json&mrv=10&per_page=100",
    );
  });
  it("country URL follows the spec", () => {
    expect(countryUrl("THA")).toBe("https://api.worldbank.org/v2/country/THA?format=json");
  });
});

describe("parseIndicatorResponse", () => {
  it("reads rows into {year, value}", () => {
    expect(parseIndicatorResponse(resp([row("2023", 1.5), row("2022", null)]), "THA")).toEqual([
      { year: 2023, value: 1.5 }, { year: 2022, value: null },
    ]);
  });
  it("a null row list means no data", () => {
    expect(parseIndicatorResponse(resp(null), "THA")).toEqual([]);
  });
  it("throws on an API error payload", () => {
    const err = [{ message: [{ id: "120", key: "Invalid value", value: "The provided parameter value is not valid" }] }];
    expect(() => parseIndicatorResponse(err, "THA")).toThrow(/not valid/);
  });
  it("throws on a different country in the rows", () => {
    expect(() => parseIndicatorResponse(resp([{ ...row("2023", 1), countryiso3code: "VNM" }]), "THA")).toThrow(/VNM/);
  });
  it("throws on a malformed body", () => {
    expect(() => parseIndicatorResponse({ nope: true }, "THA")).toThrow();
    expect(() => parseIndicatorResponse(resp([{ date: "abc", value: 1, countryiso3code: "THA" }]), "THA")).toThrow(/date/);
  });
});

describe("parseCountryResponse", () => {
  it("reads name and region", () => {
    const raw = [{ page: 1 }, [{ id: "THA", name: "Testland", region: { id: "EAS", value: "Test Region" } }]];
    expect(parseCountryResponse(raw)).toEqual({ nameEn: "Testland", region: "Test Region" });
  });
  it("throws when the country is missing", () => {
    expect(() => parseCountryResponse([{ page: 1 }, null])).toThrow();
  });
});

describe("latestNonNull", () => {
  it("picks the newest year that has a value, whatever the row order", () => {
    const rows = [{ year: 2020, value: 5 }, { year: 2023, value: null }, { year: 2022, value: 7 }, { year: 2021, value: 6 }];
    expect(latestNonNull(rows)).toEqual({ year: 2022, value: 7 });
  });
  it("keeps zero as a real value", () => {
    expect(latestNonNull([{ year: 2023, value: 0 }, { year: 2022, value: 3 }])).toEqual({ year: 2023, value: 0 });
  });
  it("returns null when all values are null or there are no rows", () => {
    expect(latestNonNull([{ year: 2023, value: null }])).toBeNull();
    expect(latestNonNull([])).toBeNull();
  });
});

describe("age cut-off", () => {
  it("newestYear is the newest date across responses, null values included", () => {
    expect(newestYear([[{ year: 2021, value: 1 }], [{ year: 2024, value: null }, { year: 2020, value: 2 }]])).toBe(2024);
    expect(newestYear([[], []])).toBeNull();
  });
  it("accepts a value exactly maxDataAgeYears old", () => {
    const r = selectObservation([{ year: 2015, value: 9 }], 2023, 8);
    expect(r).toEqual({ ok: true, obs: { year: 2015, value: 9 } });
  });
  it("rejects a value older than maxDataAgeYears", () => {
    const r = selectObservation([{ year: 2014, value: 9 }, { year: 2013, value: 8 }], 2023, 8);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/2014.*9 years/);
  });
  it("reports no data separately", () => {
    const r = selectObservation([{ year: 2023, value: null }], 2023, 8);
    expect(r).toEqual({ ok: false, reason: "no non-null value in the response" });
  });
});

describe("data sources", () => {
  it("fixtureSource reads <dir>/<ISO3>/<code>.json and _country.json, and returns null when absent", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wbfx-"));
    mkdirSync(join(dir, "THA"));
    writeFileSync(join(dir, "THA", "A.B.json"), JSON.stringify(resp([row("2023", 1)])));
    writeFileSync(join(dir, "THA", "_country.json"), JSON.stringify([{}, [{ name: "T", region: { value: "R" } }]]));
    const src = fixtureSource(dir);
    expect(await src.indicator("THA", "A.B")).toEqual(resp([row("2023", 1)]));
    expect(await src.country("THA")).not.toBeNull();
    expect(await src.indicator("THA", "NOPE")).toBeNull();
    expect(await src.indicator("VNM", "A.B")).toBeNull();
  });
  it("savingSource stores what it passes through in the fixture layout", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wbraw-"));
    const inner: DataSource = {
      country: async () => [{}, [{ name: "T", region: { value: "R" } }]],
      indicator: async () => resp([row("2023", 2)]),
    };
    const src = savingSource(inner, dir);
    await src.country("THA");
    await src.indicator("THA", "A.B");
    expect(JSON.parse(readFileSync(join(dir, "THA", "A.B.json"), "utf8"))).toEqual(resp([row("2023", 2)]));
    expect(JSON.parse(readFileSync(join(dir, "THA", "_country.json"), "utf8"))).toBeTruthy();
    // and the saved layout can be read back as fixtures
    expect(await fixtureSource(dir).indicator("THA", "A.B")).toEqual(resp([row("2023", 2)]));
  });
  it("networkSource only calls the injected fetch with the planned URL (no real network)", async () => {
    const calls: string[] = [];
    const fake = (async (url: string) => {
      calls.push(url);
      return { ok: true, status: 200, json: async () => resp([]) };
    }) as unknown as typeof fetch;
    await networkSource(fake).indicator("THA", "A.B");
    expect(calls).toEqual([indicatorUrl("THA", "A.B")]);
  });
  it("networkSource throws on an HTTP error", async () => {
    const fake = (async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch;
    await expect(networkSource(fake, { retries: 0 }).country("THA")).rejects.toThrow(/503/);
  });
});

describe("averageRecent (structural traits)", () => {
  const rows = [
    { year: 2020, value: 6 }, { year: 2019, value: 20 }, { year: 2018, value: 18 },
    { year: 2017, value: 18 }, { year: 2016, value: 18 }, { year: 2015, value: 1000 }, { year: 2014, value: null },
  ];
  it("averages the non-null values of the last N years up to the latest observation", () => {
    expect(averageRecent(rows, 5)).toEqual({ year: 2020, value: 16, years: 5 });
  });
  it("skips gaps and uses what exists inside the window", () => {
    expect(averageRecent([{ year: 2019, value: 4 }, { year: 2017, value: 8 }, { year: 2012, value: 99 }], 5))
      .toEqual({ year: 2019, value: 6, years: 2 });
  });
  it("returns null when there is no value", () => {
    expect(averageRecent([{ year: 2019, value: null }], 5)).toBeNull();
  });
});
