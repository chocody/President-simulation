// Offline pre-judge of preset choices: plan, median pick, cost estimate, one-choice runner.
import type { Card, Choice, Evidence, Judgment } from "@ps/shared";
import { MODEL } from "./config";
import { GENERIC_COUNTRY } from "./content";
import { costUsd } from "./pricing";
import { JUDGE_PROMPT_VERSION, JUDGE_RULES } from "./prompts/judge.v1";
import { renderCountryBlock, renderJudgeTurn } from "./prompts/render";
import { judge } from "./routes/judge";
import type { RouteDeps } from "./types";

export const PREJUDGE_RUNS = 3;
export const CRITERIA = ["relevance", "feasibility", "specificity", "tradeoffs", "consistency"] as const;

export interface PrejudgeItem {
  cardId: string;
  choiceId: string;
  card: Card;
  playerText: string;
  evidence: Evidence[];
}

export interface PrejudgeRecord {
  cardId: string;
  choiceId: string;
  judgment: Judgment;
  runs: number;
  model: string;
  promptVersion: string;
  createdAt: string;
}

export function buildPlayerText(choice: Pick<Choice, "titleTh" | "descTh">): string {
  return `${choice.titleTh} ${choice.descTh}`;
}

/** One item per card choice. Throws if a choice cites an evidence id that does not exist. */
export function planPrejudge(cards: Card[], evidence: Evidence[]): PrejudgeItem[] {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const items: PrejudgeItem[] = [];
  for (const card of cards) {
    for (const choice of card.choices) {
      const ev = choice.evidenceIds.map((id) => {
        const e = byId.get(id);
        if (!e) throw new Error(`${card.id}/${choice.id}: unknown evidence id ${id}`);
        return e;
      });
      items.push({ cardId: card.id, choiceId: choice.id, card, playerText: buildPlayerText(choice), evidence: ev });
    }
  }
  return items;
}

export function median(xs: number[]): number {
  if (xs.length === 0) throw new Error("median of empty list");
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Index of the run whose five scores are closest (sum of absolute differences) to the per-criterion median. First wins ties. */
export function pickMedianRun(runs: Judgment[]): number {
  if (runs.length === 0) throw new Error("pickMedianRun: no runs");
  const meds = CRITERIA.map((c) => median(runs.map((r) => Number(r.scores[c]))));
  let best = 0;
  let bestDist = Infinity;
  runs.forEach((r, i) => {
    const d = CRITERIA.reduce((a, c, k) => a + Math.abs(Number(r.scores[c]) - meds[k]!), 0);
    if (d < bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}

export type PrejudgeOutcome =
  | { ok: true; record: PrejudgeRecord; costUsd: number }
  | { ok: false; reason: string; costUsd: number };

/** Judge one choice `runs` times and keep the median run. All runs must succeed. */
export async function prejudgeOne(
  item: PrejudgeItem,
  deps: RouteDeps,
  createdAt: string,
  runs = PREJUDGE_RUNS,
): Promise<PrejudgeOutcome> {
  const judgments: Judgment[] = [];
  let cost = 0;
  for (let i = 0; i < runs; i++) {
    const r = await judge(
      { country: GENERIC_COUNTRY, state: null, card: item.card, evidence: item.evidence, playerText: item.playerText },
      deps,
    );
    cost += r.usage.costUsd;
    if (!r.ok) return { ok: false, reason: `run ${i + 1}: ${r.reason}${r.message ? ` (${r.message})` : ""}`, costUsd: cost };
    judgments.push(r.value);
  }
  const judgment = judgments[pickMedianRun(judgments)]!;
  return {
    ok: true,
    costUsd: cost,
    record: {
      cardId: item.cardId, choiceId: item.choiceId, judgment, runs, model: MODEL,
      promptVersion: JUDGE_PROMPT_VERSION, createdAt,
    },
  };
}

// ---------- cost estimate (dry run) ----------

/** Rough token count: Thai script about 1.5 characters per token, everything else about 4. */
export function estimateTokens(text: string): number {
  const thai = (text.match(/[฀-๿]/g) ?? []).length;
  return Math.ceil(thai / 1.5 + (text.length - thai) / 4);
}

/** ASSUMPTION, not a measurement: structured judgment (~1.5k tokens) plus adaptive thinking at medium effort. */
export const ASSUMED_OUTPUT_TOKENS_PER_JUDGE_CALL = 3000;

export interface CostEstimate {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  /** Upper bound: nothing is served from the cache. */
  costUsd: number;
  /** If the system blocks are cached (one write, then reads). */
  costUsdIfCached: number;
}

export function estimateJudgeCalls(
  items: { card: Card | null; evidence: Evidence[]; playerText: string }[],
  runsEach: number,
): CostEstimate {
  const systemTokens = estimateTokens(JUDGE_RULES) + estimateTokens(renderCountryBlock(GENERIC_COUNTRY));
  let turnTokens = 0;
  for (const it of items) {
    turnTokens += estimateTokens(renderJudgeTurn({ state: null, card: it.card, evidence: it.evidence, playerText: it.playerText })) * runsEach;
  }
  const calls = items.length * runsEach;
  const inputTokens = systemTokens * calls + turnTokens;
  const outputTokens = ASSUMED_OUTPUT_TOKENS_PER_JUDGE_CALL * calls;
  const none = { cacheReadTokens: 0, cacheWriteTokens: 0 };
  const costUsdNoCache = costUsd({ inputTokens, outputTokens, ...none });
  const costUsdIfCached = calls === 0 ? 0 : costUsd({
    inputTokens: turnTokens,
    outputTokens,
    cacheWriteTokens: systemTokens,
    cacheReadTokens: systemTokens * (calls - 1),
  });
  return { calls, inputTokens, outputTokens, costUsd: costUsdNoCache, costUsdIfCached };
}

export function estimatePrejudgeCost(plan: PrejudgeItem[], runs = PREJUDGE_RUNS): CostEstimate {
  return estimateJudgeCalls(plan, runs);
}
