// World Bank API v2 access: URLs, response parsing, latest-value selection, and swappable data sources
// (network, saved fixtures, save-raw wrapper). Nothing here talks to the network unless networkSource is used.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const WB_BASE = "https://api.worldbank.org/v2";

export const indicatorUrl = (iso3: string, code: string): string =>
  `${WB_BASE}/country/${iso3}/indicator/${code}?format=json&mrv=10&per_page=100`;
export const countryUrl = (iso3: string): string => `${WB_BASE}/country/${iso3}?format=json`;

export type Row = { year: number; value: number | null };
export type Observation = { year: number; value: number };

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);

/** Throws with the API's own message when the body is an error payload: `[{ message: [{ id, key, value }] }]`. */
function throwIfApiError(raw: unknown): void {
  if (Array.isArray(raw) && raw.length === 1 && isObj(raw[0]) && Array.isArray(raw[0].message)) {
    const text = raw[0].message
      .map((m: unknown) => (isObj(m) ? String(m.value ?? m.key ?? "unknown") : "unknown"))
      .join("; ");
    throw new Error(`World Bank API error: ${text}`);
  }
}

/** `[meta, rows]` -> rows as {year, value}. A null row list means no data. */
export function parseIndicatorResponse(raw: unknown, iso3: string): Row[] {
  throwIfApiError(raw);
  if (!Array.isArray(raw) || raw.length !== 2) throw new Error("unexpected response shape: expected [meta, rows]");
  const rows: unknown = raw[1];
  if (rows === null) return [];
  if (!Array.isArray(rows)) throw new Error("unexpected response shape: rows is not a list");
  return rows.map((r: unknown, i: number) => {
    if (!isObj(r)) throw new Error(`bad row ${i}: not an object`);
    const date = r.date;
    if (typeof date !== "string" || !/^\d{4}$/.test(date)) throw new Error(`bad row ${i}: date ${JSON.stringify(date)} is not a year`);
    const value = r.value;
    if (value !== null && (typeof value !== "number" || !Number.isFinite(value))) throw new Error(`bad row ${i}: value is not a number or null`);
    const c = r.countryiso3code;
    if (typeof c === "string" && c !== "" && c !== iso3) throw new Error(`row ${i} belongs to ${c}, expected ${iso3}`);
    return { year: Number(date), value };
  });
}

export function parseCountryResponse(raw: unknown): { nameEn: string; region: string } {
  throwIfApiError(raw);
  if (!Array.isArray(raw) || raw.length !== 2 || !Array.isArray(raw[1]) || raw[1].length === 0) {
    throw new Error("country response has no country record");
  }
  const c: unknown = raw[1][0];
  if (!isObj(c) || typeof c.name !== "string" || !isObj(c.region) || typeof c.region.value !== "string") {
    throw new Error("country record has no name or region");
  }
  return { nameEn: c.name, region: c.region.value };
}

/** Newest year that has a non-null value. */
export function latestNonNull(rows: Row[]): Observation | null {
  let best: Observation | null = null;
  for (const r of rows) {
    if (r.value !== null && (best === null || r.year > best.year)) best = { year: r.year, value: r.value };
  }
  return best;
}

/** Newest date across responses (null values included): the "current" year of the response set. */
export function newestYear(responses: Row[][]): number | null {
  let best: number | null = null;
  for (const rows of responses) for (const r of rows) if (best === null || r.year > best) best = r.year;
  return best;
}

export type Selection = { ok: true; obs: Observation } | { ok: false; reason: string };

/** Latest non-null value, rejected when older than maxAgeYears relative to refYear. */
export function selectObservation(rows: Row[], refYear: number, maxAgeYears: number): Selection {
  const obs = latestNonNull(rows);
  if (!obs) return { ok: false, reason: "no non-null value in the response" };
  const age = refYear - obs.year;
  if (age > maxAgeYears) {
    return { ok: false, reason: `latest value is from ${obs.year}, ${age} years before ${refYear}; older than ${maxAgeYears} years is rejected` };
  }
  return { ok: true, obs };
}

// ---------- data sources ----------

/** Returns the parsed JSON body of a request, or null when there is nothing for it (fixture not present). */
export interface DataSource {
  country(iso3: string): Promise<unknown | null>;
  indicator(iso3: string, code: string): Promise<unknown | null>;
}

export function networkSource(
  fetchImpl: typeof fetch = fetch,
  opts: { retries?: number; timeoutMs?: number } = {},
): DataSource {
  const retries = opts.retries ?? 2;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const get = async (url: string): Promise<unknown> => {
    let last: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        return await res.json();
      } catch (e) {
        last = e;
      }
    }
    throw last instanceof Error ? last : new Error(String(last));
  };
  return {
    country: (iso3) => get(countryUrl(iso3)),
    indicator: (iso3, code) => get(indicatorUrl(iso3, code)),
  };
}

const COUNTRY_FILE = "_country.json";

/** Reads `<dir>/<ISO3>/_country.json` and `<dir>/<ISO3>/<code>.json`. */
export function fixtureSource(dir: string): DataSource {
  const read = async (file: string): Promise<unknown | null> =>
    existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  return {
    country: (iso3) => read(join(dir, iso3, COUNTRY_FILE)),
    indicator: (iso3, code) => read(join(dir, iso3, `${code}.json`)),
  };
}

/** Passes every response through and stores it in the same layout fixtureSource reads. */
export function savingSource(inner: DataSource, dir: string): DataSource {
  const save = (iso3: string, file: string, body: unknown): void => {
    if (body === null) return;
    mkdirSync(join(dir, iso3), { recursive: true });
    writeFileSync(join(dir, iso3, file), JSON.stringify(body, null, 2) + "\n");
  };
  return {
    country: async (iso3) => {
      const body = await inner.country(iso3);
      save(iso3, COUNTRY_FILE, body);
      return body;
    },
    indicator: async (iso3, code) => {
      const body = await inner.indicator(iso3, code);
      save(iso3, `${code}.json`, body);
      return body;
    },
  };
}
