import type { Card, Evidence, GameState, Judgment } from "@ps/shared";
import { runRoute, emptyUsage } from "../call";
import { EFFORT, MAX_TOKENS, PLAYER_TEXT_MAX, PLAYER_TEXT_MIN } from "../config";
import { JUDGE_RULES } from "../prompts/judge.v1";
import { renderCountryBlock, renderJudgeTurn } from "../prompts/render";
import { JudgmentWire, toJudgment } from "../schemas";
import type { CountryContext, RouteDeps, RouteResult } from "../types";

export interface JudgeInput {
  country: CountryContext;
  /** null = generic context (offline pre-judge): no country-specific figures are given to the judge. */
  state: GameState | null;
  /** null = the player proposes a policy on their own. */
  card: Card | null;
  evidence: Evidence[];
  playerText: string;
}

/** Judge a preset choice or free text. Rejects text outside 20-800 characters before any call. */
export async function judge(input: JudgeInput, deps: RouteDeps): Promise<RouteResult<Judgment>> {
  const len = input.playerText.length;
  if (len < PLAYER_TEXT_MIN) return { ok: false, reason: "input_too_short", usage: emptyUsage() };
  if (len > PLAYER_TEXT_MAX) return { ok: false, reason: "input_too_long", usage: emptyUsage() };

  return runRoute<Judgment>({
    route: "judge",
    deps,
    system: [JUDGE_RULES, renderCountryBlock(input.country)],
    turn: renderJudgeTurn(input),
    wire: JudgmentWire,
    effort: EFFORT.judge,
    maxTokens: MAX_TOKENS.judge,
    convert: toJudgment,
  });
}
