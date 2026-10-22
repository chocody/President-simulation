// Smoke eval: 20 fixed cases, expectations on the judge's output. No network unless the runner is given a real client.
import { readFileSync } from "node:fs";
import { z } from "zod";
import type { Card, Evidence, Judgment } from "@ps/shared";
import { GENERIC_COUNTRY } from "./content";
import { CRITERIA, estimateJudgeCalls, type CostEstimate } from "./prejudge";
import { PLAYER_TEXT_MAX, PLAYER_TEXT_MIN } from "./config";
import { judge } from "./routes/judge";
import type { RouteDeps } from "./types";

const Range = z.tuple([z.number().int().min(1).max(5), z.number().int().min(1).max(5)]);
const FLAGS = ["impossible_claim", "cruelty", "rights_violation", "unconstitutional"] as const;

export const SmokeCase = z.object({
  id: z.string(),
  category: z.enum(["good", "vague", "impossible", "injection", "cruel"]),
  ideology: z.string().optional(),
  cardId: z.string(),
  playerText: z.string().min(PLAYER_TEXT_MIN).max(PLAYER_TEXT_MAX),
  expect: z.object({
    input_class: z.array(z.enum(["normal", "meta", "off_topic", "harmful", "gibberish"])).min(1),
    scores: z.partialRecord(z.enum(CRITERIA), Range).optional(),
    flags: z.partialRecord(z.enum(FLAGS), z.boolean()).optional(),
    noLevel3WithoutEvidence: z.boolean(),
  }),
});
export type SmokeCase = z.infer<typeof SmokeCase>;

export function loadSmokeCases(file: string): SmokeCase[] {
  return z.array(SmokeCase).parse(JSON.parse(readFileSync(file, "utf8")));
}

/** Evidence the judge is given for a case: the evidence of all choices of its card. */
export function evidenceForCard(card: Card, all: Evidence[]): Evidence[] {
  const ids = new Set(card.choices.flatMap((c) => c.evidenceIds));
  return all.filter((e) => ids.has(e.id));
}

/** Returns the list of failed expectations (empty = pass). */
export function checkCase(c: SmokeCase, j: Judgment, provided: Evidence[]): string[] {
  const fails: string[] = [];
  const x = c.expect;
  if (!x.input_class.includes(j.input_class)) {
    fails.push(`input_class ${j.input_class} not in [${x.input_class.join(", ")}]`);
  }
  for (const [crit, range] of Object.entries(x.scores ?? {})) {
    const v = Number(j.scores[crit as (typeof CRITERIA)[number]]);
    if (v < range[0] || v > range[1]) fails.push(`score ${crit}=${v} outside ${range[0]}-${range[1]}`);
  }
  for (const [flag, want] of Object.entries(x.flags ?? {})) {
    const got = j.flags[flag as (typeof FLAGS)[number]];
    if (got !== want) fails.push(`flag ${flag}=${got}, expected ${want}`);
  }
  if (x.noLevel3WithoutEvidence) {
    const byId = new Map(provided.map((e) => [e.id, e]));
    for (const a of j.actions) {
      for (const e of [...a.effects, ...a.side_effects]) {
        if (e.level !== "3") continue;
        const ok = e.evidence_ids.some((id) => {
          const ev = byId.get(id);
          return ev !== undefined && ev.indicator === e.indicator && ev.direction === e.direction;
        });
        if (!ok) fails.push(`level 3 effect on ${e.indicator} (${e.direction}) without matching provided evidence`);
      }
    }
  }
  return fails;
}

export interface SmokeResult {
  id: string;
  category: SmokeCase["category"];
  pass: boolean;
  failures: string[];
  costUsd: number;
}

export async function runSmoke(
  cases: SmokeCase[],
  cards: Card[],
  evidence: Evidence[],
  deps: RouteDeps,
): Promise<{ results: SmokeResult[]; passRate: number; costUsd: number }> {
  const results: SmokeResult[] = [];
  for (const c of cases) {
    const card = cards.find((k) => k.id === c.cardId);
    if (!card) throw new Error(`${c.id}: unknown card ${c.cardId}`);
    const provided = evidenceForCard(card, evidence);
    const r = await judge(
      { country: GENERIC_COUNTRY, state: null, card, evidence: provided, playerText: c.playerText },
      deps,
    );
    const failures = r.ok ? checkCase(c, r.value, provided) : [`call failed: ${r.reason}${r.message ? ` (${r.message})` : ""}`];
    results.push({ id: c.id, category: c.category, pass: failures.length === 0, failures, costUsd: r.usage.costUsd });
  }
  const passed = results.filter((r) => r.pass).length;
  return {
    results,
    passRate: results.length ? passed / results.length : 0,
    costUsd: results.reduce((a, r) => a + r.costUsd, 0),
  };
}

export function estimateSmokeCost(cases: SmokeCase[], cards: Card[], evidence: Evidence[]): CostEstimate {
  return estimateJudgeCalls(
    cases.map((c) => {
      const card = cards.find((k) => k.id === c.cardId) ?? null;
      return { card, evidence: card ? evidenceForCard(card, evidence) : [], playerText: c.playerText };
    }),
    1,
  );
}
