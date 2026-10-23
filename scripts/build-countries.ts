// Builds data/countries/<ISO3>.json (contract CountryData) for MVP_COUNTRIES from World Bank data, using DATA_MAPPING.
// Usage:
//   pnpm tsx scripts/build-countries.ts --dry                         print the planned requests, no network
//   pnpm tsx scripts/build-countries.ts                               real run (needs api.worldbank.org)
//   pnpm tsx scripts/build-countries.ts --save-raw <dir>              also store every raw response
//   pnpm tsx scripts/build-countries.ts --fixtures <dir> --out <dir>  read saved responses; --out is required
//   --countries THA,VNM  limit to some countries     --out <dir>  output folder (default data/countries)
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DATA_MAPPING, MVP_COUNTRIES } from "@ps/shared";
import { mapCountry, plannedCodes, type Observations } from "./lib/mapping";
import {
  countryUrl, fixtureSource, indicatorUrl, networkSource, newestYear, parseCountryResponse, parseIndicatorResponse,
  savingSource, selectObservation, type DataSource, type Row,
} from "./lib/worldbank";

/** The run fails when fewer countries than this pass. */
export const MIN_PASSING = 6;

const repoRoot = resolve(import.meta.dirname, "..");
const DEFAULT_OUT = join(repoRoot, "data", "countries");

export type CountryReport = {
  iso3: string;
  status: "ok" | "skipped";
  reasons: string[];
  /** Newest year in this country's responses; values older than maxDataAgeYears before it are rejected. */
  refYear: number | null;
  codes: Record<string, { year: number; value: number }>;
  rejected: Record<string, string>;
  notes: string[];
  /** Other codes behind each composite stat (the baselineSrc cites only the first). */
  composites: Record<string, string[]>;
};
export type BuildReport = {
  mode: "network" | "fixtures";
  minPassing: number;
  passed: number;
  skipped: number;
  countries: CountryReport[];
};

/** Every request a real run makes, in order. */
export function planRequests(iso3s: string[]): string[] {
  const { required, optional } = plannedCodes();
  return iso3s.flatMap((iso3) => [countryUrl(iso3), ...[...required, ...optional].map((c) => indicatorUrl(iso3, c))]);
}

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

async function buildOne(iso3: string, source: DataSource): Promise<{ report: CountryReport; data?: unknown }> {
  const report: CountryReport = { iso3, status: "skipped", reasons: [], refYear: null, codes: {}, rejected: {}, notes: [], composites: {} };
  const codes = [...plannedCodes().required, ...plannedCodes().optional];

  let meta: { nameEn: string; region: string };
  try {
    const raw = await source.country(iso3);
    if (raw === null) {
      report.reasons.push("no country metadata response");
      return { report };
    }
    meta = parseCountryResponse(raw);
  } catch (e) {
    report.reasons.push(`country metadata failed: ${errMsg(e)}`);
    return { report };
  }

  const rows: Record<string, Row[]> = {};
  const unavailable: Record<string, string> = {};
  await Promise.all(codes.map(async (code) => {
    try {
      const raw = await source.indicator(iso3, code);
      if (raw === null) unavailable[code] = "no response";
      else rows[code] = parseIndicatorResponse(raw, iso3);
    } catch (e) {
      unavailable[code] = `request failed: ${errMsg(e)}`;
    }
  }));

  const ref = newestYear(Object.values(rows));
  report.refYear = ref;
  const observations: Observations = {};
  for (const code of codes) {
    const r = rows[code];
    if (!r) continue;
    if (ref === null) continue;
    const sel = selectObservation(r, ref, DATA_MAPPING.value.maxDataAgeYears);
    if (sel.ok) {
      observations[code] = sel.obs;
      report.codes[code] = sel.obs;
    } else {
      unavailable[code] = sel.reason;
      report.rejected[code] = sel.reason;
    }
  }

  const result = mapCountry({ iso3, nameEn: meta.nameEn, region: meta.region, observations, unavailable });
  if (!result.ok) {
    report.reasons.push(...result.reasons);
    return { report };
  }
  report.status = "ok";
  report.notes = result.notes;
  report.composites = result.composites;
  return { report, data: result.data };
}

export async function buildCountries(opts: {
  iso3s: string[];
  source: DataSource;
  outDir: string | null;
  mode: "network" | "fixtures";
}): Promise<BuildReport> {
  if (opts.outDir) mkdirSync(opts.outDir, { recursive: true });
  const countries: CountryReport[] = [];
  for (const iso3 of opts.iso3s) {
    const { report, data } = await buildOne(iso3, opts.source);
    countries.push(report);
    if (data && opts.outDir) writeFileSync(join(opts.outDir, `${iso3}.json`), JSON.stringify(data, null, 2) + "\n");
  }
  const passed = countries.filter((c) => c.status === "ok").length;
  const report: BuildReport = { mode: opts.mode, minPassing: MIN_PASSING, passed, skipped: countries.length - passed, countries };
  if (opts.outDir) writeFileSync(join(opts.outDir, "_build-report.json"), JSON.stringify(report, null, 2) + "\n");
  return report;
}

export type Args = { dry: boolean; fixtures?: string; saveRaw?: string; out?: string; countries?: string[] };

export function parseArgs(argv: string[]): Args {
  const args: Args = { dry: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = (): string => {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === "--dry") args.dry = true;
    else if (a === "--fixtures") args.fixtures = val();
    else if (a === "--save-raw") args.saveRaw = val();
    else if (a === "--out") args.out = val();
    else if (a === "--countries") args.countries = val().split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    else throw new Error(`unknown argument ${a}`);
  }
  return args;
}

export type Io = { log: (s: string) => void; error: (s: string) => void };

/** Returns the process exit code: 0 ok, 1 too few countries passed, 2 bad usage. */
export async function main(argv: string[], io: Io = { log: console.log, error: console.error }): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    io.error(errMsg(e));
    return 2;
  }
  const iso3s = args.countries ?? [...MVP_COUNTRIES.value];

  if (args.dry) {
    const urls = planRequests(iso3s);
    io.log(`DRY RUN: no network. ${urls.length} requests planned for ${iso3s.length} countries (${iso3s.join(", ")}):`);
    for (const u of urls) io.log(u);
    return 0;
  }

  const outDir = resolve(args.out ?? DEFAULT_OUT);
  if (args.fixtures) {
    if (!args.out) {
      io.error("--fixtures needs --out <dir>: fixture values are invented and must never be written to data/countries");
      return 2;
    }
    if (outDir === DEFAULT_OUT) {
      io.error("refusing to write fixture output into data/countries");
      return 2;
    }
  }

  let source: DataSource = args.fixtures ? fixtureSource(resolve(args.fixtures)) : networkSource();
  if (args.saveRaw) source = savingSource(source, resolve(args.saveRaw));
  const report = await buildCountries({ iso3s, source, outDir, mode: args.fixtures ? "fixtures" : "network" });

  for (const c of report.countries) {
    io.log(c.status === "ok" ? `ok       ${c.iso3}` : `skipped  ${c.iso3}: ${c.reasons.join(" | ")}`);
    for (const n of c.notes) io.log(`           note: ${n}`);
  }
  io.log(`${report.passed} passed, ${report.skipped} skipped; output in ${outDir}`);
  if (report.passed < MIN_PASSING) {
    io.error(`only ${report.passed} countries passed, need at least ${MIN_PASSING}`);
    return 1;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
