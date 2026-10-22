// Offline pre-judge of every preset choice: 3 judge runs per choice, keep the run closest to the median scores.
// Usage: pnpm tsx scripts/prejudge-choices.ts [--dry] [--force] [--only <cardId>]
//   --dry    validate inputs, print the planned calls and an estimated cost; no API call, no key needed
//   --force  re-judge cards whose data/prejudged/<cardId>.json already exists
// The API key is read from GAME_ANTHROPIC_API_KEY only.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "../packages/ai-gm/src/client";
import { PLAYER_TEXT_MAX, PLAYER_TEXT_MIN, MODEL } from "../packages/ai-gm/src/config";
import { loadCards, loadEvidence, REPO_ROOT } from "../packages/ai-gm/src/content";
import {
  PREJUDGE_RUNS, estimatePrejudgeCost, planPrejudge, prejudgeOne, type PrejudgeRecord,
} from "../packages/ai-gm/src/prejudge";
import { JUDGE_PROMPT_VERSION } from "../packages/ai-gm/src/prompts/judge.v1";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const force = args.includes("--force");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : undefined;
const outDir = join(REPO_ROOT, "data/prejudged");

const cards = loadCards().filter((c) => !only || c.id === only);
if (cards.length === 0) {
  console.error(only ? `No card with id ${only}` : "No cards found in data/cards");
  process.exit(1);
}
const evidence = loadEvidence();

// Validation: every evidence id exists (planPrejudge throws), every player text passes the length guard.
const plan = planPrejudge(cards, evidence);
const badLength = plan.filter((p) => p.playerText.length < PLAYER_TEXT_MIN || p.playerText.length > PLAYER_TEXT_MAX);
if (badLength.length > 0) {
  for (const p of badLength) console.error(`${p.cardId}/${p.choiceId}: player text is ${p.playerText.length} characters`);
  process.exit(1);
}

const est = estimatePrejudgeCost(plan, PREJUDGE_RUNS);
console.log(`Pre-judge plan: ${cards.length} cards, ${plan.length} choices, ${PREJUDGE_RUNS} runs each = ${est.calls} judge calls`);
console.log(`Model ${MODEL}, prompt ${JUDGE_PROMPT_VERSION}, output ${outDir}`);
for (const card of cards) {
  const items = plan.filter((p) => p.cardId === card.id);
  const exists = existsSync(join(outDir, `${card.id}.json`));
  console.log(
    `  ${card.id}: ${items.length} choices x ${PREJUDGE_RUNS} runs` +
      ` (evidence: ${items.map((i) => i.evidence.length).join("/")})${exists ? (force ? " [exists, will overwrite]" : " [exists, will skip]") : ""}`,
  );
}
console.log(
  `Estimated cost: about $${est.costUsd.toFixed(2)} without caching (upper bound), ` +
    `$${est.costUsdIfCached.toFixed(2)} if the system prompt is cached.`,
);
console.log(
  `  ~${est.inputTokens.toLocaleString("en-US")} input tokens, ~${est.outputTokens.toLocaleString("en-US")} output tokens ` +
    "(output is an assumption: 3000 tokens per call incl. thinking).",
);

if (dry) {
  console.log("Dry run: no API call made.");
  process.exit(0);
}

const client = createClient(); // throws a clear error if GAME_ANTHROPIC_API_KEY is missing
mkdirSync(outDir, { recursive: true });
const createdAt = new Date().toISOString();
let total = 0;
let failed = 0;

for (const card of cards) {
  const file = join(outDir, `${card.id}.json`);
  if (existsSync(file) && !force) {
    console.log(`skip ${card.id} (exists)`);
    continue;
  }
  const records: PrejudgeRecord[] = [];
  let cardOk = true;
  for (const item of plan.filter((p) => p.cardId === card.id)) {
    const r = await prejudgeOne(item, { client }, createdAt);
    total += r.costUsd;
    if (r.ok) {
      records.push(r.record);
    } else {
      cardOk = false;
      failed++;
      console.error(`FAILED ${item.cardId}/${item.choiceId}: ${r.reason}`);
    }
  }
  if (cardOk) {
    writeFileSync(file, JSON.stringify(records, null, 2) + "\n");
    console.log(`wrote ${file}`);
  } else {
    console.error(`not written: ${card.id} (at least one choice failed)`);
  }
}

console.log(`Done. Actual cost $${total.toFixed(2)}. Failed choices: ${failed}.`);
process.exit(failed > 0 ? 1 : 0);
