// TEST FIXTURE — invented values, never shipped
import type { Card, GameState } from "@ps/shared";
import { newGame } from "@ps/engine";
import { fixtureCountry } from "./fixtures/country";
import { fixtureDeck } from "./fixtures/cards";

export const SIMPLE_CARD: Card = {
  ...fixtureDeck[0]!,
  id: "test.simple",
  conditions: [],
  ifIgnored: [{ target: "stability", delta: -4, over_quarters: 4 }],
};

export const QUIET_CARD: Card = { ...SIMPLE_CARD, id: "test.quiet", ifIgnored: [] };

export const SIMPLE_DECK: Card[] = [SIMPLE_CARD, QUIET_CARD];

/** A game state waiting for a decision on `cardId` at quarter 2. */
export function decisionState(cardId = SIMPLE_CARD.id, seed = "test-seed"): GameState {
  const s = newGame({ country: fixtureCountry, difficulty: "normal", seed });
  return { ...s, quarter: 2, phase: "decision", pendingCardId: cardId };
}
