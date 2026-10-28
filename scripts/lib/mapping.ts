// Turns World Bank observations into a CountryData record by applying DATA_MAPPING from design-params.
// Pure: no I/O. A country missing a required code is skipped, never filled with a guess.
import {
  CountryData, DATA_MAPPING, DISCRETIONARY_BUDGET_PCT_GDP, GROUP_KEYS, STAT_KEYS, STAT_RANGE, TRAITS, TRAIT_KEYS, UNSOURCED_DEFAULTS,
  type GroupKey, type Provenance, type StatKey, type TraitKey,
} from "@ps/shared";
import type { Observation } from "./worldbank";

const M = DATA_MAPPING.value;

export const POPULATION_CODE = "SP.POP.TOTL";

/** Fixed Thai names for the MVP countries (MVP_COUNTRIES in design-params). */
export const THAI_NAMES: Record<string, string> = {
  THA: "ประเทศไทย",
  VNM: "เวียดนาม",
  IDN: "อินโดนีเซีย",
  IND: "อินเดีย",
  NGA: "ไนจีเรีย",
  KEN: "เคนยา",
  BRA: "บราซิล",
  MEX: "เม็กซิโก",
  POL: "โปแลนด์",
  DEU: "เยอรมนี",
};

/** Required codes skip the country when missing; optional ones have a documented fallback or are left out (traits). */
export function plannedCodes(): { required: string[]; optional: string[] } {
  const required = [
    POPULATION_CODE,
    ...Object.entries(M.direct).filter(([k]) => !M.optionalDirect.includes(k as StatKey)).map(([, d]) => d!.code),
    M.health.lifeExpectancy.code,
    M.education.enrollment.code,
    M.crime.code,
    M.environment.pm25.code, M.environment.forest.code, M.environment.co2.code,
    M.groups.agriculture, M.groups.rural, M.groups.employers,
    ...M.groups.youthBands, M.groups.adultTotal,
  ];
  // Trait codes never skip a country: a trait without data is left out of `traits` and noted in the report.
  const optional = [...new Set([
    M.education.hci.code, M.groups.armedForces, M.health.uhc.code,
    ...M.optionalDirect.map((k) => M.direct[k]!.code),
    ...TRAIT_KEYS.map((k) => TRAITS.value[k].code),
  ])].filter((c) => !required.includes(c));
  return { required, optional };
}

/** Source id for a code: WGI governance codes are "wgi.*", everything else "wdi.*". */
export const sourceIdFor = (code: string): string => (code.startsWith("GOV_WGI_") ? `wgi.${code}` : `wdi.${code}`);

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** Raw a -> 0 and raw b -> 100, clamped to 0..100 (works in either direction). */
export function linear(x: number, [a, b]: [number, number]): number {
  return clamp(((x - a) / (b - a)) * 100, 0, 100);
}

const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;

export type Observations = Record<string, Observation | undefined>;

/**
 * Traits from TRAITS: each is its indicator rescaled by `linear` (reversed when `invert`), with the code's source,
 * year and raw value. A trait whose code has no observation is left out and explained in `notes`.
 */
export function mapTraits(
  obs: Observations,
  unavailable: Record<string, string> = {},
): { traits: Partial<Record<TraitKey, number>>; traitsSrc: Partial<Record<TraitKey, Provenance>>; notes: string[] } {
  const traits: Partial<Record<TraitKey, number>> = {};
  const traitsSrc: Partial<Record<TraitKey, Provenance>> = {};
  const notes: string[] = [];
  for (const key of TRAIT_KEYS) {
    const rule = TRAITS.value[key];
    const o = obs[rule.code];
    if (!o) {
      notes.push(`trait ${key}: ${rule.code} unavailable (${unavailable[rule.code] ?? "no observation"}), ${rule.optional ? "optional trait" : "trait"} left out`);
      continue;
    }
    const scaled = linear(o.value, rule.linear);
    traits[key] = rule.invert ? 100 - scaled : scaled;
    traitsSrc[key] = { sourceId: sourceIdFor(rule.code), year: o.year, raw: o.value };
  }
  return { traits, traitsSrc, notes };
}

export type MapInput = {
  iso3: string;
  nameEn: string;
  region: string;
  observations: Observations;
  /** Why a code has no observation (no data, too old, no response). Only used to explain skips. */
  unavailable?: Record<string, string>;
};

export type MapResult =
  | { ok: true; data: CountryData; notes: string[]; composites: Record<string, string[]> }
  | { ok: false; reasons: string[] };

export function mapCountry(input: MapInput): MapResult {
  const { iso3, observations: obs } = input;
  const reasons: string[] = [];
  const notes: string[] = [];
  const composites: Record<string, string[]> = {};

  const need = (code: string, usedFor: string): Observation => {
    const o = obs[code];
    if (!o) {
      reasons.push(`required code ${code} (${usedFor}) unavailable: ${input.unavailable?.[code] ?? "no observation"}`);
      return { year: 0, value: NaN };
    }
    return o;
  };
  const prov = (code: string, o: Observation): Provenance => ({ sourceId: sourceIdFor(code), year: o.year, raw: o.value });
  const design = (id: "design.unsourced" | "design.budget"): Provenance => ({ sourceId: id, year: null, raw: null });

  const thai = THAI_NAMES[iso3];
  if (!thai) reasons.push(`no Thai name for ${iso3} in THAI_NAMES`);

  const population = need(POPULATION_CODE, "population");

  const baseline: Partial<Record<StatKey, number>> = {};
  const baselineSrc: Partial<Record<StatKey, Provenance>> = {};
  const setStat = (key: StatKey, value: number, src: Provenance): void => {
    const [lo, hi] = STAT_RANGE[key];
    const c = clamp(value, lo, hi);
    if (c !== value) notes.push(`${key}: ${value} clamped to ${c} (STAT_RANGE ${lo}..${hi})`);
    baseline[key] = c;
    baselineSrc[key] = src;
  };

  // direct stats
  for (const [key, rule] of Object.entries(M.direct) as [StatKey, { code: string; transform: "identity" | "100-minus" }][]) {
    if (!obs[rule.code] && M.optionalDirect.includes(key) && key in UNSOURCED_DEFAULTS.value) {
      notes.push(`${key}: ${rule.code} unavailable (${input.unavailable?.[rule.code] ?? "no observation"}), design value used`);
      setStat(key, UNSOURCED_DEFAULTS.value[key as keyof typeof UNSOURCED_DEFAULTS.value], design("design.unsourced"));
      continue;
    }
    const o = need(rule.code, key);
    setStat(key, rule.transform === "100-minus" ? 100 - o.value : o.value, prov(rule.code, o));
  }

  // health = mean(life expectancy scaled, UHC index)
  {
    const le = need(M.health.lifeExpectancy.code, "health");
    const parts = [linear(le.value, M.health.lifeExpectancy.linear)];
    const uhc = obs[M.health.uhc.code];
    if (uhc) parts.push(clamp(uhc.value, 0, 100));
    else notes.push(`health: UHC index (${M.health.uhc.code}) not available, life expectancy alone used`);
    setStat("health", mean(parts), prov(M.health.lifeExpectancy.code, le));
    composites.health = uhc ? [M.health.uhc.code] : [];
  }

  // education = mean(enrolment capped, HCI x scale), or enrolment alone
  {
    const enr = need(M.education.enrollment.code, "education");
    const parts = [clamp(enr.value, 0, M.education.enrollment.cap)];
    const hci = obs[M.education.hci.code];
    if (hci) parts.push(clamp(hci.value * M.education.hci.scale, 0, 100));
    else notes.push(`education: HCI (${M.education.hci.code}) not available, enrolment alone used`);
    setStat("education", mean(parts), prov(M.education.enrollment.code, enr));
    composites.education = hci ? [M.education.hci.code] : [];
  }

  // crime
  {
    const h = need(M.crime.code, "crime");
    setStat("crime", linear(h.value, M.crime.linear), prov(M.crime.code, h));
    composites.crime = [];
  }

  // environment = mean(PM2.5, forest, CO2)
  {
    const pm = need(M.environment.pm25.code, "environment");
    const fo = need(M.environment.forest.code, "environment");
    const co = need(M.environment.co2.code, "environment");
    setStat("environment", mean([
      linear(pm.value, M.environment.pm25.linear),
      linear(fo.value, M.environment.forest.linear),
      linear(co.value, M.environment.co2.linear),
    ]), prov(M.environment.pm25.code, pm));
    composites.environment = [M.environment.forest.code, M.environment.co2.code];
  }

  // design values
  setStat("budget", DISCRETIONARY_BUDGET_PCT_GDP.value.normal, design("design.budget"));
  setStat("parliament", UNSOURCED_DEFAULTS.value.parliament, design("design.unsourced"));
  setStat("foreignRelations", UNSOURCED_DEFAULTS.value.foreignRelations, design("design.unsourced"));

  // ---------- groups ----------
  const g = M.groups;
  const agri = need(g.agriculture, "farmers");
  const rural = need(g.rural, "urban");
  const emp = need(g.employers, "business");
  const bands = g.youthBands.map((c) => need(c, "youth"));
  const adult = need(g.adultTotal, "youth");
  const arm = obs[g.armedForces];

  if (reasons.length > 0) return { ok: false, reasons };

  // Youth: ages 20-29 as a share of ages 15-64, in percent. The WDI bands are % of their own sex's population,
  // so the four bands are halved (equal sex split assumed) to get % of the total population.
  const bandSum = bands.reduce((s, b) => s + b.value, 0);
  if (!(adult.value > 0)) return { ok: false, reasons: [`required code ${g.adultTotal} (youth) is ${adult.value}, cannot divide`] };
  const youthW = (bandSum / 2 / adult.value) * 100;

  let militaryW = 0;
  if (arm) militaryW = Math.max(0, arm.value);
  else notes.push(`military: armed forces share (${g.armedForces}) not available, share set to 0`);

  const w = {
    farmers: Math.max(0, agri.value),
    business: Math.max(0, emp.value),
    military: militaryW,
    youth: Math.max(0, youthW),
  };
  const urbanW = Math.max(0, 100 - (w.farmers + w.business + w.military + w.youth));  // urban = remainder
  const weights: Record<GroupKey, number> = { ...w, urban: urbanW };
  const total = GROUP_KEYS.reduce((s, k) => s + weights[k], 0);
  const groupShares = Object.fromEntries(GROUP_KEYS.map((k) => [k, weights[k] / total])) as Record<GroupKey, number>;
  const groupSharesSrc: Record<GroupKey, Provenance> = {
    farmers: prov(g.agriculture, agri),
    business: prov(g.employers, emp),
    military: arm ? prov(g.armedForces, arm) : design("design.unsourced"),
    youth: prov(g.youthBands[0]!, bands[0]!),
    urban: prov(g.rural, rural),   // urban is the remainder; the rural share is recorded as the supporting figure
  };
  composites.youth = [...g.youthBands.slice(1), g.adultTotal];
  composites.urban = [];

  const t = mapTraits(obs, input.unavailable);
  notes.push(...t.notes);
  const hasTraits = Object.keys(t.traits).length > 0;

  const candidate = {
    iso3,
    nameTh: thai!,
    nameEn: input.nameEn,
    region: input.region,
    population: population.value,
    baseline,
    baselineSrc,
    groupShares,
    groupSharesSrc,
    ...(hasTraits ? { traits: t.traits, traitsSrc: t.traitsSrc } : {}),
  };
  const parsed = CountryData.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, reasons: [`output failed CountryData: ${parsed.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`] };
  }
  for (const k of STAT_KEYS) if (!(k in parsed.data.baseline)) return { ok: false, reasons: [`stat ${k} missing`] };
  return { ok: true, data: parsed.data, notes, composites };
}
