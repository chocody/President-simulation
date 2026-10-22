import type { Card, GameState } from "@ps/shared";
import type { Rng } from "./rng";
import { currentValue } from "./util";

/**
 * Cards whose conditions all hold and that were not used within their own cooldownQ quarters
 * (cooldownQ 0 = no cooldown). A card used at quarter q is available again from q + cooldownQ.
 */
export function eligibleCards(state: GameState, deck: readonly Card[]): Card[] {
  return deck.filter((card) => {
    const conditionsHold = card.conditions.every((c) => {
      const v = currentValue(state, c.target);
      return c.op === "<" ? v < c.value : v > c.value;
    });
    if (!conditionsHold) return false;
    const cooling = state.cardHistory.some((h) => h.cardId === card.id && state.quarter - h.quarter < card.cooldownQ);
    return !cooling;
  });
}

/** Weighted pick by baseWeight. null when nothing is eligible (and then no random number is used). */
export function pickCard(state: GameState, deck: readonly Card[], rng: Rng): Card | null {
  const pool = eligibleCards(state, deck);
  if (pool.length === 0) return null;
  const total = pool.reduce((a, c) => a + c.baseWeight, 0);
  let r = rng.next() * total;
  for (const c of pool) {
    r -= c.baseWeight;
    if (r < 0) return c;
  }
  return pool[pool.length - 1] ?? null;
}
