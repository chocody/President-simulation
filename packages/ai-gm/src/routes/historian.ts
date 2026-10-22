import type { GameState } from "@ps/shared";
import { runRoute } from "../call";
import { EFFORT, MAX_TOKENS } from "../config";
import { HISTORIAN_RULES } from "../prompts/historian.v1";
import { renderChronicle, renderCountryBlock, renderState } from "../prompts/render";
import { HistorianWire, toHistorian, type Verdict } from "../schemas";
import type { CountryContext, RouteDeps, RouteResult } from "../types";

/** Same shape as the engine's `grades(state)` output; declared here so ai-gm does not depend on the engine. */
export type PillarGrades = Record<"economy" | "society" | "politics" | "other", { change: number; grade: "A" | "B" | "C" | "D" | "F" }>;

export interface HistorianInput {
  country: CountryContext;
  state: GameState;
  grades: PillarGrades;
  /** Legacy score 0-100 from the engine. */
  legacy: number;
}

/** End-of-term verdict: archetype, one fair line, a note per pillar. */
export async function historian(input: HistorianInput, deps: RouteDeps): Promise<RouteResult<Verdict>> {
  const grades = Object.entries(input.grades).map(
    ([pillar, g]) => `${pillar}: grade ${g.grade}, change ${Number(g.change.toFixed(2))}`,
  );
  const turn = [
    renderChronicle(input.state),
    renderState(input.state),
    `<ending>${input.state.endReason ?? "term_completed"}${input.state.voteShare !== null ? `, vote share ${Number(input.state.voteShare.toFixed(2))}` : ""}</ending>`,
    "<grades>",
    ...grades,
    "</grades>",
    `<legacy>${Number(input.legacy.toFixed(1))}</legacy>`,
  ].join("\n");

  return runRoute<Verdict>({
    route: "historian",
    deps,
    system: [HISTORIAN_RULES, renderCountryBlock(input.country)],
    turn,
    wire: HistorianWire,
    effort: EFFORT.historian,
    maxTokens: MAX_TOKENS.historian,
    convert: toHistorian,
  });
}
