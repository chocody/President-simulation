import {
  DISCRETIONARY_BUDGET_PCT_GDP, GROUP_KEYS, RULES_VERSION, UNSOURCED_DEFAULTS,
  type CountryData, type Difficulty, type GameState,
} from "@ps/shared";
import { pillarScores, popularity } from "./goodness";

export function newGame(opts: { country: CountryData; difficulty: Difficulty; seed: string }): GameState {
  const { country, difficulty, seed } = opts;
  const stats = { ...country.baseline, budget: DISCRETIONARY_BUDGET_PCT_GDP.value[difficulty] / 4 };
  const groups = {} as GameState["groups"];
  for (const g of GROUP_KEYS) {
    groups[g] = { share: country.groupShares[g], satisfaction: UNSOURCED_DEFAULTS.value.groupSatisfaction };
  }
  const pillars = pillarScores(stats);
  return {
    rulesVersion: RULES_VERSION,
    seed,
    rngCursor: 0,
    countryIso3: country.iso3,
    difficulty,
    baseline: { ...country.baseline },
    quarter: 1,
    phase: "running",
    stats,
    groups,
    popularity: popularity(groups),
    scheduled: [],
    recurring: [],
    courtChecks: [],
    cardHistory: [],
    pendingCardId: null,
    econHistory: [pillars.economy],
    pillarsAtStart: pillars,
    log: [],
    endReason: null,
    voteShare: null,
  };
}
