import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { checkSources, collectBasedOn, loadRepoInput, type CheckInput } from "../check-sources";

const root = join(import.meta.dirname, "..", "..");

const src = (id: string, over: Record<string, unknown> = {}) => ({
  id, kind: "dataset", title: "t", publisher: "p", indicatorCode: null, url: "https://example.org/x",
  license: "CC BY 4.0", commercialOk: true, coverage: null, retrievedAt: null, verifiedBy: null, note: null, ...over,
});
const ev = (id: string, sourceId: string, over: Record<string, unknown> = {}) => ({
  id, sourceId, url: "https://example.org/e", policyTags: ["x"], indicator: "gdpGrowth", direction: "up",
  strength: "rct", regionTags: [], summaryTh: "ก", summaryEn: "a", verifiedBy: null, ...over,
});
const choice = (id: string, evidenceIds: string[]) => ({
  id, approach: "x", titleTh: "ก", descTh: "ข", costHint: "S", affectedGroups: [], evidenceIds, judgment: null, reviewedBy: null,
});
const card = (id: string, sourceIds: string[], evidenceIds: string[] = []) => ({
  id, category: "economy", severity: "major", titleTh: "ก", situationTh: "ข", conditions: [], baseWeight: 1, cooldownQ: 1,
  ifIgnored: [], sourceIds, choices: [choice("a", evidenceIds), choice("b", []), choice("c", [])],
});

/** A small consistent input; tests mutate copies of it. */
function base(): CheckInput {
  return {
    sources: [src("s.one"), src("s.two"), src("design.x", { kind: "design" })],
    evidence: [ev("ev.1", "s.two")],
    cards: [card("c.one", ["s.one"], ["ev.1"])],
    countries: [],
    designBasedOn: [{ path: "PARAM", ids: ["design.x"] }],
  };
}
const plain = { production: false, commercial: false };
const msgs = (r: { problems: string[] }) => r.problems.join("\n");

describe("checkSources: references", () => {
  it("passes on a consistent input", () => {
    const r = checkSources(base(), plain);
    expect(r.problems).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
  it("flags a card sourceId that does not exist", () => {
    const i = base();
    i.cards = [card("c.one", ["s.one", "s.missing"], ["ev.1"])];
    expect(msgs(checkSources(i, plain))).toMatch(/c\.one.*s\.missing/);
  });
  it("flags an evidence sourceId that does not exist", () => {
    const i = base();
    i.evidence = [ev("ev.1", "s.nope")];
    expect(msgs(checkSources(i, plain))).toMatch(/ev\.1.*s\.nope/);
  });
  it("flags a choice evidenceId that does not exist", () => {
    const i = base();
    i.cards = [card("c.one", ["s.one"], ["ev.1", "ev.ghost"])];
    expect(msgs(checkSources(i, plain))).toMatch(/c\.one.*ev\.ghost/);
  });
  it("flags a design-param basedOn id that does not exist", () => {
    const i = base();
    i.designBasedOn = [{ path: "TURN_CAP", ids: ["design.x", "design.gone"] }];
    expect(msgs(checkSources(i, plain))).toMatch(/TURN_CAP.*design\.gone/);
  });
  it("flags country provenance sourceIds that do not exist", () => {
    const i = base();
    i.countries = [{ file: "THA.json", sourceIds: ["s.one", "wdi.missing"] }];
    expect(msgs(checkSources(i, plain))).toMatch(/THA\.json.*wdi\.missing/);
  });
  it("reports a schema failure as a problem", () => {
    const i = base();
    i.sources.push({ id: "bad" });
    expect(msgs(checkSources(i, plain))).toMatch(/source.*bad/i);
  });
});

describe("checkSources: duplicates", () => {
  it("flags a duplicate id inside the sources registry", () => {
    const i = base();
    i.sources.push(src("s.one"));
    expect(msgs(checkSources(i, plain))).toMatch(/duplicate id.*s\.one/i);
  });
  it("flags an id shared between a source and an evidence item", () => {
    const i = base();
    i.evidence = [ev("s.one", "s.two")];
    i.cards = [card("c.one", ["s.one"], ["s.one"])];
    expect(msgs(checkSources(i, plain))).toMatch(/duplicate id.*s\.one/i);
  });
  it("flags an id shared between a card and a source", () => {
    const i = base();
    i.cards = [card("s.two", ["s.one"], ["ev.1"])];
    expect(msgs(checkSources(i, plain))).toMatch(/duplicate id.*s\.two/i);
  });
});

describe("checkSources: uncited items are warnings only", () => {
  it("warns about an unused source and an unused evidence item, without failing", () => {
    const i = base();
    i.sources.push(src("s.unused"));
    i.evidence.push(ev("ev.unused", "s.two"));
    const r = checkSources(i, plain);
    expect(r.problems).toEqual([]);
    expect(r.warnings.join("\n")).toMatch(/s\.unused/);
    expect(r.warnings.join("\n")).toMatch(/ev\.unused/);
  });
  it("counts a source cited only by a country as cited", () => {
    const i = base();
    i.sources.push(src("s.country"));
    i.countries = [{ file: "THA.json", sourceIds: ["s.country"] }];
    expect(checkSources(i, plain).warnings).toEqual([]);
  });
});

describe("checkSources: --production", () => {
  it("is not checked without the flag", () => {
    expect(checkSources(base(), { production: false, commercial: true }).problems).toEqual([]);
  });
  it("fails on cited sources and evidence with verifiedBy null", () => {
    const r = checkSources(base(), { production: true, commercial: false });
    const m = msgs(r);
    expect(m).toMatch(/unverified source.*s\.one/i);
    expect(m).toMatch(/unverified evidence.*ev\.1/i);
    expect(r.summary.unverifiedSources).toBe(3);
    expect(r.summary.unverifiedEvidence).toBe(1);
  });
  it("does not complain about unverified items that nobody cites", () => {
    const i = base();
    i.sources.push(src("s.unused"));
    expect(msgs(checkSources(i, { production: true, commercial: false }))).not.toMatch(/s\.unused/);
  });
  it("passes when everything cited is verified", () => {
    const i = base();
    i.sources = (i.sources as object[]).map((s) => ({ ...s, verifiedBy: "Ann" }));
    i.evidence = (i.evidence as object[]).map((e) => ({ ...e, verifiedBy: "Ann" }));
    expect(checkSources(i, { production: true, commercial: false }).problems).toEqual([]);
  });
  it("fails on a cited source with commercialOk false only when PS_COMMERCIAL=1", () => {
    const i = base();
    i.sources = [src("s.one", { commercialOk: false, verifiedBy: "Ann" }), src("s.two", { verifiedBy: "Ann" }), src("design.x", { kind: "design", verifiedBy: "Ann" })];
    i.evidence = [ev("ev.1", "s.two", { verifiedBy: "Ann" })];
    expect(checkSources(i, { production: true, commercial: false }).problems).toEqual([]);
    expect(msgs(checkSources(i, { production: true, commercial: true }))).toMatch(/commercialOk.*s\.one/);
  });
});

describe("checkSources: summary", () => {
  it("counts registries and citations", () => {
    const r = checkSources(base(), plain);
    expect(r.summary).toMatchObject({ sources: 3, evidence: 1, cards: 1, countries: 0, citedSources: 3, citedEvidence: 1 });
  });
});

describe("collectBasedOn", () => {
  it("finds basedOn arrays at any depth with their path", () => {
    const found = collectBasedOn({ A: { value: 1, basedOn: ["x", "y"] }, B: { inner: { basedOn: ["z"] } }, C: 3, D: [1, 2] });
    expect(found).toEqual([{ path: "A", ids: ["x", "y"] }, { path: "B.inner", ids: ["z"] }]);
  });
});

describe("repo data", () => {
  it("the real data passes the plain run", () => {
    expect(checkSources(loadRepoInput(root), plain).problems).toEqual([]);
  });
  it("loads design-params basedOn ids", () => {
    const input = loadRepoInput(root);
    expect(input.designBasedOn.length).toBeGreaterThan(5);
    expect(input.designBasedOn.some((p) => p.ids.includes("design.cap"))).toBe(true);
  });
});

describe("CI workflow", () => {
  const text = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
  const wf = parse(text) as {
    on: Record<string, unknown>;
    jobs: Record<string, { "runs-on": string; steps: { run?: string; uses?: string; with?: Record<string, unknown> }[] }>;
  };
  const runs = (job: string) => (wf.jobs[job]?.steps ?? []).map((s) => s.run ?? "").filter(Boolean);

  it("is valid YAML and runs on push and pull_request", () => {
    expect(Object.keys(wf.on)).toEqual(expect.arrayContaining(["push", "pull_request"]));
  });
  it("has a main job with install, typecheck, test, check-sources and web build", () => {
    const all = Object.values(wf.jobs).flatMap((j) => j.steps.map((s) => s.run ?? ""));
    expect(all.some((r) => /pnpm install --frozen-lockfile/.test(r))).toBe(true);
    expect(all.some((r) => /pnpm typecheck/.test(r))).toBe(true);
    expect(all.some((r) => /pnpm test\b/.test(r))).toBe(true);
    expect(all.some((r) => /pnpm tsx scripts\/check-sources\.ts\s*$/m.test(r))).toBe(true);
    expect(all.some((r) => /pnpm -C apps\/web build/.test(r))).toBe(true);
  });
  it("uses Node 22 and pnpm 10", () => {
    expect(text).toMatch(/node-version:\s*["']?22/);
    // pnpm version comes from package.json packageManager; a second "version" in the action makes setup fail
    expect(text).not.toMatch(/^\s+version:/m);
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { packageManager?: string };
    expect(pkg.packageManager).toMatch(/^pnpm@10\./);
  });
  it("has a separate E2E job that installs chromium with playwright", () => {
    const jobs = Object.keys(wf.jobs);
    expect(jobs.length).toBeGreaterThanOrEqual(2);
    const e2e = jobs.find((j) => runs(j).some((r) => /npx playwright install --with-deps chromium/.test(r)));
    expect(e2e).toBeDefined();
    const main = jobs.find((j) => j !== e2e && runs(j).some((r) => /pnpm test\b/.test(r)));
    expect(main).toBeDefined();
    expect(runs(main!).some((r) => /playwright install/.test(r))).toBe(false);
  });
  it("needs no secrets and never mentions the Anthropic key variable", () => {
    const bare = ["ANTHROPIC", "API", "KEY"].join("_");
    expect(text).not.toContain(bare);
    expect(text).not.toMatch(/secrets\./);
  });
});

describe("docs", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  const running = readFileSync(join(root, "docs/RUNNING.md"), "utf8");
  const bare = ["ANTHROPIC", "API", "KEY"].join("_");

  it("README explains the game, layout, the source rule and quick start", () => {
    expect(readme).toMatch(/Every number needs a source/i);
    for (const dir of ["packages/shared", "packages/engine", "packages/ai-gm", "apps/web", "data/", "scripts/", "plans/"]) {
      expect(readme).toContain(dir);
    }
    expect(readme).toContain("pnpm install");
    expect(readme).toContain("docs/RUNNING.md");
  });
  it("RUNNING.md covers env vars, scripts, cost estimates and review steps", () => {
    for (const v of ["GAME_ANTHROPIC_API_KEY", "GAME_MASTER", "DEV_FIXTURES", "PS_COMMERCIAL"]) expect(running).toContain(v);
    expect(running).toContain("DEV_FIXTURES=1 pnpm -C apps/web dev");
    expect(running).toContain("prejudge-choices.ts --dry");
    expect(running).toContain("run-smoke.ts --dry");
    expect(running).toContain("check-sources.ts --production");
    expect(running).toContain("docs/review-day1.md");
    expect(running).toContain("verifiedBy");
    expect(running).toMatch(/\$\d+\.\d\d/);
  });
  it("the bare Anthropic key name appears only in a warning line, and never in README", () => {
    expect(readme).not.toContain(bare);
    const lines = running.split("\n").filter((l) => l.replaceAll(`GAME_${bare}`, "").includes(bare));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l).toMatch(/never|do not|don't/i);
  });
});
