// Source checks for the "every number needs a source" rule (spec Q1).
// Usage: pnpm tsx scripts/check-sources.ts [--production]
//   plain         fail on missing references, duplicate ids and schema errors; uncited items are warnings
//   --production  also fail on cited sources/evidence with verifiedBy null, and (with PS_COMMERCIAL=1)
//                 on cited sources with commercialOk false
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { Card, CountryData, Evidence, Source } from "../packages/shared/src/contracts";
import * as designParams from "../packages/shared/src/design-params";

export type CountryRefs = { file: string; sourceIds: string[] };
export type BasedOnRefs = { path: string; ids: string[] };

/** Raw (not yet schema-checked) registries. checkSources validates them. */
export type CheckInput = {
  sources: unknown[];
  evidence: unknown[];
  cards: unknown[];
  countries: CountryRefs[];
  designBasedOn: BasedOnRefs[];
};
export type CheckOptions = { production: boolean; commercial: boolean };
export type Summary = {
  sources: number; sourcesByKind: Record<string, number>; evidence: number; cards: number; countries: number; designRefs: number;
  citedSources: number; citedEvidence: number; unusedSources: number; unusedEvidence: number;
  unverifiedSources: number; unverifiedEvidence: number;
};
export type CheckResult = { problems: string[]; warnings: string[]; summary: Summary };

/** Find every `basedOn` string array in an object tree, with the dotted path of its owner. */
export function collectBasedOn(value: unknown, path: string[] = []): BasedOnRefs[] {
  if (value === null || typeof value !== "object") return [];
  const out: BasedOnRefs[] = [];
  const obj = value as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    if (k === "basedOn" && Array.isArray(v) && v.every((x) => typeof x === "string")) {
      out.push({ path: path.join(".") || "(root)", ids: v as string[] });
    } else if (!Array.isArray(v)) {
      out.push(...collectBasedOn(v, [...path, k]));
    }
  }
  return out;
}

export function checkSources(input: CheckInput, opts: CheckOptions): CheckResult {
  const problems: string[] = [];
  const warnings: string[] = [];

  const sources: Source[] = [];
  input.sources.forEach((raw, i) => {
    const r = Source.safeParse(raw);
    if (r.success) sources.push(r.data);
    else problems.push(`Source #${i} (${(raw as { id?: string } | null)?.id ?? "no id"}) fails the schema: ${r.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ")}`);
  });
  const evidence: Evidence[] = [];
  input.evidence.forEach((raw, i) => {
    const r = Evidence.safeParse(raw);
    if (r.success) evidence.push(r.data);
    else problems.push(`Evidence #${i} (${(raw as { id?: string } | null)?.id ?? "no id"}) fails the schema: ${r.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ")}`);
  });
  const cards: Card[] = [];
  input.cards.forEach((raw, i) => {
    const r = Card.safeParse(raw);
    if (r.success) cards.push(r.data);
    else problems.push(`Card #${i} (${(raw as { id?: string } | null)?.id ?? "no id"}) fails the schema: ${r.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ")}`);
  });

  // 2. duplicate ids, inside and across registries
  const owners = new Map<string, string[]>();
  const claim = (id: string, kind: string) => owners.set(id, [...(owners.get(id) ?? []), kind]);
  sources.forEach((s) => claim(s.id, "source"));
  evidence.forEach((e) => claim(e.id, "evidence"));
  cards.forEach((c) => claim(c.id, "card"));
  for (const [id, kinds] of owners) {
    if (kinds.length > 1) problems.push(`Duplicate id "${id}" (${kinds.join(", ")})`);
  }

  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const evidenceById = new Map(evidence.map((e) => [e.id, e]));
  const citedSourceIds = new Set<string>();
  const citedEvidenceIds = new Set<string>();

  // 1. references
  const refSource = (id: string, where: string) => {
    if (sourceById.has(id)) citedSourceIds.add(id);
    else problems.push(`${where}: source "${id}" does not exist`);
  };
  for (const c of cards) {
    c.sourceIds.forEach((id) => refSource(id, `Card ${c.id} sourceIds`));
    for (const ch of c.choices) {
      for (const id of ch.evidenceIds) {
        if (evidenceById.has(id)) citedEvidenceIds.add(id);
        else problems.push(`Card ${c.id} choice ${ch.id} evidenceIds: evidence "${id}" does not exist`);
      }
    }
  }
  for (const e of evidence) refSource(e.sourceId, `Evidence ${e.id} sourceId`);
  for (const d of input.designBasedOn) d.ids.forEach((id) => refSource(id, `design-params ${d.path} basedOn`));
  for (const c of input.countries) c.sourceIds.forEach((id) => refSource(id, `Country ${c.file} provenance`));

  // 3. cited nowhere (warning only)
  const unusedSources = sources.filter((s) => !citedSourceIds.has(s.id));
  const unusedEvidence = evidence.filter((e) => !citedEvidenceIds.has(e.id));
  unusedSources.forEach((s) => warnings.push(`Source "${s.id}" is cited nowhere`));
  unusedEvidence.forEach((e) => warnings.push(`Evidence "${e.id}" is cited by no choice`));

  // 4. production checks
  const citedSources = sources.filter((s) => citedSourceIds.has(s.id));
  const citedEvidence = evidence.filter((e) => citedEvidenceIds.has(e.id));
  const unverifiedSources = citedSources.filter((s) => s.verifiedBy === null);
  const unverifiedEvidence = citedEvidence.filter((e) => e.verifiedBy === null);
  if (opts.production) {
    unverifiedSources.forEach((s) => problems.push(`Unverified source "${s.id}" (verifiedBy is null)`));
    unverifiedEvidence.forEach((e) => problems.push(`Unverified evidence "${e.id}" (verifiedBy is null)`));
    if (opts.commercial) {
      citedSources.filter((s) => !s.commercialOk).forEach((s) =>
        problems.push(`commercialOk false for cited source "${s.id}" while PS_COMMERCIAL=1`));
    }
  }

  const sourcesByKind: Record<string, number> = {};
  for (const s of sources) sourcesByKind[s.kind] = (sourcesByKind[s.kind] ?? 0) + 1;
  return {
    problems, warnings,
    summary: {
      sources: sources.length, sourcesByKind, evidence: evidence.length, cards: cards.length, countries: input.countries.length,
      designRefs: input.designBasedOn.length,
      citedSources: citedSources.length, citedEvidence: citedEvidence.length,
      unusedSources: unusedSources.length, unusedEvidence: unusedEvidence.length,
      unverifiedSources: unverifiedSources.length, unverifiedEvidence: unverifiedEvidence.length,
    },
  };
}

function provenanceIds(country: unknown): string[] {
  const out: string[] = [];
  if (country === null || typeof country !== "object") return out;
  const c = country as Record<string, unknown>;
  for (const key of ["baselineSrc", "groupSharesSrc", "traitsSrc"]) {
    const rec = c[key];
    if (rec && typeof rec === "object") {
      for (const p of Object.values(rec as Record<string, unknown>)) {
        const id = (p as { sourceId?: unknown } | null)?.sourceId;
        if (typeof id === "string") out.push(id);
      }
    }
  }
  return out;
}

/** Read the repo's registries, cards, countries and design params. */
export function loadRepoInput(root: string): CheckInput {
  const yaml = (rel: string): unknown[] => {
    const v = parse(readFileSync(join(root, rel), "utf8")) as unknown;
    return Array.isArray(v) ? v : [];
  };
  const dir = (rel: string, ext: string) => {
    const d = join(root, rel);
    return existsSync(d) ? readdirSync(d).filter((f) => f.endsWith(ext)).sort() : [];
  };
  const countries = dir("data/countries", ".json").filter((f) => !f.startsWith("_")).map((f) => {
    const raw = JSON.parse(readFileSync(join(root, "data/countries", f), "utf8")) as unknown;
    const check = CountryData.safeParse(raw);
    if (!check.success) {
      // Surface as a reference list that cannot resolve, so the problem is reported by file name.
      return { file: f, sourceIds: [`(schema error: ${check.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ")})`, ...provenanceIds(raw)] };
    }
    return { file: f, sourceIds: provenanceIds(raw) };
  });
  return {
    sources: [...yaml("data/sources/sources.yaml"), ...yaml("data/sources/research-sources.yaml")],
    evidence: yaml("data/evidence/evidence.yaml"),
    cards: dir("data/cards", ".yaml").map((f) => parse(readFileSync(join(root, "data/cards", f), "utf8")) as unknown),
    countries,
    designBasedOn: collectBasedOn({ ...designParams }),
  };
}

function printSummary(r: CheckResult, opts: CheckOptions): void {
  const s = r.summary;
  const kinds = Object.entries(s.sourcesByKind).map(([k, n]) => `${k} ${n}`).join(", ");
  const rows: [string, string][] = [
    ["Sources", `${s.sources} (${kinds})`],
    ["Evidence items", String(s.evidence)],
    ["Cards", String(s.cards)],
    ["Countries", String(s.countries)],
    ["Design-param basedOn lists", String(s.designRefs)],
    ["Sources cited", `${s.citedSources} of ${s.sources} (${s.unusedSources} uncited)`],
    ["Evidence cited", `${s.citedEvidence} of ${s.evidence} (${s.unusedEvidence} uncited)`],
    ["Cited sources unverified", `${s.unverifiedSources} of ${s.citedSources}`],
    ["Cited evidence unverified", `${s.unverifiedEvidence} of ${s.citedEvidence}`],
  ];
  const w = Math.max(...rows.map(([k]) => k.length));
  console.log(`\nSource check summary (${opts.production ? "production" : "plain"}${opts.commercial ? ", PS_COMMERCIAL=1" : ""})`);
  for (const [k, v] of rows) console.log(`  ${k.padEnd(w)}  ${v}`);
}

function main(): void {
  const args = process.argv.slice(2);
  const opts: CheckOptions = { production: args.includes("--production"), commercial: process.env.PS_COMMERCIAL === "1" };
  const root = join(import.meta.dirname, "..");
  const result = checkSources(loadRepoInput(root), opts);
  if (result.warnings.length > 0) {
    console.log(`Warnings (${result.warnings.length}):`);
    result.warnings.forEach((w) => console.log(`  warning: ${w}`));
  }
  if (result.problems.length > 0) {
    console.error(`Problems (${result.problems.length}):`);
    result.problems.forEach((p) => console.error(`  - ${p}`));
  }
  printSummary(result, opts);
  if (result.problems.length > 0) {
    console.error(`\nFAILED with ${result.problems.length} problem(s).`);
    process.exit(1);
  }
  console.log("\nOK");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === join(process.argv[1])) main();
