// 20-case smoke eval for the judge route.
// Usage: pnpm tsx evals/run-smoke.ts [--dry]
//   --dry  validate the cases and print the planned calls and an estimated cost; no API call, no key needed
// The API key is read from GAME_ANTHROPIC_API_KEY only.
import { join } from "node:path";
import { createClient } from "../packages/ai-gm/src/client";
import { MODEL } from "../packages/ai-gm/src/config";
import { loadCards, loadEvidence, REPO_ROOT } from "../packages/ai-gm/src/content";
import { JUDGE_PROMPT_VERSION } from "../packages/ai-gm/src/prompts/judge.v1";
import { estimateSmokeCost, loadSmokeCases, runSmoke } from "../packages/ai-gm/src/smoke";

const dry = process.argv.includes("--dry");
const cases = loadSmokeCases(join(REPO_ROOT, "evals/smoke/cases.json")); // zod validates shape and text length
const cards = loadCards();
const evidence = loadEvidence();

const missing = cases.filter((c) => !cards.some((k) => k.id === c.cardId));
if (missing.length > 0) {
  for (const c of missing) console.error(`${c.id}: unknown card ${c.cardId}`);
  process.exit(1);
}
if (new Set(cases.map((c) => c.id)).size !== cases.length) {
  console.error("duplicate case ids");
  process.exit(1);
}

const byCategory = new Map<string, number>();
for (const c of cases) byCategory.set(c.category, (byCategory.get(c.category) ?? 0) + 1);
const est = estimateSmokeCost(cases, cards, evidence);
console.log(`Smoke eval: ${cases.length} cases (${[...byCategory].map(([k, v]) => `${k} ${v}`).join(", ")})`);
console.log(`Model ${MODEL}, prompt ${JUDGE_PROMPT_VERSION}`);
for (const c of cases) console.log(`  ${c.id} [${c.category}] card ${c.cardId}, ${c.playerText.length} chars`);
console.log(
  `Estimated cost: about $${est.costUsd.toFixed(2)} without caching (upper bound), $${est.costUsdIfCached.toFixed(2)} if cached ` +
    "(output assumed 3000 tokens per call).",
);

if (dry) {
  console.log("Dry run: cases are valid, no API call made.");
  process.exit(0);
}

const client = createClient(); // throws a clear error if GAME_ANTHROPIC_API_KEY is missing
const { results, passRate, costUsd } = await runSmoke(cases, cards, evidence, { client });
for (const r of results) {
  console.log(`${r.pass ? "PASS" : "FAIL"} ${r.id}${r.pass ? "" : `\n     - ${r.failures.join("\n     - ")}`}`);
}
const passed = results.filter((r) => r.pass).length;
console.log(`Pass rate: ${passed}/${results.length} (${(passRate * 100).toFixed(0)}%). Cost: $${costUsd.toFixed(2)}`);
process.exit(passed === results.length ? 0 : 1);
