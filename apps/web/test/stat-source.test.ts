import { describe, it, expect } from "vitest";
import type { CountryData, Source } from "@ps/shared";
import { describeStatSource } from "../lib/stat-source";
import { FIXTURE_COUNTRY, FIXTURE_SOURCE } from "../dev/fixture-country";
import { canSubmit, FREE_TEXT_MAX, FREE_TEXT_MIN } from "../lib/selection";
import { formatStat } from "../lib/format";

const dataset: Source = {
  id: "wdi.TEST", kind: "dataset", title: "GDP growth (annual %)", publisher: "World Bank WDI",
  indicatorCode: "NY.GDP.MKTP.KD.ZG", url: "https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG",
  license: "CC BY 4.0", commercialOk: true, coverage: null, retrievedAt: null, verifiedBy: null, note: null,
};

function country(over: Partial<CountryData["baselineSrc"]>): CountryData {
  return { ...FIXTURE_COUNTRY, baselineSrc: { ...FIXTURE_COUNTRY.baselineSrc, ...over } };
}

describe("describeStatSource", () => {
  it("shows dataset title, code, year, license and link for a real dataset", () => {
    const c = country({ gdpGrowth: { sourceId: "wdi.TEST", year: 2022, raw: 2.5 } });
    const d = describeStatSource("gdpGrowth", c, [dataset, FIXTURE_SOURCE]);
    expect(d).toMatchObject({
      kind: "dataset", title: "GDP growth (annual %)", indicatorCode: "NY.GDP.MKTP.KD.ZG", year: 2022,
      raw: 2.5, license: "CC BY 4.0", url: "https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG",
    });
  });

  it("falls back to a design value with the rationale from design-params", () => {
    const design: Source = { ...dataset, id: "design.unsourced", kind: "design", indicatorCode: null, license: "design" };
    const c = country({ parliament: { sourceId: "design.unsourced", year: null, raw: null } });
    const d = describeStatSource("parliament", c, [design]);
    expect(d.kind).toBe("design");
    if (d.kind === "design") expect(d.rationale).toMatch(/Placeholders/);
  });

  it("treats a source id missing from the registry as a design value", () => {
    const c = country({ health: { sourceId: "missing.id", year: null, raw: null } });
    expect(describeStatSource("health", c, []).kind).toBe("design");
  });

  it("flags the dev fixture", () => {
    const d = describeStatSource("inflation", FIXTURE_COUNTRY, [FIXTURE_SOURCE]);
    expect(d.kind).toBe("fixture");
  });

  it("the budget stat is always a design value explained by the discretionary budget param", () => {
    const d = describeStatSource("budget", FIXTURE_COUNTRY, [FIXTURE_SOURCE]);
    expect(d.kind).toBe("design");
    if (d.kind === "design") expect(d.rationale).toMatch(/room for new policy/);
  });
});

describe("canSubmit", () => {
  it("needs a preset choice or enough free text", () => {
    expect(canSubmit({ kind: "none" })).toBe(false);
    expect(canSubmit({ kind: "preset", choiceId: "a" })).toBe(true);
    expect(canSubmit({ kind: "free", text: "สั้นไป" })).toBe(false);
    expect(canSubmit({ kind: "free", text: "ก".repeat(FREE_TEXT_MIN) })).toBe(true);
    expect(canSubmit({ kind: "free", text: " ".repeat(30) + "ก" })).toBe(false);
    expect(canSubmit({ kind: "free", text: "ก".repeat(FREE_TEXT_MAX) })).toBe(true);
    expect(canSubmit({ kind: "free", text: "ก".repeat(FREE_TEXT_MAX + 1) })).toBe(false);
  });
});

describe("formatStat", () => {
  it("adds units", () => {
    expect(formatStat("gdpGrowth", 2.345)).toBe("2.3%");
    expect(formatStat("debt", 70)).toBe("70.0% ของ GDP");
    expect(formatStat("health", 55.04)).toBe("55.0");
    expect(formatStat("inequality", 42)).toBe("42.0");
  });

  it("formats signed deltas without a misleading -0.0", async () => {
    const { formatDelta } = await import("../lib/format");
    expect(formatDelta("inflation", 1.5)).toBe("+1.5%");
    expect(formatDelta("health", -2)).toBe("−2.0");
    expect(formatDelta("gdpGrowth", -0.01)).toBe("−0.01%");
  });
});
