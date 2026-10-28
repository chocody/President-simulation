import { TRAITS, TRAIT_AVERAGING, type CountryData, type Source, type TraitKey } from "@ps/shared";
import { FIXTURE_SOURCE_ID } from "../dev/fixture-country";

export type TraitSourceInfo =
  | {
      kind: "dataset";
      /** One sentence with the raw figure, e.g. "รายได้ท่องเที่ยว 12.3% ของการส่งออก (WDI, ปี 2022)". */
      sentence: string;
      title: string; publisher: string; indicatorCode: string | null;
      year: number | null; raw: number | null; license: string; url: string; verified: boolean;
      /** True when the trait is a stand-in for what it is named after (patronage). */
      proxy: boolean;
      proxyNote: string | null;
    }
  | { kind: "fixture" }
  | { kind: "missing"; reason: string };

/** Shown next to the patronage trait everywhere: the WDI/WGI API has no clientelism index. */
export const PATRONAGE_PROXY_NOTE =
  "ค่าประมาณ (proxy) จากดัชนีหลักนิติธรรม WGI: ยิ่งหลักนิติธรรมต่ำ ค่านี้ยิ่งสูง " +
  "ไม่ได้วัดระบบอุปถัมภ์โดยตรง ดัชนีที่ตรงกว่า (V-Dem clientelism index) จะใช้ในรุ่นถัดไป";

/** Short name of the data family, from the source id prefix. */
const family = (sourceId: string): string => (sourceId.startsWith("wgi.") ? "WGI" : sourceId.startsWith("wdi.") ? "WDI" : "ข้อมูล");

const f1 = (x: number): string => x.toFixed(1);

/** What the raw figure means, in Thai, per trait. */
function describeRaw(trait: TraitKey, raw: number): string {
  switch (trait) {
    case "tourism": return `รายได้ท่องเที่ยว ${f1(raw)}% ของการส่งออก`;
    case "agriculture": return `ภาคเกษตรเป็น ${f1(raw)}% ของ GDP`;
    case "resources": return `ค่าเช่าทรัพยากรธรรมชาติ ${f1(raw)}% ของ GDP`;
    case "openness": return `การส่งออกสินค้าและบริการ ${f1(raw)}% ของ GDP`;
    case "ruleOfLaw": return `คะแนนหลักนิติธรรม ${f1(raw)} จาก 100`;
    case "govEffectiveness": return `คะแนนประสิทธิภาพของรัฐ ${f1(raw)} จาก 100`;
    case "patronage": return `ค่าประมาณจากคะแนนหลักนิติธรรม ${f1(raw)} จาก 100 (ยิ่งต่ำยิ่งอุปถัมภ์มาก)`;
  }
}

/** Where a trait value comes from. A trait the country has no data for says why it is absent. */
export function describeTraitSource(trait: TraitKey, country: CountryData, sources: Source[]): TraitSourceInfo {
  const prov = country.traitsSrc?.[trait];
  if (country.traits?.[trait] === undefined || !prov) {
    const rule = TRAITS.value[trait];
    return {
      kind: "missing",
      reason: rule.optional
        ? "ไม่มีข้อมูลล่าสุดของประเทศนี้ในชุดข้อมูล จึงไม่นำมาคิด (ถือเป็นค่ากลาง)"
        : "ข้อมูลของประเทศนี้ขาดหรือเก่าเกินไป จึงไม่นำมาคิด (ถือเป็นค่ากลาง)",
    };
  }
  if (prov.sourceId === FIXTURE_SOURCE_ID) return { kind: "fixture" };
  const src = sources.find((s) => s.id === prov.sourceId);
  const fam = family(prov.sourceId);
  const when = prov.year !== null ? `${fam}, เฉลี่ย ${TRAIT_AVERAGING.value.years} ปีถึงปี ${prov.year}` : fam;
  const sentence = prov.raw !== null ? `${describeRaw(trait, prov.raw)} (${when})` : `ข้อมูลจาก ${when}`;
  const proxy = trait === "patronage";
  return {
    kind: "dataset",
    sentence,
    title: src?.title ?? prov.sourceId,
    publisher: src?.publisher ?? "-",
    indicatorCode: src?.indicatorCode ?? null,
    year: prov.year,
    raw: prov.raw,
    license: src?.license ?? "-",
    url: src?.url ?? "",
    verified: (src?.verifiedBy ?? null) !== null,
    proxy,
    proxyNote: proxy ? PATRONAGE_PROXY_NOTE : null,
  };
}
