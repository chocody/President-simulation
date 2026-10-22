import { ELECTION, type GameState } from "@ps/shared";
import type { Rng } from "./rng";
import { popularity } from "./goodness";

/** V = Σ share·S + econWeight·(E − 50) + U(−noise, noise); E = mean of the last econQuarters entries of econHistory. */
export function runElection(state: GameState, rng: Rng): GameState {
  const e = ELECTION.value;
  const s = structuredClone(state);
  const recent = s.econHistory.slice(-e.econQuarters);
  const E = recent.reduce((a, b) => a + b, 0) / recent.length;
  const noise = (rng.next() * 2 - 1) * e.noise;
  const V = popularity(s.groups) + e.econWeight * (E - 50) + noise;
  s.voteShare = V;
  s.endReason = V > e.winAbove ? "won_election" : "lost_election";
  s.phase = "ended";
  s.pendingCardId = null;
  s.rngCursor = rng.cursor;
  s.log.push(`q${s.quarter}: election ${s.endReason === "won_election" ? "won" : "lost"} with ${V.toFixed(1)}%`);
  return s;
}
