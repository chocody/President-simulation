// Loads game content from the repo's data/ directory and validates it with the contract schemas.
// Server-only: reads the file system.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { Card, CountryData, Evidence, Judgment, Source } from "@ps/shared";
import { FIXTURE_COUNTRY, FIXTURE_SOURCE } from "../dev/fixture-country";

export class ContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentError";
  }
}

export interface Content {
  cards: Card[];
  evidence: Evidence[];
  sources: Source[];
  countries: CountryData[];
  /** True when DEV_FIXTURES=1: the fictional dev country is available and unjudged presets get a mock judgment. */
  devFixtures: boolean;
}

export interface LoadOptions {
  dataDir?: string;
  devFixtures?: boolean;
}

const PrejudgedEntry = z.object({
  cardId: z.string(),
  choiceId: z.string(),
  judgment: Judgment,
}).passthrough();

function files(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(ext)).sort().map((f) => join(dir, f));
}

function readYaml(file: string): unknown {
  return parseYaml(readFileSync(file, "utf8"));
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    throw new ContentError(`${file}: not valid JSON (${(e as Error).message})`);
  }
}

function parseWith<T>(schema: z.ZodType<T>, value: unknown, where: string): T {
  const r = schema.safeParse(value);
  if (!r.success) {
    const i = r.error.issues[0];
    throw new ContentError(`${where}: ${i?.path.join(".") ?? ""} ${i?.message ?? "invalid"}`);
  }
  return r.data;
}

function duplicates(ids: string[]): string[] {
  return ids.filter((x, i) => ids.indexOf(x) !== i);
}

/** Finds `data/` by walking up from the working directory (works from the repo root and from apps/web). */
export function resolveDataDir(start: string = process.cwd()): string {
  if (process.env.PS_DATA_DIR) return resolve(process.env.PS_DATA_DIR);
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, "data", "cards"))) return join(dir, "data");
    const up = dirname(dir);
    if (up === dir) throw new ContentError("cannot find the data/ directory");
    dir = up;
  }
}

export function loadContent(opts: LoadOptions = {}): Content {
  const dataDir = opts.dataDir ?? resolveDataDir();
  const devFixtures = opts.devFixtures ?? process.env.DEV_FIXTURES === "1";

  // Sources: every data/sources/*.yaml is a list of Source.
  const sources: Source[] = [];
  for (const f of files(join(dataDir, "sources"), ".yaml")) {
    const raw = readYaml(f);
    if (!Array.isArray(raw)) throw new ContentError(`${f}: expected a list of sources`);
    raw.forEach((s, i) => sources.push(parseWith(Source, s, `${f}[${i}]`)));
  }
  if (devFixtures) sources.push(FIXTURE_SOURCE);
  const dup = duplicates(sources.map((s) => s.id));
  if (dup.length > 0) throw new ContentError(`duplicate source ids: ${dup.join(", ")}`);
  const sourceIds = new Set(sources.map((s) => s.id));

  // Evidence.
  const evFile = join(dataDir, "evidence", "evidence.yaml");
  const evRaw = existsSync(evFile) ? readYaml(evFile) : [];
  if (!Array.isArray(evRaw)) throw new ContentError(`${evFile}: expected a list of evidence`);
  const evidence = evRaw.map((e, i) => parseWith(Evidence, e, `${evFile}[${i}]`));
  const dupEv = duplicates(evidence.map((e) => e.id));
  if (dupEv.length > 0) throw new ContentError(`duplicate evidence ids: ${dupEv.join(", ")}`);
  for (const e of evidence) {
    if (!sourceIds.has(e.sourceId)) throw new ContentError(`evidence ${e.id}: unknown source id ${e.sourceId}`);
  }
  const evidenceIds = new Set(evidence.map((e) => e.id));

  // Cards.
  const cards = files(join(dataDir, "cards"), ".yaml").map((f) => parseWith(Card, readYaml(f), f));
  const dupCards = duplicates(cards.map((c) => c.id));
  if (dupCards.length > 0) throw new ContentError(`duplicate card ids: ${dupCards.join(", ")}`);
  for (const c of cards) {
    for (const id of c.sourceIds) {
      if (!sourceIds.has(id)) throw new ContentError(`card ${c.id}: unknown source id ${id}`);
    }
    for (const ch of c.choices) {
      for (const id of ch.evidenceIds) {
        if (!evidenceIds.has(id)) throw new ContentError(`card ${c.id} choice ${ch.id}: unknown evidence id ${id}`);
      }
    }
  }

  // Pre-judged choices are merged into choice.judgment.
  for (const f of files(join(dataDir, "prejudged"), ".json")) {
    const raw = readJson(f);
    if (!Array.isArray(raw)) throw new ContentError(`${f}: expected a list`);
    raw.forEach((item, i) => {
      const e = parseWith(PrejudgedEntry, item, `${f}[${i}]`);
      const card = cards.find((c) => c.id === e.cardId);
      const choice = card?.choices.find((c) => c.id === e.choiceId);
      if (!card || !choice) throw new ContentError(`${f}[${i}]: unknown card/choice ${e.cardId}/${e.choiceId}`);
      choice.judgment = e.judgment;
    });
  }

  // Countries: one CountryData per data/countries/*.json (a list in one file is also accepted).
  const countries: CountryData[] = [];
  for (const f of files(join(dataDir, "countries"), ".json")) {
    const raw = readJson(f);
    (Array.isArray(raw) ? raw : [raw]).forEach((item, i) => {
      countries.push(validateCountry(parseWith(CountryData, item, `${f}[${i}]`), sourceIds, f));
    });
  }
  if (devFixtures) countries.push(validateCountry(FIXTURE_COUNTRY, sourceIds, "dev/fixture-country.ts"));
  const dupCountries = duplicates(countries.map((c) => c.iso3));
  if (dupCountries.length > 0) throw new ContentError(`duplicate country iso3: ${dupCountries.join(", ")}`);

  return { cards, evidence, sources, countries, devFixtures };
}

function validateCountry(c: CountryData, sourceIds: Set<string>, where: string): CountryData {
  const total = Object.values(c.groupShares).reduce((a, b) => a + b, 0);
  if (Math.abs(total - 1) > 0.01) throw new ContentError(`${where}: groupShares sum to ${total}, expected 1`);
  const prov = [...Object.values(c.baselineSrc), ...Object.values(c.groupSharesSrc)];
  for (const p of prov) {
    if (!sourceIds.has(p.sourceId)) throw new ContentError(`${where}: unknown source id ${p.sourceId}`);
  }
  return c;
}

let cached: Content | null = null;

/** Loaded once per server process. */
export function getContent(): Content {
  cached ??= loadContent();
  return cached;
}
