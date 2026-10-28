import type { Card, GameState } from "@ps/shared";
import type { Rng } from "./rng";
import { traitMultiplier, type Traits } from "./traits";
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

/**
 * Weighted pick by baseWeight × traitMultiplier(traits, card.traitWeights). Without traits every multiplier is 1.
 * null when nothing is eligible (and then no random number is used).
 */
export function pickCard(state: GameState, deck: readonly Card[], rng: Rng, traits?: Traits): Card | null {
  const pool = eligibleCards(state, deck);
  if (pool.length === 0) return null;
  const weight = (c: Card) => c.baseWeight * traitMultiplier(traits, c.traitWeights);
  const total = pool.reduce((a, c) => a + weight(c), 0);
  let r = rng.next() * total;
  for (const c of pool) {
    r -= weight(c);
    if (r < 0) return c;
  }
  return pool[pool.length - 1] ?? null;
}
