import { GRADES, LEGACY, type GameState } from "@ps/shared";
import { pillarScores } from "./goodness";
import { clamp } from "./util";

export type Grade = "A" | "B" | "C" | "D" | "F";
export type Pillar = "economy" | "society" | "politics" | "other";

const PILLAR_NAMES: Pillar[] = ["economy", "society", "politics", "other"];

function gradeOf(change: number): Grade {
  const g = GRADES.value;
  if (change >= g.A) return "A";
  if (change >= g.B) return "B";
  if (change > g.C) return "C";
  if (change > g.D) return "D";
  return "F";
}

/** Per pillar: change of the pillar score since the start of the term, and its A-F grade. */
export function grades(state: GameState): Record<Pillar, { change: number; grade: Grade }> {
  const now = pillarScores(state.stats);
  const out = {} as Record<Pillar, { change: number; grade: Grade }>;
  for (const p of PILLAR_NAMES) {
    const change = now[p] - state.pillarsAtStart[p];
    out[p] = { change, grade: gradeOf(change) };
  }
  return out;
}

/** 0.75·clamp(50 + 2.5·mean pillar change, 0, 100) + 0.25·popularity, minus a penalty after impeachment or coup. Clamped to 0-100. */
export function legacyScore(state: GameState): number {
  const l = LEGACY.value;
  const now = pillarScores(state.stats);
  const meanChange = PILLAR_NAMES.reduce((a, p) => a + (now[p] - state.pillarsAtStart[p]), 0) / PILLAR_NAMES.length;
  const pillarPart = clamp(50 + l.pillarChangeScale * meanChange, 0, 100);
  let score = l.pillarWeight * pillarPart + l.popularityWeight * state.popularity;
  if (state.endReason === "impeached" || state.endReason === "coup") score -= l.earlyEndPenalty;
  return clamp(score, 0, 100);
}
