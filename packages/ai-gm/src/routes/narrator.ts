import type { Card, GameState, TurnReport } from "@ps/shared";
import { runRoute } from "../call";
import { EFFORT, MAX_TOKENS } from "../config";
import { NARRATOR_RULES } from "../prompts/narrator.v1";
import { escapeText, renderCountryBlock, renderEvent, renderState } from "../prompts/render";
import { Narration, NarratorWire, toNarration } from "../schemas";
import type { CountryContext, RouteDeps, RouteResult } from "../types";

export interface NarratorInput {
  country: CountryContext;
  state: GameState;
  report: TurnReport;
  card: Card | null;
  /** Title of the preset choice, or a short label for a typed answer. */
  answerTitle: string;
}

/** Retell the engine's report as a story, 3 headlines and a chronicle line. Never changes outcomes. */
export async function narrate(input: NarratorInput, deps: RouteDeps): Promise<RouteResult<Narration>> {
  const turn = [
    renderState(input.state),
    renderEvent(input.card),
    "<player_choice>",
    escapeText(input.answerTitle),
    "</player_choice>",
    "<engine_report>",
    JSON.stringify(input.report),
    "</engine_report>",
  ].join("\n");

  return runRoute<Narration>({
    route: "narrator",
    deps,
    system: [NARRATOR_RULES, renderCountryBlock(input.country)],
    turn,
    wire: NarratorWire,
    effort: EFFORT.narrator,
    maxTokens: MAX_TOKENS.narrator,
    convert: toNarration,
  });
}
