import {
  DISCRETIONARY_BUDGET_PCT_GDP, UNSOURCED_DEFAULTS,
  type CountryData, type Source, type StatKey,
} from "@ps/shared";

import { FIXTURE_SOURCE_ID } from "../dev/fixture-country";

export type StatSourceInfo =
  | {
      kind: "dataset";
      title: string; publisher: string; indicatorCode: string | null;
      year: number | null; raw: number | null; license: string; url: string; verified: boolean;
    }
  | { kind: "design"; rationale: string }
  | { kind: "fixture" };

/** Rationale shown for values that have no real data source ("ค่าออกแบบ"). */
function designRationale(stat: StatKey): string {
  if (stat === "budget") return DISCRETIONARY_BUDGET_PCT_GDP.rationale;
  if (stat === "parliament" || stat === "foreignRelations") return UNSOURCED_DEFAULTS.rationale;
  return "ค่านี้เป็นค่าออกแบบของเกม ยังไม่มีแหล่งข้อมูลจริง";
}

/**
 * Where the displayed starting value of a stat comes from. The budget stat is always a design value:
 * the engine sets it from the difficulty's yearly room for new policy, whatever the country's baseline says.
 */
export function describeStatSource(stat: StatKey, country: CountryData, sources: Source[]): StatSourceInfo {
  if (stat === "budget") return { kind: "design", rationale: designRationale(stat) };
  const prov = country.baselineSrc[stat];
  if (prov.sourceId === FIXTURE_SOURCE_ID) return { kind: "fixture" };
  const src = sources.find((s) => s.id === prov.sourceId);
  if (!src || src.kind === "design") return { kind: "design", rationale: designRationale(stat) };
  return {
    kind: "dataset",
    title: src.title,
    publisher: src.publisher,
    indicatorCode: src.indicatorCode,
    year: prov.year,
    raw: prov.raw,
    license: src.license,
    url: src.url,
    verified: src.verifiedBy !== null,
  };
}
