import { DICE, SCORE_EFFECTS, type Difficulty } from "@ps/shared";
import { at, clamp } from "./util";

export type Outcome = "critical_failure" | "great_success" | "success" | "partial" | "failure";

export interface ProbabilityInput {
  /** AI feasibility score 1-5. */
  feasibility: number | string;
  /** Specificity score 1-5 (already capped for presets). */
  specificity: number | string;
  /** Corruption stat, 0-100. */
  corruption: number;
  /** Number of measures in this answer. */
  nMeasures: number;
  /** Budget could not cover the one-off cost. */
  broke: boolean;
  /** Difficulty name, or the adjustment itself. */
  difficulty: Difficulty | number;
}

/** P = clamp(minP, maxP, Bf + Ms − corruptionWeight·(C − 50) − perExtraMeasure·(n − 1) − brokePenalty·s + D), in %. */
export function successProbability(i: ProbabilityInput): number {
  const d = DICE.value;
  const bf = at(SCORE_EFFECTS.feasibilityBase.value, Number(i.feasibility) - 1);
  const ms = at(SCORE_EFFECTS.specificityAdj.value, Number(i.specificity) - 1);
  const adj = typeof i.difficulty === "number" ? i.difficulty : d.difficultyAdj[i.difficulty];
  const p =
    bf + ms
    - d.corruptionWeight * (i.corruption - 50)
    - d.perExtraMeasure * (i.nMeasures - 1)
    - d.brokePenalty * (i.broke ? 1 : 0)
    + adj;
  return clamp(p, d.minP, d.maxP);
}

/** Checked top-down. `roll` is an integer 1-100. */
export function rollOutcome(P: number, roll: number): Outcome {
  const d = DICE.value;
  if (roll >= d.criticalFailureFrom) return "critical_failure";
  if (roll <= P / 4) return "great_success";
  if (roll <= P) return "success";
  if (roll <= P + d.partialBand) return "partial";
  return "failure";
}
